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

    if (!data.routes || data.routes.length === 0) {
      return [];
    }

    return data.routes.map((route: any, index: number) => {
      // Parse basic route info
      const distanceMeters = route.distanceMeters || 0;
      const staticDurationS = parseInt(route.staticDuration || '0');
      const durationS = parseInt(route.duration || '0');
      
      const routeInfo = {
        id: `route-${index}`,
        label: route.routeLabels?.[0] || `Route ${String.fromCharCode(65 + index)}`,
        distanceKm: distanceMeters / 1000,
        durationMins: Math.ceil(staticDurationS / 60),
        trafficDurationMins: Math.ceil(durationS / 60),
        polyline: route.polyline?.encodedPolyline || '',
        warnings: [] // parse from advisory if needed
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
      if (tollTotal === 0 && route.legs && route.legs.length > 0) {
        let hasToll = false;
        const steps = route.legs[0].steps || [];
        
        // Convert all step instructions/names into a single searchable string
        const routeString = steps.map((s: any) => 
          (s.navigationInstruction?.instructions || '') + ' ' + (s.staticDuration || '')
        ).join(' ').toLowerCase();

        if (routeString.includes('avrasya')) {
          tollTotal += 330.00; // Eurasia Tunnel 2026 (Daytime)
          hasToll = true;
        }
        if (routeString.includes('yavuz sultan selim') || routeString.includes('o-7')) {
          tollTotal += 110.00; // YSS Bridge 2026
          hasToll = true;
        }
        if (routeString.includes('fatih sultan mehmet') || routeString.includes('fsm') || routeString.includes('15 temmuz') || routeString.includes('bosphorus')) {
          tollTotal += 59.00; // 15 July or FSM Bridge 2026
          hasToll = true;
        }
        
        // If Google Routes told us there's a toll on the route via travelAdvisory but we couldn't identify it, mark it.
        if (!hasToll && route.travelAdvisory?.tollInfo) {
           // It has tolls but we don't know the price
        }
      }

      return {
        route: routeInfo,
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
