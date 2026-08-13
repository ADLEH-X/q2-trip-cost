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
      const desc = (route.description || '').toLowerCase();

      // 1. Check the primary route description first (most accurate)
      if (desc.includes('avrasya') || desc.includes('eurasia')) customLabel = 'via Eurasia Tunnel';
      else if (desc.includes('15 temmuz') || desc.includes('boğaziçi') || desc.includes('bogazici') || desc.includes('bosphorus')) customLabel = 'via 15 Temmuz Bridge';
      else if (desc.includes('fatih sultan mehmet') || desc.match(/\bfsm\b/)) customLabel = 'via FSM Bridge';
      else if (desc.includes('yavuz sultan selim') && !desc.includes('15 temmuz')) customLabel = 'via 15 Temmuz Bridge';
      else if (desc.includes('osmangazi') || desc.includes('körfez') || desc.includes('korfez')) customLabel = 'via Osmangazi Bridge';
      else if (desc.includes('çanakkale') || desc.includes('canakkale') || desc.includes('1915')) customLabel = 'via Canakkale Bridge';

      // 2. Fallback to full step instructions if description didn't specify a bridge (AVOID 3-LETTER ABBREVIATIONS HERE due to signposts)
      if (!customLabel) {
        if (routeString.includes('avrasya') || routeString.includes('eurasia')) customLabel = 'via Eurasia Tunnel';
        else if (routeString.includes('15 temmuz') || routeString.includes('boğaziçi') || routeString.includes('bogazici') || routeString.includes('bosphorus')) customLabel = 'via 15 Temmuz Bridge';
        else if (routeString.includes('fatih sultan mehmet') || routeString.includes('fsm')) customLabel = 'via FSM Bridge';
        else if (routeString.includes('yavuz sultan selim')) customLabel = 'via 15 Temmuz Bridge';
        else if (routeString.includes('osmangazi') || routeString.includes('körfez') || routeString.includes('korfez')) customLabel = 'via Osmangazi Bridge';
        else if (routeString.includes('çanakkale') || routeString.includes('canakkale') || routeString.includes('1915')) customLabel = 'via Canakkale Bridge';
      }
// Force 15 Temmuz if any indication exists, overriding YSS, but preserve FSM label
if (
  !customLabel.includes('FSM') &&
  (desc.includes('15 temmuz') ||
    desc.includes('bosphorus') ||
    desc.includes('boğaziçi') ||
    desc.includes('bogazici') ||
    routeString.includes('15 temmuz') ||
    routeString.includes('bosphorus') ||
    routeString.includes('boğaziçi') ||
    routeString.includes('bogazici'))
) {
  customLabel = 'via 15 Temmuz Bridge';
}
      // 3. Fallback to formatted route description
      if (!customLabel && route.description) {
        // Replace Turkish characters with English equivalents
        const trMap: Record<string, string> = {'ü':'u','Ü':'U','ğ':'g','Ğ':'G','ş':'s','Ş':'S','ç':'c','Ç':'C','ö':'o','Ö':'O','ı':'i','İ':'I'};
        customLabel = `via ${route.description.replace(/[üÜğĞşŞçÇöÖıİ]/g, (c: string) => trMap[c] || c)}`;
      }

      const routeInfo = {
        id: `route-${index}`,
        label: customLabel || `Route ${String.fromCharCode(65 + index)}`,
        distanceKm: distanceMeters / 1000,
        durationMins: Math.ceil(staticDurationS / 60),
        trafficDurationMins: Math.ceil(durationS / 60),
        polyline: route.polyline?.encodedPolyline || '',
        trafficIntervals,
        warnings: [],
        originPlaceId,
        destinationPlaceId
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

        if (customLabel.includes('Eurasia')) {
          tollTotal += liveTolls.avrasya;
          hasToll = true;
        } else if (customLabel.includes('Osmangazi')) {
          tollTotal += liveTolls.osmangazi;
          hasToll = true;
        } else if (customLabel.includes('Canakkale')) {
          tollTotal += liveTolls.canakkale;
          hasToll = true;
        } else if (customLabel.includes('YSS')) {
          tollTotal += liveTolls.yss;
          hasToll = true;
        } else if (customLabel.includes('FSM') || customLabel.includes('15 Temmuz')) {
          tollTotal += liveTolls.fsm; // FSM and 15 Temmuz share the same price
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
