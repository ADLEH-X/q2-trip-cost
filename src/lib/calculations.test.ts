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
