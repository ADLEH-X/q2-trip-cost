import { describe, it, expect } from 'vitest';
import { calculateOneWayCost, rankAlternativeRoutes } from './calculations';
import { RouteCalculation, VehicleSettings, FuelPriceInfo } from './providers/interfaces';

describe('Calculation Engine', () => {
  const mockVehicle: VehicleSettings = {
    fuelType: 'petrol',
    consumptionL100km: 6.5,
    tollClass: 1,
  };

  const mockFuel: FuelPriceInfo = {
    priceTRYPerLiter: 40,
    petrolPricePerLiter: 40,
    dieselPricePerLiter: 42,
    currency: 'TRY',
    source: 'Test Provider',
    retrievedAt: new Date().toISOString(),
    status: 'CACHED',
    side: 'EUROPE',
  };

  const mockRoute: RouteCalculation = {
    route: {
      id: 'route-1',
      label: 'Via O-7',
      distanceKm: 100,
      durationMins: 60,
      trafficDurationMins: 75,
      polyline: '',
      warnings: [],
    },
    toll: {
      totalTRY: 50,
      currency: 'TRY',
      status: 'LIVE',
      providerName: 'Google',
      retrievedAt: new Date().toISOString(),
    }
  };

  it('correctly calculates fuel volume and cost for 100km', () => {
    const result = calculateOneWayCost(mockRoute, mockVehicle, mockFuel, 0);
    // 100km * 6.5L/100km = 6.5L
    expect(result.fuelLiters).toBe(6.5);
    // 6.5L * 40 TRY = 260 TRY
    expect(result.fuelCostTRY).toBe(260);
    // Total = 260 + 50 (toll) = 310 TRY
    expect(result.totalOneWayTRY).toBe(310);
  });

  it('ranks fastest, cheapest, and toll-free correctly', () => {
    const r1 = { ...mockRoute, route: { ...mockRoute.route, id: 'r1', trafficDurationMins: 90 }, toll: { ...mockRoute.toll, totalTRY: 10 } }; // Slow, Cheap
    const r2 = { ...mockRoute, route: { ...mockRoute.route, id: 'r2', trafficDurationMins: 60 }, toll: { ...mockRoute.toll, totalTRY: 100 } }; // Fast, Expensive
    const r3 = { ...mockRoute, route: { ...mockRoute.route, id: 'r3', trafficDurationMins: 80 }, toll: { ...mockRoute.toll, totalTRY: 0 } }; // Medium, Free
    
    const calcs = [r1, r2, r3].map(r => calculateOneWayCost(r as any, mockVehicle, mockFuel, 0));
    
    const ranked = rankAlternativeRoutes(calcs, [r1, r2, r3] as any);
    
    const cheapest = ranked.find(c => c.routeId === 'r1');
    const fastest = ranked.find(c => c.routeId === 'r2');
    const tollFree = ranked.find(c => c.routeId === 'r3');

    expect(cheapest?.isCheapest).toBe(true);
    expect(fastest?.isFastest).toBe(true);
    expect(tollFree?.isTollFree).toBe(true);
  });

  it('handles toll unavailable status properly', () => {
    const noTollInfo = { ...mockRoute, toll: { ...mockRoute.toll, totalTRY: 0, status: 'UNAVAILABLE' as const } };
    const result = calculateOneWayCost(noTollInfo, mockVehicle, mockFuel, 0);
    
    expect(result.tollCostTRY).toBe(0);
    // Logic downstream must read status 'UNAVAILABLE' to warn the user, but the calc should not throw
  });
});

describe('Route Label Localization', () => {
  const { localizeRouteLabel } = require('./translations');

  it('localizes bridge and tunnel labels in Turkish and English', () => {
    expect(localizeRouteLabel('via FSM Bridge', 'tr')).toBe('FSM Köprüsü üzerinden');
    expect(localizeRouteLabel('via FSM Bridge', 'en')).toBe('via FSM Bridge');

    expect(localizeRouteLabel('via 15 Temmuz Bridge', 'tr')).toBe('15 Temmuz Köprüsü üzerinden');
    expect(localizeRouteLabel('via 15 Temmuz Bridge', 'en')).toBe('via 15 Temmuz Bridge');

    expect(localizeRouteLabel('via Eurasia Tunnel', 'tr')).toBe('Avrasya Tüneli üzerinden');
    expect(localizeRouteLabel('via Eurasia Tunnel', 'en')).toBe('via Eurasia Tunnel');

    expect(localizeRouteLabel('via Osmangazi Bridge', 'tr')).toBe('Osmangazi Köprüsü üzerinden');
    expect(localizeRouteLabel('via Osmangazi Bridge', 'en')).toBe('via Osmangazi Bridge');

    expect(localizeRouteLabel('via Canakkale Bridge', 'tr')).toBe('1915 Çanakkale Köprüsü üzerinden');
    expect(localizeRouteLabel('via Canakkale Bridge', 'en')).toBe('via 1915 Canakkale Bridge');
  });

  it('localizes highway and road codes in Turkish mode', () => {
    expect(localizeRouteLabel('via D020', 'tr')).toBe('D020 üzerinden');
    expect(localizeRouteLabel('via D020', 'en')).toBe('via D020');

    expect(localizeRouteLabel('via O-7', 'tr')).toBe('O-7 üzerinden');
    expect(localizeRouteLabel('via O-7', 'en')).toBe('via O-7');

    expect(localizeRouteLabel('via Şile Otoyolu', 'tr')).toBe('Şile Otoyolu üzerinden');
    expect(localizeRouteLabel('via Şile Otoyolu', 'en')).toBe('via Şile Otoyolu');
  });

  it('localizes generic route and KGM toll labels', () => {
    expect(localizeRouteLabel('Route A', 'tr')).toBe('Rota A');
    expect(localizeRouteLabel('Route A', 'en')).toBe('Route A');

    expect(localizeRouteLabel('via D020 (KGM Toll)', 'tr')).toBe('D020 üzerinden (KGM Geçişi)');
    expect(localizeRouteLabel('via D020 (KGM Toll)', 'en')).toBe('via D020 (KGM Toll)');
  });
});

