import {
  RouteCalculation,
  TripCostCalculation,
  VehicleSettings,
  FuelPriceInfo,
} from './providers/interfaces';
import { estimateRealWorldConsumption } from './services/fuelConsumptionEstimator';

/**
 * Baseline official fuel calculation: Distance (km) * Official Consumption (L/100km) / 100
 */
export function calculateFuelUsedLiters(distanceKm: number, consumptionL100km: number): number {
  return (distanceKm * consumptionL100km) / 100;
}

/**
 * Calculates fuel cost in TRY.
 */
export function calculateFuelCostTRY(fuelLiters: number, pricePerLiterTRY: number): number {
  return fuelLiters * pricePerLiterTRY;
}

/**
 * Calculates one-way trip cost using segment-by-segment traffic-aware estimation.
 * Estimated fuel cost + Toll cost = Total trip cost
 */
export function calculateOneWayCost(
  route: RouteCalculation,
  vehicle: VehicleSettings,
  fuelPrice: FuelPriceInfo,
  manualAdjustmentTRY: number = 0
): TripCostCalculation {
  const estimationDetails = estimateRealWorldConsumption({
    route: route.route,
    vehicle,
  });

  const fuelLiters = estimationDetails.estimatedFuelLiters;
  const fuelCostTRY = calculateFuelCostTRY(fuelLiters, fuelPrice.priceTRYPerLiter);
  const totalOneWayTRY = fuelCostTRY + route.toll.totalTRY + manualAdjustmentTRY;

  return {
    routeId: route.route.id,
    fuelLiters,
    fuelCostTRY,
    tollCostTRY: route.toll.totalTRY,
    manualAdjustmentTRY,
    totalOneWayTRY,
    isEcoRoute: route.route.isEcoRoute,
    estimationDetails,
  };
}

/**
 * Ranks alternative routes by total cost (cheapest), duration (fastest), and lowest fuel.
 * An alternative route with higher distance but light traffic can be cheaper than a congested short route.
 */
export function rankAlternativeRoutes(
  calculations: TripCostCalculation[],
  routes: RouteCalculation[]
): TripCostCalculation[] {
  if (calculations.length === 0) return calculations;

  // 1. Find cheapest route (using total one-way cost = estimated fuel + tolls)
  let cheapestIndex = 0;
  for (let i = 1; i < calculations.length; i++) {
    if (calculations[i].totalOneWayTRY < calculations[cheapestIndex].totalOneWayTRY) {
      cheapestIndex = i;
    }
  }

  // 2. Find fastest route (using traffic duration if available, else normal duration)
  let fastestIndex = 0;
  for (let i = 1; i < routes.length; i++) {
    const currentRouteDur = routes[i].route.trafficDurationMins || routes[i].route.durationMins;
    const fastestRouteDur =
      routes[fastestIndex].route.trafficDurationMins || routes[fastestIndex].route.durationMins;
    if (currentRouteDur < fastestRouteDur) {
      fastestIndex = i;
    }
  }

  // 3. Find lowest fuel consumption route
  let lowestFuelIndex = 0;
  for (let i = 1; i < calculations.length; i++) {
    if (calculations[i].fuelLiters < calculations[lowestFuelIndex].fuelLiters) {
      lowestFuelIndex = i;
    }
  }

  // Mark badges cleanly (avoid redundant clutter if same route holds all badges)
  return calculations.map((calc, idx) => {
    const isTollFree = calc.tollCostTRY === 0;
    const isCheapest = idx === cheapestIndex;
    const isFastest = idx === fastestIndex;
    // Only mark lowest fuel separately if it differs from the cheapest route
    const isLowestFuel = idx === lowestFuelIndex && (!isCheapest || calculations.length > 1);

    return {
      ...calc,
      isCheapest,
      isFastest,
      isTollFree,
      isLowestFuel,
    };
  });
}
