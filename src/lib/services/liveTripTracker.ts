import { LatLngLiteral, LiveTripPoint, LiveTripState, RouteInfo, VehicleSettings } from '../providers/interfaces';

/**
 * Calculates distance in kilometers between two lat/lng points using Haversine formula.
 */
function haversineKm(p1: LatLngLiteral, p2: LatLngLiteral): number {
  const R = 6371;
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

export class LiveTripTracker {
  private watchId: number | null = null;
  private points: LiveTripPoint[] = [];
  private state: LiveTripState;
  private onUpdateCallback: ((state: LiveTripState) => void) | null = null;
  private routeDistanceKm: number = 0;
  private estimatedConsumptionL100km: number = 6.0;

  constructor() {
    this.state = this.getInitialState();
  }

  private getInitialState(): LiveTripState {
    return {
      isActive: false,
      isPaused: false,
      startTime: 0,
      elapsedSeconds: 0,
      distanceTraveledKm: 0,
      currentSpeedKmh: 0,
      estimatedFuelUsedLiters: 0,
      estimatedCurrentConsumptionL100km: 6.0,
      routeProgressPercentage: 0,
    };
  }

  public startTrip(
    route: RouteInfo,
    estimatedConsumptionL100km: number,
    onUpdate: (state: LiveTripState) => void
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        this.state.error = 'Geolocation is not supported by your browser.';
        onUpdate(this.state);
        return resolve(false);
      }

      this.routeDistanceKm = Math.max(0.1, route.distanceKm);
      this.estimatedConsumptionL100km = estimatedConsumptionL100km;
      this.onUpdateCallback = onUpdate;
      this.points = [];

      this.state = {
        isActive: true,
        isPaused: false,
        startTime: Date.now(),
        elapsedSeconds: 0,
        distanceTraveledKm: 0,
        currentSpeedKmh: 0,
        estimatedFuelUsedLiters: 0,
        estimatedCurrentConsumptionL100km: estimatedConsumptionL100km,
        routeProgressPercentage: 0,
      };

      const geoOptions: PositionOptions = {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      };

      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          this.handlePositionUpdate(position);
          resolve(true);
        },
        (err) => {
          console.warn('Live location error:', err);
          this.state.error = err.message || 'Unable to access location.';
          if (this.onUpdateCallback) this.onUpdateCallback({ ...this.state });
          resolve(false);
        },
        geoOptions
      );
    });
  }

  private handlePositionUpdate(position: GeolocationPosition): void {
    if (!this.state.isActive || this.state.isPaused) return;

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;
    const timestamp = position.timestamp;

    // Filter out low accuracy GPS readings (> 45 meters) to prevent jumping
    if (accuracy > 45) return;

    const newPoint: LiveTripPoint = {
      lat,
      lng,
      timestamp,
      speedKmh: position.coords.speed ? position.coords.speed * 3.6 : 0,
      accuracyMeters: accuracy,
    };

    if (this.points.length > 0) {
      const prevPoint = this.points[this.points.length - 1];
      const deltaKm = haversineKm(prevPoint, newPoint);
      const deltaTimeSeconds = (timestamp - prevPoint.timestamp) / 1000;

      // Filter out unrealistic GPS teleportation jumps (> 200 km/h)
      const impliedSpeedKmh = deltaTimeSeconds > 0 ? (deltaKm / (deltaTimeSeconds / 3600)) : 0;
      if (impliedSpeedKmh > 200) return;

      this.state.distanceTraveledKm += deltaKm;
      this.state.currentSpeedKmh =
        newPoint.speedKmh && newPoint.speedKmh > 0
          ? parseFloat(newPoint.speedKmh.toFixed(1))
          : parseFloat(impliedSpeedKmh.toFixed(1));
    }

    this.points.push(newPoint);

    const now = Date.now();
    this.state.elapsedSeconds = Math.floor((now - this.state.startTime) / 1000);
    this.state.currentLocation = { lat, lng };

    // Real-time fuel used so far (Liters)
    const fuelUsed = (this.state.distanceTraveledKm * this.estimatedConsumptionL100km) / 100;
    this.state.estimatedFuelUsedLiters = parseFloat(fuelUsed.toFixed(3));

    // Progress along planned route distance
    const progress = Math.min(100, (this.state.distanceTraveledKm / this.routeDistanceKm) * 100);
    this.state.routeProgressPercentage = parseFloat(progress.toFixed(1));

    if (this.onUpdateCallback) {
      this.onUpdateCallback({ ...this.state });
    }
  }

  public pauseTrip(): void {
    this.state.isPaused = true;
    if (this.onUpdateCallback) this.onUpdateCallback({ ...this.state });
  }

  public resumeTrip(): void {
    this.state.isPaused = false;
    if (this.onUpdateCallback) this.onUpdateCallback({ ...this.state });
  }

  public stopTrip(): LiveTripState {
    if (this.watchId !== null && typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    this.state.isActive = false;
    const finalState = { ...this.state };
    this.state = this.getInitialState();
    return finalState;
  }

  public getState(): LiveTripState {
    return { ...this.state };
  }
}

export const liveTripTracker = new LiveTripTracker();