describe('Google Maps URL Builder', () => {
  const { buildDirectionsUrl, decodePolyline, extractRouteShapingWaypoints } = require('../utils/googleMaps');

  function encodePoly(points: { lat: number; lng: number }[]): string {
    let encoded = '';
    let prevLat = 0;
    let prevLng = 0;
    for (const pt of points) {
      let lat = Math.round(pt.lat * 1e5);
      let lng = Math.round(pt.lng * 1e5);
      let dLat = lat - prevLat;
      let dLng = lng - prevLng;
      prevLat = lat;
      prevLng = lng;
      for (let num of [dLat, dLng]) {
        num = num < 0 ? ~(num << 1) : (num << 1);
        while (num >= 0x20) {
          encoded += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
          num >>= 5;
        }
        encoded += String.fromCharCode(num + 63);
      }
    }
    return encoded;
  }

  const polyEurasiaCoastal = encodePoly([
    { lat: 40.99000, lng: 29.03000 },
    { lat: 40.99500, lng: 29.01500 },
    { lat: 41.00280, lng: 29.00160 }, // Tunnel
    { lat: 41.00600, lng: 28.98000 }, // Kennedy Cd. coast
    { lat: 41.01800, lng: 28.98500 }, // Karakoy coast
    { lat: 41.04200, lng: 28.98500 }, // Besiktas
  ]);

  const polyEurasiaInland = encodePoly([
    { lat: 40.99000, lng: 29.03000 },
    { lat: 40.99500, lng: 29.01500 },
    { lat: 41.00280, lng: 29.00160 }, // Tunnel
    { lat: 41.01800, lng: 28.94500 }, // D100 inland / Vatan Cd.
    { lat: 41.03500, lng: 28.95500 }, // Halic
    { lat: 41.04200, lng: 28.98500 }, // Besiktas
  ]);

  const routeEurasia1 = {
    id: 'r-eurasia-coastal',
    label: 'Avrasya Tüneli üzerinden (Sahil Yolu)',
    distanceKm: 18,
    durationMins: 25,
    trafficDurationMins: 30,
    polyline: polyEurasiaCoastal,
    warnings: [],
  };

  const routeEurasia2 = {
    id: 'r-eurasia-inland',
    label: 'Avrasya Tüneli üzerinden (D100 / Aksaray)',
    distanceKm: 21,
    durationMins: 28,
    trafficDurationMins: 34,
    polyline: polyEurasiaInland,
    warnings: [],
  };

  it('generates DIFFERENT Google Maps URLs for two alternatives using the same tunnel', () => {
    const allRoutes = [routeEurasia1, routeEurasia2];

    const url1 = buildDirectionsUrl(routeEurasia1, { allRoutes });
    const url2 = buildDirectionsUrl(routeEurasia2, { allRoutes });

    expect(url1).not.toBe(url2);
    expect(url1).toContain('waypoints=');
    expect(url2).toContain('waypoints=');

    // Each URL has distinct polyline route-shaping waypoints
    const wp1 = new URL(url1).searchParams.get('waypoints');
    const wp2 = new URL(url2).searchParams.get('waypoints');
    expect(wp1).not.toBe(wp2);
  });

  it('formats up to 3 waypoints in route order separated by %7C', () => {
    const allRoutes = [routeEurasia1, routeEurasia2];
    const url = buildDirectionsUrl(routeEurasia1, { allRoutes });

    // In the raw URL string, '|' must be encoded as '%7C'
    expect(url).toContain('%7C');
    expect(url).not.toContain('/data=!');
    expect(url).toContain('travelmode=driving');
    expect(url).toContain('dir_action=navigate');
  });

  it('adds avoid=tolls for toll-free route alternatives', () => {
    const tollFreeRoute = {
      id: 'r-tollfree',
      label: 'D100 üzerinden',
      distanceKm: 12,
      durationMins: 20,
      trafficDurationMins: 25,
      polyline: polyEurasiaCoastal,
      warnings: [],
    };

    const url = buildDirectionsUrl(tollFreeRoute, { isTollFree: true });
    expect(url).toContain('avoid=tolls');
  });

  it('does NOT add avoid=tolls for toll routes', () => {
    const url = buildDirectionsUrl(routeEurasia1, { isTollFree: false });
    expect(url).not.toContain('avoid=tolls');
  });
});
