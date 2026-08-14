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
  const { buildDirectionsUrl, getRouteWaypoint, WAYPOINT_COORDINATES } = require('../utils/googleMaps');

  it('builds official Google Maps Directions URL with coordinates for Eurasia Tunnel', () => {
    const route = {
      id: 'r-eurasia',
      label: 'via Eurasia Tunnel',
      distanceKm: 18,
      durationMins: 25,
      trafficDurationMins: 30,
      polyline: '',
      warnings: [],
      originCoord: { lat: 40.990142, lng: 29.029315 },
      destinationCoord: { lat: 41.042831, lng: 28.985412 },
    };

    const url = buildDirectionsUrl(route);
    expect(url.startsWith('https://www.google.com/maps/dir/?api=1')).toBe(true);
    expect(url).not.toContain('/data=!');
    expect(url).toContain('origin=40.990142%2C29.029315');
    expect(url).toContain('destination=41.042831%2C28.985412');
    expect(url).toContain('travelmode=driving');
    expect(url).toContain('dir_action=navigate');
    expect(url).toContain('waypoints=41.002800%2C29.001600');
  });

  it('builds FSM Bridge URL with FSM coordinate waypoint and not Eurasia Tunnel', () => {
    const route = {
      id: 'r-fsm',
      label: 'FSM Köprüsü üzerinden',
      distanceKm: 30,
      durationMins: 35,
      trafficDurationMins: 40,
      polyline: '',
      warnings: [],
      originCoord: { lat: 40.990142, lng: 29.029315 },
      destinationCoord: { lat: 41.085000, lng: 29.010000 },
    };

    const url = buildDirectionsUrl(route);
    expect(url).toContain('waypoints=41.091100%2C29.055800');
    expect(url).not.toContain('41.002800');
  });

  it('does NOT add waypoints for toll-free / direct routes', () => {
    const route = {
      id: 'r-tollfree',
      label: 'via D100',
      distanceKm: 10,
      durationMins: 15,
      trafficDurationMins: 18,
      polyline: '',
      warnings: [],
      originCoord: { lat: 40.990142, lng: 29.029315 },
      destinationCoord: { lat: 40.965000, lng: 29.080000 },
    };

    const url = buildDirectionsUrl(route);
    expect(url).not.toContain('waypoints=');
    expect(url).toContain('origin=40.990142%2C29.029315');
    expect(url).toContain('destination=40.965000%2C29.080000');
  });
});
