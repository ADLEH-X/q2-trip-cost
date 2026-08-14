import { NextResponse } from 'next/server';

const GOOGLE_ROUTES_API_KEY = process.env.GOOGLE_ROUTES_API_KEY;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { origin, destination, computeAlternativeRoutes = true } = body;

    if (!GOOGLE_ROUTES_API_KEY) {
      // Return a 500 error if key is missing, or we could return mock data for dev mode.
      return NextResponse.json({ error: 'Google Routes API key is missing. Please configure .env' }, { status: 500 });
    }

    const payload = {
      origin: { placeId: origin },
      destination: { placeId: destination },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      computeAlternativeRoutes,
      routeModifiers: {
        vehicleInfo: {
          emissionType: 'GASOLINE' // Matches Audi Q2 passenger car
        },
        tollPasses: [] // We might not have specific Turkish passes in enum, so leave empty or configure
      },
      extraComputations: ['TOLLS', 'TRAFFIC_ON_POLYLINE'],
    };

    // The field mask is crucial for Routes API
    const fieldMask = 'routes.distanceMeters,routes.duration,routes.staticDuration,routes.polyline.encodedPolyline,routes.travelAdvisory,routes.routeLabels,routes.description,routes.legs.steps,routes.legs.startLocation,routes.legs.endLocation';

    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_ROUTES_API_KEY,
        'X-Goog-FieldMask': fieldMask
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Google Routes API Error:', data);
      return NextResponse.json({ error: 'Routing failed' }, { status: response.status });
    }

    // Force alternative route if Google only returns 1
    if (data.routes && data.routes.length === 1) {
      const altPayload = { 
        ...payload, 
        routeModifiers: { ...payload.routeModifiers, avoidTolls: true } 
      };
      
      const altResponse = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_ROUTES_API_KEY, 'X-Goog-FieldMask': fieldMask },
        body: JSON.stringify(altPayload)
      });
      
      if (altResponse.ok) {
        const altData = await altResponse.json();
        if (altData.routes && altData.routes.length > 0) {
          // Only add if it's actually a different route (distance differs)
          if (altData.routes[0].distanceMeters !== data.routes[0].distanceMeters) {
            data.routes.push(altData.routes[0]);
          } else {
            // Try avoiding highways if toll-free was the same
            const hwyPayload = { ...payload, routeModifiers: { ...payload.routeModifiers, avoidHighways: true } };
            const hwyResponse = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_ROUTES_API_KEY, 'X-Goog-FieldMask': fieldMask },
              body: JSON.stringify(hwyPayload)
            });
            if (hwyResponse.ok) {
              const hwyData = await hwyResponse.json();
              if (hwyData.routes && hwyData.routes.length > 0 && hwyData.routes[0].distanceMeters !== data.routes[0].distanceMeters) {
                data.routes.push(hwyData.routes[0]);
              }
            }
          }
        }
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error proxying route request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
