import {
  RouteInfo,
  VehicleSettings,
  PowertrainType,
  TrafficInterval,
  TrafficSegmentBreakdown,
  FuelEstimationDetails,
} from '../providers/interfaces';
import { decodePolyline, Point } from '@/utils/googleMaps';

/**
 * Centralized configurable coefficients for the traffic fuel consumption model.
 * Easily tunable against empirical vehicle telemetry.
 */
export const TRAFFIC_MODEL_CONFIG = {
  // Base consumption multipliers for each traffic state on conventional petrol ICE
  baseMultipliers: {
    NORMAL: 1.00,       // Free-flow / steady cruising
    SLOW: 1.25,         // Moderate slowdown / frequent speed variations (+25%)
    TRAFFIC_JAM: 1.65,  // Heavy stop-and-go, prolonged idling, repetitive acceleration (+65%)
  },

  // Powertrain sensitivity factors applied to the traffic penalty: (multiplier - 1.0) * powertrainFactor
  powertrainFactor: {
    petrol: 1.00,       // Conventional gasoline ICE
    diesel: 0.90,       // Diesel has lower idle fuel burn & strong low-end torque
    mild_hybrid: 0.75,  // 48V start-stop & mild regenerative braking reduces stop-and-go penalty by 25%
    full_hybrid: 0.35,  // EV crawling & strong regenerative braking absorbs 65% of congestion penalty
    phev: 0.45,         // Plug-in hybrid operating in hybrid mode
    ev: 0.25,           // Battery electric vehicle (no idle fuel consumption)
  } as Record<PowertrainType, number>,

  // Cold start & short trip penalty for combustion engines
  shortTripMultiplier: (distanceKm: number, powertrain: PowertrainType = 'petrol'): number => {
    if (powertrain === 'ev') return 1.00; // EVs have no engine thermal warmup penalty
    if (distanceKm < 5) return 1.15;      // <5 km: Cold engine, rich mixture, high friction (+15%)
    if (distanceKm <= 10) return 1.05;    // 5–10 km: Partial warmup (+5%)
    return 1.00;                          // >10 km: Fully warmed operating temperature
  },

  // Temperature & weather impact factor (conservative)
  weatherMultiplier: (temperatureC?: number, isRainy?: boolean): number => {
    let factor = 1.00;
    if (typeof temperatureC === 'number') {
      if (temperatureC < 0) factor += 0.06;       // Sub-zero: cold air density, cabin heating
      else if (temperatureC < 8) factor += 0.03;  // Cold weather
      else if (temperatureC > 35) factor += 0.05; // Extreme heat: continuous AC load
      else if (temperatureC > 30) factor += 0.02; // Warm weather: light AC
    }
    if (isRainy) {
      factor += 0.02; // Wet pavement rolling resistance
    }
    return parseFloat(factor.toFixed(3));
  },

  // Stagnation damping from macro delay ratio
  macroDelayImpact: (delayRatio: number): number => {
    if (delayRatio <= 1.0) return 1.00;
    return Math.min(1.15, 1.00 + (delayRatio - 1.0) * 0.10);
  },
};

/**
 * Great-circle distance between two geographic coordinates in kilometers.
 */
