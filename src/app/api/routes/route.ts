import { NextResponse } from 'next/server';
import {
  allowRequest,
  buildCacheKey,
  getCached,
  getClientId,
  isAllowedEmissionType,
  isValidPlaceId,
  reserveUpstreamCalls,
  setCached,
} from '@/lib/server/routesGuard';

const GOOGLE_ROUTES_API_KEY = process.env.GOOGLE_ROUTES_API_KEY;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      origin,
      destination,
      computeAlternativeRoutes = true,
      emissionType = 'GASOLINE',
    } = body;

    if (!GOOGLE_ROUTES_API_KEY) {
      return NextResponse.json(
        { error: 'Google Routes API key is missing. Please configure .env.local' },
        { status: 500 }
      );
    }

    // Cost guardrails: reject malformed input before it can reach the billable API.
    if (!isValidPlaceId(origin) || !isValidPlaceId(destination) || !isAllowedEmissionType(emissionType)) {
      return NextResponse.json({ error: 'Invalid request', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const cacheKey = buildCacheKey(origin, destination, emissionType);
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT' } });
    }

    if (!allowRequest(getClientId(request))) {
      return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
    }

    // Reserve the primary upstream call against today's cap.
    if (!reserveUpstreamCalls(1)) {
      return NextResponse.json({ error: 'Daily capacity reached', code: 'DAILY_CAP' }, { status: 429 });
    }

    // Map emission type to Google Routes API enum
    let googleEmissionType = 'GASOLINE';
    if (emissionType === 'DIESEL') googleEmissionType = 'DIESEL';
    else if (emissionType === 'HYBRID' || emissionType === 'full_hybrid' || emissionType === 'mild_hybrid' || emissionType === 'phev') {
      googleEmissionType = 'HYBRID';
    } else if (emissionType === 'ELECTRIC' || emissionType === 'ev') {
      googleEmissionType = 'ELECTRIC';
    }

    const payload = {
      origin: { placeId: origin },
      destination: { placeId: destination },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
      computeAlternativeRoutes,
      routeModifiers: {
        vehicleInfo: {
          emissionType: googleEmissionType,
        },
        tollPasses: [],
      },
      extraComputations: ['TOLLS', 'TRAFFIC_ON_POLYLINE', 'FUEL_CONSUMPTION'],
    };

    // Google Routes API FieldMask
    const fieldMask =
      'routes.distanceMeters,routes.duration,routes.staticDuration,routes.polyline.encodedPolyline,routes.travelAdvisory,routes.routeLabels,routes.description,routes.legs.steps,routes.legs.startLocation,routes.legs.endLocation';

    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_ROUTES_API_KEY,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Google Routes API Error:', data);
      return NextResponse.json({ error: 'Routing failed' }, { status: response.status });
    }

    // Force alternative route if Google only returns 1
    if (data.routes && data.routes.length === 1 && reserveUpstreamCalls(1)) {
      const altPayload = {
        ...payload,
        routeModifiers: { ...payload.routeModifiers, avoidTolls: true },
      };

      const altResponse = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_ROUTES_API_KEY,
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify(altPayload),
      });

      if (altResponse.ok) {
        const altData = await altResponse.json();
        if (altData.routes && altData.routes.length > 0) {
          // Only add if it's actually a different route (distance differs)
          if (altData.routes[0].distanceMeters !== data.routes[0].distanceMeters) {
            data.routes.push(altData.routes[0]);
          } else if (reserveUpstreamCalls(1)) {
            // Try avoiding highways if toll-free was identical
            const hwyPayload = {
              ...payload,
              routeModifiers: { ...payload.routeModifiers, avoidHighways: true },
            };
            const hwyResponse = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_ROUTES_API_KEY,
                'X-Goog-FieldMask': fieldMask,
              },
              body: JSON.stringify(hwyPayload),
            });
            if (hwyResponse.ok) {
              const hwyData = await hwyResponse.json();
              if (
                hwyData.routes &&
                hwyData.routes.length > 0 &&
                hwyData.routes[0].distanceMeters !== data.routes[0].distanceMeters
              ) {
                data.routes.push(hwyData.routes[0]);
              }
            }
          }
        }
      }
    }

    if (data.routes && data.routes.length > 0) {
      setCached(cacheKey, data);
    }

    return NextResponse.json(data, { headers: { 'X-Cache': 'MISS' } });
  } catch (error) {
    console.error('Error proxying route request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
