import { RouteCalculation, RoutingProvider, VehicleSettings, WeatherData } from './interfaces';
import { getRouteWeather } from '../services/weatherService';
import { decodePolyline, Point } from '@/utils/googleMaps';

// ─── Major Crossing Definitions ─────────────────────────────────────────────
// Each crossing has a center coordinate and a proximity radius (in degrees).
// A route must have at least one polyline point within this radius to be
// considered as actually using that crossing.
// ~0.02 degrees ≈ ~2.2 km — tight enough to avoid false positives.
const MAJOR_CROSSINGS = {
  eurasia: {
    lat: 41.0028, lng: 29.0016,
    radiusDeg: 0.02,
    label: 'via Eurasia Tunnel',
    tollKey: 'avrasya' as const,
    keywords: ['avrasya', 'eurasia'],
  },
  fsm: {
    lat: 41.0911, lng: 29.0558,
    radiusDeg: 0.02,
    label: 'via FSM Bridge',
    tollKey: 'fsm' as const,
    keywords: ['fatih sultan mehmet', 'fsm köprüsü'],
  },
  bridge15July: {
    lat: 41.0456, lng: 29.0343,
    radiusDeg: 0.02,
    label: 'via 15 Temmuz Bridge',
    tollKey: 'fsm' as const, // Same toll class as FSM
    keywords: ['15 temmuz', 'boğaziçi', 'bogazici', 'bosphorus'],
  },
  yss: {
    lat: 41.2028, lng: 29.1119,
    radiusDeg: 0.025,
    label: 'via Yavuz Sultan Selim Bridge',
    tollKey: 'yss' as const,
    keywords: ['yavuz sultan selim'],
  },
  osmangazi: {
    lat: 40.7540, lng: 29.5180,
    radiusDeg: 0.03, // Slightly wider — it's a long bridge
    label: 'via Osmangazi Bridge',
    tollKey: 'osmangazi' as const,
    keywords: ['osmangazi köprüsü', 'osmangazi bridge'],
  },
  canakkale: {
    lat: 40.3370, lng: 26.6340,
    radiusDeg: 0.03,
    label: 'via Çanakkale Bridge',
    tollKey: 'canakkale' as const,
    keywords: ['çanakkale', 'canakkale', '1915'],
  },
} as const;

type CrossingKey = keyof typeof MAJOR_CROSSINGS;
type TollKey = 'avrasya' | 'yss' | 'fsm' | 'osmangazi' | 'canakkale';

interface LiveTolls {
  avrasya: number;
  yss: number;
  fsm: number;
  osmangazi: number;
  canakkale: number;
}

/**
 * Check if any point in the polyline passes within `radiusDeg` of a crossing coordinate.
 * Uses adaptive sampling for performance on long polylines.
 */
function polylinePassesNear(points: Point[], crossingLat: number, crossingLng: number, radiusDeg: number): boolean {
  if (points.length === 0) return false;
  const radiusSq = radiusDeg * radiusDeg;
  // Adaptive step: sample every Nth point for very long polylines
  const step = points.length > 500 ? Math.ceil(points.length / 250) : 1;
  for (let i = 0; i < points.length; i += step) {
    const dLat = points[i].lat - crossingLat;
    const dLng = points[i].lng - crossingLng;
    if (dLat * dLat + dLng * dLng < radiusSq) return true;
  }
  return false;
}

/**
 * Detect which major crossings the route ACTUALLY passes through,
 * using geographic polyline proximity (not just keyword matching).
 */
function detectCrossingsFromPolyline(points: Point[]): CrossingKey[] {
  const found: CrossingKey[] = [];
  for (const [key, crossing] of Object.entries(MAJOR_CROSSINGS)) {
    if (polylinePassesNear(points, crossing.lat, crossing.lng, crossing.radiusDeg)) {
      found.push(key as CrossingKey);
    }
  }
  return found;
}

/**
 * Build a human-readable route label from the crossings detected.
 * Uses Google's route description as a starting point, then validates
 * against geographic proximity.
 */
function buildRouteLabel(
  routeDescription: string,
  routeStepsString: string,
  detectedCrossings: CrossingKey[]
): string {
  // If geographic detection found specific crossings, use those
  if (detectedCrossings.length > 0) {
    // Prefer the first detected crossing (usually the dominant one)
    return MAJOR_CROSSINGS[detectedCrossings[0]].label;
  }

  // No major crossing detected — use Google's description directly
  if (routeDescription) {
    return `via ${routeDescription}`;
  }

  return '';
}

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
    let liveTolls: LiveTolls = { avrasya: 330.0, yss: 110.0, fsm: 59.0, osmangazi: 399.0, canakkale: 419.0 };
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
    let weatherData: WeatherData | undefined;
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

      // ─── Geographic Crossing Detection ──────────────────────────────
      // Decode the route polyline and check which major crossings it ACTUALLY passes through
      const encodedPolyline = route.polyline?.encodedPolyline || '';
      const polylinePoints = decodePolyline(encodedPolyline);
      const detectedCrossings = detectCrossingsFromPolyline(polylinePoints);

      // Build route label from Google description + geographic validation
      const routeDescription = route.description || '';
      const steps = route.legs?.[0]?.steps || [];
      const routeStepsString = steps
        .map((s: any) => (s.navigationInstruction?.instructions || ''))
        .join(' ');

      const customLabel = buildRouteLabel(routeDescription, routeStepsString, detectedCrossings);

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
        polyline: encodedPolyline,
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

      // ─── Toll Calculation ──────────────────────────────────────────
      let tollTotal = 0;
      let tollStatus: 'LIVE' | 'UNAVAILABLE' | 'CACHED' = 'LIVE';
      const currency = 'TRY';

      // 1. Trust Google's native toll estimate FIRST
      const tollInfo = route.travelAdvisory?.tollInfo;
      if (tollInfo && tollInfo.estimatedPrice && tollInfo.estimatedPrice.length > 0) {
        const tryPrice = tollInfo.estimatedPrice.find((p: any) => p.currencyCode === 'TRY');
        if (tryPrice) {
          tollTotal =
            parseFloat(tryPrice.units || '0') + (tryPrice.nanos ? tryPrice.nanos / 1e9 : 0);
        }
      }

      // 2. If Google didn't provide a TRY toll price, use our own geographic detection
      //    ONLY charge a major crossing toll if the polyline actually passes near that crossing
      if (tollTotal === 0 && detectedCrossings.length > 0) {
        for (const crossingKey of detectedCrossings) {
          const crossing = MAJOR_CROSSINGS[crossingKey];
          const tollPrice = liveTolls[crossing.tollKey];
          if (tollPrice && tollPrice > 0) {
            tollTotal += tollPrice;
          }
        }
        if (tollTotal > 0) {
          tollStatus = 'CACHED'; // Mark as our own estimate, not Google's
        }
      }

      // 3. If Google says there's tollInfo but we found NO crossing and Google gave 0 TRY,
      //    it might be a minor KGM highway toll. Do NOT assume a major bridge/tunnel fee.
      //    Leave tollTotal at 0 — minor highway tolls (a few TL via HGS/OGS) are negligible
      //    compared to the 59-399 TL major crossing fees and would mislead the user.

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
