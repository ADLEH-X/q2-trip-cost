import { RouteCalculation, RoutingProvider, VehicleSettings } from './interfaces';

export class GoogleRoutesAdapter implements RoutingProvider {
  async calculateRoutes(originPlaceId: string, destinationPlaceId: string, departureTime?: Date): Promise<RouteCalculation[]> {
    const response = await fetch('/api/routes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ origin: originPlaceId, destination: destinationPlaceId }),
    });

    if (!response.ok) {
      throw new Error('Failed to calculate routes');
    }

    const data = await response.json();
    
    // Fetch live tolls (cached via Next.js for 24h)
    let liveTolls = { avrasya: 330.0, yss: 110.0, fsm: 59.0, osmangazi: 399.0, canakkale: 419.0 };
    try {
      const tollRes = await fetch('/api/tolls');
      if (tollRes.ok) liveTolls = await tollRes.json();
    } catch (e) {
      console.warn('Failed to fetch live tolls from API, using defaults');
    }

    if (!data.routes || data.routes.length === 0) {
      return [];
    }

    return data.routes.map((route: any, index: number) => {
      // Parse basic route info
      const distanceMeters = route.distanceMeters || 0;
      const staticDurationS = parseInt(route.staticDuration || '0');
      const durationS = parseInt(route.duration || '0');
      
      const intervals = route.travelAdvisory?.speedReadingIntervals || [];
      const trafficIntervals = intervals.map((interval: any) => ({
        startPointIndex: parseInt(interval.startPolylinePointIndex || '0'),
        endPointIndex: parseInt(interval.endPolylinePointIndex || '0'),
        speed: interval.speed || 'NORMAL'
      }));

      // Extract a meaningful English label from the route instructions
      const steps = route.legs?.[0]?.steps || [];
      const routeString = ((route.description || '') + ' ' + steps.map((s: any) => 
        (s.navigationInstruction?.instructions || '') + ' ' + (s.staticDuration || '')
      ).join(' ')).toLowerCase();

      let customLabel = '';
      if (routeString.includes('avrasya') || routeString.includes('eurasia')) customLabel = 'via Eurasia Tunnel';
      else if (routeString.includes('osmangazi') || routeString.includes('körfez') || routeString.includes('korfez')) customLabel = 'via Osmangazi Bridge';
      else if (routeString.includes('çanakkale') || routeString.includes('canakkale') || routeString.includes('1915')) customLabel = 'via Canakkale Bridge';
      else if (routeString.includes('yavuz sultan selim') || routeString.includes('yss')) customLabel = 'via YSS Bridge';
      else if (routeString.includes('fatih sultan mehmet') || routeString.includes('fsm')) customLabel = 'via FSM Bridge';
      else if (routeString.includes('15 temmuz') || routeString.includes('bosphorus') || routeString.includes('boğaziçi') || routeString.includes('bogazici')) customLabel = 'via 15 Temmuz Bridge';
      else if (route.description) {
        // Replace Turkish characters with English equivalents
        const trMap: Record<string, string> = {'ü':'u','Ü':'U','ğ':'g','Ğ':'G','ş':'s','Ş':'S','ç':'c','Ç':'C','ö':'o','Ö':'O','ı':'i','İ':'I'};
        customLabel = `via ${route.description.replace(/[üÜğĞşŞçÇöÖıİ]/g, c => trMap[c] || c)}`;
      }

      const routeInfo = {
        id: `route-${index}`,
        label: customLabel || `Route ${String.fromCharCode(65 + index)}`,
        distanceKm: distanceMeters / 1000,
        durationMins: Math.ceil(staticDurationS / 60),
        trafficDurationMins: Math.ceil(durationS / 60),
        polyline: route.polyline?.encodedPolyline || '',
        trafficIntervals,
        warnings: [] 
      };

      // Parse tolls (Native Google API fallback + Custom Turkey Logic)
      let tollTotal = 0;
      let tollStatus: 'LIVE' | 'UNAVAILABLE' | 'CACHED' = 'LIVE';
      const currency = 'TRY'; // Defaulting for Istanbul
      
      // 1. Try Native Google Toll Info First
      const tollInfo = route.travelAdvisory?.tollInfo;
      if (tollInfo && tollInfo.estimatedPrice && tollInfo.estimatedPrice.length > 0) {
        const tryPrice = tollInfo.estimatedPrice.find((p: any) => p.currencyCode === 'TRY');
        if (tryPrice) {
          tollTotal = parseFloat(tryPrice.units || '0') + (tryPrice.nanos ? tryPrice.nanos / 1e9 : 0);
        }
      }

      // 2. Custom Turkey Fallback (Google API does not natively support TR tolls yet)
      // Only apply this logic if Google natively flags the route as having a toll!
      // This prevents local trips on O-1 or O-2 from being falsely flagged as bridge crossings.
      if (tollTotal === 0 && route.travelAdvisory?.tollInfo && route.legs && route.legs.length > 0) {
        let hasToll = false;

        if (routeString.includes('avrasya') || routeString.includes('eurasia')) {
          tollTotal += liveTolls.avrasya; // Live Eurasia Tunnel 
          hasToll = true;
        }
        if (routeString.includes('osmangazi') || routeString.includes('körfez') || routeString.includes('korfez')) {
          tollTotal += liveTolls.osmangazi; 
          hasToll = true;
        }
        if (routeString.includes('çanakkale') || routeString.includes('canakkale') || routeString.includes('1915')) {
          tollTotal += liveTolls.canakkale; 
          hasToll = true;
        }
        if (routeString.includes('yavuz sultan selim') || routeString.includes('yss')) {
          tollTotal += liveTolls.yss; // Live YSS Bridge
          hasToll = true;
        }
        if (routeString.includes('fatih sultan mehmet') || routeString.includes('fsm') || routeString.includes('15 temmuz') || routeString.includes('bosphorus') || routeString.includes('boğaziçi') || routeString.includes('bogazici')) {
          tollTotal += liveTolls.fsm; // Live FSM/15 July Bridge 
          hasToll = true;
        }
        
        // 3. Absolute Failsafe: Google Flags Toll, but String Match Missed It
        if (!hasToll) {
          tollTotal += liveTolls.fsm; // Safe default
        }
      }

      // If there is a toll but the label doesn't specify a Bridge or Tunnel, it's a generic KGM highway toll
      if (tollTotal > 0 && !customLabel.includes('Bridge') && !customLabel.includes('Tunnel')) {
        customLabel = customLabel ? `${customLabel} (KGM Toll)` : 'via KGM Highway Toll';
      }

      return {
        route: {
          ...routeInfo,
          label: customLabel || routeInfo.label
        },
        toll: {
          totalTRY: tollTotal,
          currency,
          status: tollStatus,
          providerName: 'Google Routes',
          retrievedAt: new Date().toISOString()
        }
      };
    });
  }
}

export const routingProvider = new GoogleRoutesAdapter();
