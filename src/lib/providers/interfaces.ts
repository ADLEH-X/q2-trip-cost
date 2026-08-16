export interface TrafficInterval {
  startPointIndex: number;
  endPointIndex: number;
  speed: 'NORMAL' | 'SLOW' | 'TRAFFIC_JAM';
}

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface WeatherData {
  temperatureC: number;
  weatherCode: number;
  weatherDescription: string;
  isRainy: boolean;
  windSpeedKmh: number;
  retrievedAt: string;
}

export interface RouteInfo {
  id: string;
  label: string;
  distanceKm: number;
  durationMins: number; // normal / free-flow
  trafficDurationMins: number;
  polyline: string;
  trafficIntervals?: TrafficInterval[];
  warnings: string[];
  originPlaceId?: string;
  destinationPlaceId?: string;
  originCoord?: LatLngLiteral;
  destinationCoord?: LatLngLiteral;
  originText?: string;
  destinationText?: string;
  googleFuelEstimateLiters?: number;
  routeLabels?: string[];
  isEcoRoute?: boolean;
  weather?: WeatherData;
}

export interface TollEstimate {
  totalTRY: number;
  items?: {
    name: string;
    priceTRY: number;
  }[];
  currency: string;
  status: 'LIVE' | 'UNAVAILABLE' | 'CACHED';
  providerName: string;
  retrievedAt: string; // ISO datetime
}

export interface RouteCalculation {
  route: RouteInfo;
  toll: TollEstimate;
}

export interface FuelPriceInfo {
  priceTRYPerLiter: number;   // Price for the active fuel type
  petrolPricePerLiter?: number;
  dieselPricePerLiter?: number;
  currency: string;
  source: string;
  retrievedAt: string;
  status: 'LIVE' | 'CACHED' | 'MANUAL' | 'CACHED_STALE' | 'ESTIMATED';
  side?: 'EUROPE' | 'ANATOLIA';
  fuelType?: 'petrol' | 'diesel';
}

export type PowertrainType = 'petrol' | 'diesel' | 'mild_hybrid' | 'full_hybrid' | 'phev' | 'ev';

export interface VehicleSettings {
  carModel?: string;
  fuelType: 'petrol' | 'diesel';
  powertrain?: PowertrainType;
  consumptionL100km: number; // Official combined baseline (WLTP)
  personalAverageConsumption?: number; // Optional user dashboard calibrated average
  displacementL?: number;
  hasTurbo?: boolean;
  drivetrain?: 'FWD' | 'AWD' | 'RWD';
  tollClass: number; // Default 1 for passenger car
}

export interface TrafficSegmentBreakdown {
  normalKm: number;
  slowKm: number;
  jamKm: number;
  totalKm: number;
}

export interface FuelEstimationDetails {
  officialConsumptionL100km: number;
  estimatedConsumptionL100km: number;
  estimatedFuelLiters: number;
  baselineFuelLiters: number;
  googleFuelEstimateLiters?: number;
  trafficImpactPercentage: number;
  trafficSegments: TrafficSegmentBreakdown;
  trafficDelayRatio: number;
  shortTripFactor: number;
  weatherFactor: number;
  temperatureC?: number;
  dataQuality: 'HIGH' | 'MEDIUM' | 'BASIC' | 'FALLBACK_BASELINE';
}

export interface TripCostCalculation {
  routeId: string;
  fuelLiters: number;
  fuelCostTRY: number;
  tollCostTRY: number;
  manualAdjustmentTRY: number;
  totalOneWayTRY: number;
  isCheapest?: boolean;
  isFastest?: boolean;
  isTollFree?: boolean;
  isLowestFuel?: boolean;
  isEcoRoute?: boolean;
  estimationDetails?: FuelEstimationDetails;
}

export interface LiveTripPoint {
  lat: number;
  lng: number;
  timestamp: number;
  speedKmh?: number;
  accuracyMeters?: number;
}

export interface LiveTripState {
  isActive: boolean;
  isPaused: boolean;
  startTime: number;
  elapsedSeconds: number;
  distanceTraveledKm: number;
  currentSpeedKmh: number;
  estimatedFuelUsedLiters: number;
  estimatedCurrentConsumptionL100km: number;
  routeProgressPercentage: number;
  currentLocation?: LatLngLiteral;
  error?: string;
}

export interface RoutingProvider {
  calculateRoutes(
    originPlaceId: string, 
    destinationPlaceId: string, 
    departureTime?: Date,
    vehicle?: VehicleSettings
  ): Promise<RouteCalculation[]>;
}

export interface TollProvider {
  calculateTolls(routePolyline: string, vehicle: VehicleSettings, departureTime?: Date): Promise<TollEstimate>;
}

export interface FuelPriceProvider {
  getCurrentPrice(side?: 'EUROPE' | 'ANATOLIA', fuelType?: 'petrol' | 'diesel'): Promise<FuelPriceInfo>;
}
