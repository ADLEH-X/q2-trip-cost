import { RouteCalculation, RoutingProvider, VehicleSettings } from './interfaces';
import { getRouteWeather } from '../services/weatherService';

export class GoogleRoutesAdapter implements RoutingProvider {
  async calculateRoutes(
    originPlaceId: string,
    destinationPlaceId: string,
    departureTime?: Date,
    vehicle?: VehicleSettings
  ): Promise<RouteCalculation[]> {
    // Map vehicle powertrain to Google emission type
    let emissionType = 'GASOLINE';
    if (vehicle) {
      if (vehicle.fuelType === 'diesel') emissionType = 'DIESEL';
      else if (
        vehicle.powertrain === 'full_hybrid' ||
        vehicle.powertrain === 'mild_hybrid' ||
        vehicle.powertrain === 'phev'
      ) {
        emissionType = 'HYBRID';
      } else if (vehicle.powertrain === 'ev') {
        emissionType = 'ELECTRIC';
      }
    }

    const response = await fetch('/api/routes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        origin: originPlaceId,
        destination: destinationPlaceId,
        emissionType,
      }),
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

    // Try fetching origin weather in parallel for environmental fuel adjustment
    const firstLeg = data.routes[0]?.legs?.[0];
    const startLoc = firstLeg?.startLocation?.latLng;
    let weatherData;
    if (startLoc?.latitude && startLoc?.longitude) {
      try {
        weatherData = await getRouteWeather(Number(startLoc.latitude), Number(startLoc.longitude));
      } catch (e) {
        // Safe silent fallback
      }
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
        speed: interval.speed || 'NORMAL',
      }));

      // Extract Google fuel consumption signal if available (in microliters)
      let googleFuelEstimateLiters: number | undefined;
      const fuelMicroliters = route.travelAdvisory?.fuelConsumptionMicroliters;
      if (fuelMicroliters && typeof fuelMicroliters === 'string') {
        const parsed = parseInt(fuelMicroliters, 10);
        if (!isNaN(parsed) && parsed > 0) {
          googleFuelEstimateLiters = parseFloat((parsed / 1e6).toFixed(3));
        }
      }

      // Check if Google flagged this as an eco-friendly / fuel-efficient route
      const routeLabels = route.routeLabels || [];
      const isEcoRoute = routeLabels.includes('FUEL_EFFICIENT');

      // Extract a meaningful English label from the route instructions
      const steps = route.legs?.[0]?.steps || [];
      const routeString = (
        (route.description || '') +
        ' ' +
        steps
          .map((s: any) => (s.navigationInstruction?.instructions || '') + ' ' + (s.staticDuration || ''))
          .join(' ')
      ).toLowerCase();

      let customLabel = '';
      const desc = (route.description || '').toLowerCase();

      // 1. Check the primary route description first (most accurate)
      if (desc.includes('avrasya') || desc.includes('eurasia')) customLabel = 'via Eurasia Tunnel';
      else if (
        desc.includes('15 temmuz') ||
        desc.includes('boğaziçi') ||
        desc.includes('bogazici') ||
        desc.includes('bosphorus')
      )
        customLabel = 'via 15 Temmuz Bridge';
      else if (desc.includes('fatih sultan mehmet') || desc.match(/\bfsm\b/))
        customLabel = 'via FSM Bridge';
      else if (desc.includes('yavuz sultan selim') && !desc.includes('15 temmuz'))
        customLabel = 'via 15 Temmuz Bridge';
      else if (desc.includes('osmangazi') || desc.includes('körfez') || desc.includes('korfez'))
        customLabel = 'via Osmangazi Bridge';
      else if (desc.includes('çanakkale') || desc.includes('canakkale') || desc.includes('1915'))
        customLabel = 'via Canakkale Bridge';

      // 2. Fallback to full step instructions
      if (!customLabel) {
        if (routeString.includes('avrasya') || routeString.includes('eurasia'))
          customLabel = 'via Eurasia Tunnel';
        else if (
          routeString.includes('15 temmuz') ||
          routeString.includes('boğaziçi') ||
          routeString.includes('bogazici') ||
          routeString.includes('bosphorus')
        )
          customLabel = 'via 15 Temmuz Bridge';
        else if (routeString.includes('fatih sultan mehmet') || routeString.includes('fsm'))
          customLabel = 'via FSM Bridge';
        else if (routeString.includes('yavuz sultan selim')) customLabel = 'via 15 Temmuz Bridge';
        else if (
          routeString.includes('osmangazi') ||
          routeString.includes('körfez') ||
          routeString.includes('korfez')
        )
          customLabel = 'via Osmangazi Bridge';
        else if (
          routeString.includes('çanakkale') ||
          routeString.includes('canakkale') ||
          routeString.includes('1915')
        )
          customLabel = 'via Canakkale Bridge';
      }

      // Force 15 Temmuz if any indication exists, overriding YSS, but preserve FSM label
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
        customLabel = `via ${route.description}`;
      }

      const leg0 = route.legs?.[0];
      const legStart = leg0?.startLocation?.latLng;
      const legEnd = leg0?.endLocation?.latLng;
      const originCoord = legStart
        ? { lat: Number(legStart.latitude), lng: Number(legStart.longitude) }
        : undefined;
      const destinationCoord = legEnd
        ? { lat: Number(legEnd.latitude), lng: Number(legEnd.longitude) }
        : undefined;

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
        destinationPlaceId,
        originCoord,
        destinationCoord,
        googleFuelEstimateLiters,
        routeLabels,
        isEcoRoute,
        weather: weatherData,
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
          tollTotal =
            parseFloat(tryPrice.units || '0') + (tryPrice.nanos ? tryPrice.nanos / 1e9 : 0);
        }
      }

      // 2. Custom Turkey Fallback
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
          tollTotal += liveTolls.fsm;
          hasToll = true;
        }

        if (!hasToll) {
          tollTotal += liveTolls.fsm; // Safe default
        }
      }

      if (tollTotal > 0 && !customLabel.includes('Bridge') && !customLabel.includes('Tunnel')) {
        customLabel = customLabel ? `${customLabel} (KGM Toll)` : 'via KGM Highway Toll';
      }

      return {
        route: {
          ...routeInfo,
          label: customLabel || routeInfo.label,
        },
        toll: {
          totalTRY: tollTotal,
          currency,
          status: tollStatus,
          providerName: 'Google Routes',
          retrievedAt: new Date().toISOString(),
        },
      };
    });
  }
}

export const routingProvider = new GoogleRoutesAdapter();
