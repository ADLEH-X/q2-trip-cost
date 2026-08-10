import { RouteCalculation, TripCostCalculation, VehicleSettings, FuelPriceInfo } from './providers/interfaces';

export function calculateFuelUsedLiters(distanceKm: number, consumptionL100km: number): number {
  return (distanceKm * consumptionL100km) / 100;
}

export function calculateFuelCostTRY(fuelLiters: number, pricePerLiterTRY: number): number {
  return fuelLiters * pricePerLiterTRY;
}

export function calculateOneWayCost(
  route: RouteCalculation,
  vehicle: VehicleSettings,
  fuelPrice: FuelPriceInfo,
  manualAdjustmentTRY: number = 0
): TripCostCalculation {
  const fuelLiters = calculateFuelUsedLiters(route.route.distanceKm, vehicle.consumptionL100km);
  const fuelCostTRY = calculateFuelCostTRY(fuelLiters, fuelPrice.priceTRYPerLiter);
  
  const totalOneWayTRY = fuelCostTRY + route.toll.totalTRY + manualAdjustmentTRY;

  return {
    routeId: route.route.id,
    fuelLiters,
    fuelCostTRY,
    tollCostTRY: route.toll.totalTRY,
    manualAdjustmentTRY,
    totalOneWayTRY
  };
}

export function rankAlternativeRoutes(calculations: TripCostCalculation[], routes: RouteCalculation[]): TripCostCalculation[] {
  if (calculations.length === 0) return calculations;

  // Find cheapest route (using total one way cost)
  let cheapestIndex = 0;
  for (let i = 1; i < calculations.length; i++) {
    if (calculations[i].totalOneWayTRY < calculations[cheapestIndex].totalOneWayTRY) {
      cheapestIndex = i;
    }
  }

  // Find fastest route (using traffic duration if available, else normal duration)
  let fastestIndex = 0;
  for (let i = 1; i < routes.length; i++) {
    const currentRouteDur = routes[i].route.trafficDurationMins || routes[i].route.durationMins;
    const fastestRouteDur = routes[fastestIndex].route.trafficDurationMins || routes[fastestIndex].route.durationMins;
    if (currentRouteDur < fastestRouteDur) {
      fastestIndex = i;
    }
  }

  // Mark badges
  return calculations.map((calc, idx) => {
    const isTollFree = calc.tollCostTRY === 0;
    return {
      ...calc,
      isCheapest: idx === cheapestIndex,
      isFastest: idx === fastestIndex,
      isTollFree: isTollFree
    };
  });
}
