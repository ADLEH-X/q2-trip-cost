export interface RouteInfo {
  id: string;
  label: string;
  distanceKm: number;
  durationMins: number; // normal
  trafficDurationMins: number;
  polyline: string;
  warnings: string[];
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
  priceTRYPerLiter: number;
  currency: string;
  source: string;
  retrievedAt: string;
  status: 'LIVE' | 'CACHED' | 'MANUAL';
  side?: 'EUROPE' | 'ANATOLIA';
}

export interface VehicleSettings {
  fuelType: 'petrol' | 'diesel';
  consumptionL100km: number;
  tollClass: number; // Default 1 for passenger car
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
}

export interface RoutingProvider {
  calculateRoutes(
    originPlaceId: string, 
    destinationPlaceId: string, 
    departureTime?: Date
  ): Promise<RouteCalculation[]>;
}

export interface TollProvider {
  calculateTolls(routePolyline: string, vehicle: VehicleSettings, departureTime?: Date): Promise<TollEstimate>;
}

export interface FuelPriceProvider {
  getCurrentPrice(side?: 'EUROPE' | 'ANATOLIA'): Promise<FuelPriceInfo>;
}