function haversineDistanceKm(p1: Point, p2: Point): number {
  const R = 6371; // Earth radius in km
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Decomposes a route's polyline into exact segment distances (NORMAL, SLOW, TRAFFIC_JAM).
 */
export function calculateTrafficSegmentDistances(
  polyline?: string,
  trafficIntervals?: TrafficInterval[],
  totalDistanceKm: number = 0
): TrafficSegmentBreakdown {
  if (!polyline || !trafficIntervals || trafficIntervals.length === 0 || totalDistanceKm <= 0) {
    return {
      normalKm: totalDistanceKm,
      slowKm: 0,
      jamKm: 0,
      totalKm: totalDistanceKm,
    };
  }

  const points = decodePolyline(polyline);
  if (points.length < 2) {
    return {
      normalKm: totalDistanceKm,
      slowKm: 0,
      jamKm: 0,
      totalKm: totalDistanceKm,
    };
  }

  let normalSum = 0;
  let slowSum = 0;
  let jamSum = 0;

  // Map each polyline segment to its traffic state
  for (let i = 0; i < points.length - 1; i++) {
    const segDist = haversineDistanceKm(points[i], points[i + 1]);

    let state: 'NORMAL' | 'SLOW' | 'TRAFFIC_JAM' = 'NORMAL';
    for (const interval of trafficIntervals) {
      if (i >= interval.startPointIndex && i <= interval.endPointIndex) {
        state = interval.speed || 'NORMAL';
        break;
      }
    }

    if (state === 'TRAFFIC_JAM') {
      jamSum += segDist;
    } else if (state === 'SLOW') {
      slowSum += segDist;
    } else {
      normalSum += segDist;
    }
  }

  const sumCalculated = normalSum + slowSum + jamSum;
  if (sumCalculated <= 0) {
    return {
      normalKm: totalDistanceKm,
      slowKm: 0,
      jamKm: 0,
      totalKm: totalDistanceKm,
    };
  }

  const scale = totalDistanceKm / sumCalculated;
  return {
    normalKm: normalSum * scale,
    slowKm: slowSum * scale,
    jamKm: jamSum * scale,
    totalKm: totalDistanceKm,
  };
}

export interface FuelEstimationInput {
  route: RouteInfo;
  vehicle: VehicleSettings;
}

/**
 * Route-specific, segment-by-segment traffic-aware fuel consumption estimator.
 *
 * Integrates:
 * 1. Manufacturer official baseline (WLTP)
 * 2. Optional user dashboard calibration (personalAverageConsumption)
 * 3. Speed reading traffic intervals (NORMAL, SLOW, TRAFFIC_JAM)
 * 4. Powertrain characteristics (Petrol, Diesel, Mild Hybrid, Full Hybrid, EV)
 * 5. Google route fuel consumption signal (avoiding double-counting)
 * 6. Cold-start short trip distance factor
 * 7. Ambient weather/temperature adjustment
 * 8. Macro traffic delay ratio (trafficDuration / staticDuration)
 */
export function estimateRealWorldConsumption(input: FuelEstimationInput): FuelEstimationDetails {
  const { route, vehicle } = input;
  const distanceKm = Math.max(0.1, route.distanceKm || 0.1);
  const officialConsumption = Math.max(1.0, vehicle.consumptionL100km || 5.4);
  const powertrain: PowertrainType =
    vehicle.powertrain || (vehicle.fuelType === 'diesel' ? 'diesel' : 'petrol');

  // 1. Establish Baseline (use user personal average calibration if provided, else official)
  let baselineConsumption = officialConsumption;
  if (vehicle.personalAverageConsumption && vehicle.personalAverageConsumption > 0) {
    baselineConsumption = vehicle.personalAverageConsumption;
  }

  // 2. Traffic Delay Ratio
  const staticDuration = Math.max(1, route.durationMins || Math.ceil(distanceKm * 1.2));
  const trafficDuration = Math.max(staticDuration, route.trafficDurationMins || staticDuration);
  const trafficDelayRatio = trafficDuration / staticDuration;

  // 3. Segment Breakdown
  let dataQuality: 'HIGH' | 'MEDIUM' | 'BASIC' | 'FALLBACK_BASELINE' = 'FALLBACK_BASELINE';
  let segments: TrafficSegmentBreakdown;

  if (route.trafficIntervals && route.trafficIntervals.length > 0 && route.polyline) {
    segments = calculateTrafficSegmentDistances(route.polyline, route.trafficIntervals, distanceKm);
    dataQuality = route.googleFuelEstimateLiters ? 'HIGH' : 'MEDIUM';
  } else if (trafficDelayRatio > 1.05) {
    const delayFraction = Math.min(0.8, (trafficDelayRatio - 1.0) / trafficDelayRatio);
    const slowKm = distanceKm * delayFraction * 0.65;
    const jamKm = distanceKm * delayFraction * 0.35;
    const normalKm = Math.max(0, distanceKm - slowKm - jamKm);
    segments = { normalKm, slowKm, jamKm, totalKm: distanceKm };
    dataQuality = 'BASIC';
  } else {
    segments = { normalKm: distanceKm, slowKm: 0, jamKm: 0, totalKm: distanceKm };
    dataQuality = 'FALLBACK_BASELINE';
  }

  // 4. Powertrain Sensitivity
  const pFactor = TRAFFIC_MODEL_CONFIG.powertrainFactor[powertrain] ?? 1.0;

  // 5. Segment-by-segment consumption calculation
  const normalPenalty = (TRAFFIC_MODEL_CONFIG.baseMultipliers.NORMAL - 1.0) * pFactor;
  const slowPenalty = (TRAFFIC_MODEL_CONFIG.baseMultipliers.SLOW - 1.0) * pFactor;
  const jamPenalty = (TRAFFIC_MODEL_CONFIG.baseMultipliers.TRAFFIC_JAM - 1.0) * pFactor;

  const normalCons = baselineConsumption * (1.0 + normalPenalty);
  const slowCons = baselineConsumption * (1.0 + slowPenalty);
  const jamCons = baselineConsumption * (1.0 + jamPenalty);

  const normalLiters = (segments.normalKm * normalCons) / 100;
  const slowLiters = (segments.slowKm * slowCons) / 100;
  const jamLiters = (segments.jamKm * jamCons) / 100;

  let subtotalLiters = normalLiters + slowLiters + jamLiters;

  // 6. Google Fuel Signal Cross-Calibration (if available)
  // Google's fuel estimation accounts for speed limits, stops, and road gradients for a generic vehicle.
  // We use this as a route-dynamics shaping signal without overriding our vehicle-specific engine.
  if (route.googleFuelEstimateLiters && route.googleFuelEstimateLiters > 0) {
    const googleL100km = (route.googleFuelEstimateLiters / distanceKm) * 100;
    // Generic baseline assumed by Google for standard passenger vehicle (~7.0 L/100km)
    const genericBaseline = 7.0;
    const routeDynamicsFactor = Math.max(0.85, Math.min(1.25, googleL100km / genericBaseline));
    // Blend 25% of Google's gradient/topography dynamics with 75% of our vehicle-specific segment model
    subtotalLiters = subtotalLiters * (0.75 + 0.25 * routeDynamicsFactor);
  }

  // 7. Environmental / Trip Corrections
  const shortTripFactor = TRAFFIC_MODEL_CONFIG.shortTripMultiplier(distanceKm, powertrain);
  const weatherFactor = TRAFFIC_MODEL_CONFIG.weatherMultiplier(
    route.weather?.temperatureC,
    route.weather?.isRainy
  );
  const delayFactor =
    dataQuality === 'HIGH' || dataQuality === 'MEDIUM'
      ? TRAFFIC_MODEL_CONFIG.macroDelayImpact(trafficDelayRatio)
      : 1.0;

  const estimatedFuelLiters = subtotalLiters * shortTripFactor * weatherFactor * delayFactor;
  const estimatedConsumptionL100km = (estimatedFuelLiters / distanceKm) * 100;
  const baselineFuelLiters = (distanceKm * officialConsumption) / 100;

  const trafficImpactPercentage =
    baselineConsumption > 0
      ? ((estimatedConsumptionL100km - baselineConsumption) / baselineConsumption) * 100
      : 0;

  return {
    officialConsumptionL100km: officialConsumption,
    estimatedConsumptionL100km: parseFloat(estimatedConsumptionL100km.toFixed(2)),
    estimatedFuelLiters: parseFloat(estimatedFuelLiters.toFixed(3)),
    baselineFuelLiters: parseFloat(baselineFuelLiters.toFixed(3)),
    googleFuelEstimateLiters: route.googleFuelEstimateLiters,
    trafficImpactPercentage: parseFloat(trafficImpactPercentage.toFixed(1)),
    trafficSegments: {
      normalKm: parseFloat(segments.normalKm.toFixed(1)),
      slowKm: parseFloat(segments.slowKm.toFixed(1)),
      jamKm: parseFloat(segments.jamKm.toFixed(1)),
      totalKm: parseFloat(distanceKm.toFixed(1)),
    },
    trafficDelayRatio: parseFloat(trafficDelayRatio.toFixed(2)),
    shortTripFactor,
    weatherFactor,
    temperatureC: route.weather?.temperatureC,
    dataQuality,
  };
}

/**
 * Diagnostic logger for inspecting detailed route calculation breakdown.
 */
export function logFuelEstimationBreakdown(details: FuelEstimationDetails, label?: string): void {
  console.log(`\n=== FUEL ESTIMATION BREAKDOWN [${label || 'Route'}] ===`);
  console.log(`Official Baseline:       ${details.officialConsumptionL100km} L/100km`);
  console.log(
    `Estimated Consumption:   ${details.estimatedConsumptionL100km} L/100km (+${details.trafficImpactPercentage}%)`
  );
  console.log(
    `Estimated Fuel Used:     ${details.estimatedFuelLiters} L (vs baseline ${details.baselineFuelLiters} L)`
  );
  if (details.googleFuelEstimateLiters) {
    console.log(`Google Fuel Estimate:    ${details.googleFuelEstimateLiters} L`);
  }
  console.log(
    `Segments:                Normal: ${details.trafficSegments.normalKm}km | Slow: ${details.trafficSegments.slowKm}km | Jam: ${details.trafficSegments.jamKm}km`
  );
  console.log(
    `Traffic Delay Ratio:     ${details.trafficDelayRatio}x (Data Quality: ${details.dataQuality})`
  );
  console.log(
    `Corrections:             Short Trip: ${details.shortTripFactor}x | Weather: ${details.weatherFactor}x (${details.temperatureC ?? 'N/A'}°C)`
  );
  console.log(`====================================================\n`);
}
