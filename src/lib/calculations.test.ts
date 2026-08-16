import { describe, it, expect } from 'vitest';
import { calculateOneWayCost, rankAlternativeRoutes } from './calculations';
import {
  RouteCalculation,
  VehicleSettings,
  FuelPriceInfo,
  RouteInfo,
} from './providers/interfaces';
import {
  estimateRealWorldConsumption,
  calculateTrafficSegmentDistances,
} from './services/fuelConsumptionEstimator';
import { buildDirectionsUrl, decodePolyline } from '../utils/googleMaps';

describe('Traffic-Aware Fuel Consumption Estimator', () => {
  const petrolQ2: VehicleSettings = {
    carModel: 'Audi Q2',
    fuelType: 'petrol',
    powertrain: 'petrol',
    consumptionL100km: 6.0,
    tollClass: 1,
  };

  const hybridCar: VehicleSettings = {
    carModel: 'Hybrid Vehicle',
    fuelType: 'petrol',
    powertrain: 'full_hybrid',
    consumptionL100km: 4.5,
    tollClass: 1,
  };

  const testFuelPrice: FuelPriceInfo = {
    priceTRYPerLiter: 40.0,
    currency: 'TRY',
    source: 'Test',
    retrievedAt: new Date().toISOString(),
    status: 'LIVE',
  };

  // Helper polyline
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

  const samplePolyline = encodePoly([
    { lat: 40.990, lng: 29.030 },
    { lat: 41.000, lng: 29.020 },
    { lat: 41.010, lng: 29.010 },
    { lat: 41.020, lng: 29.000 },
    { lat: 41.030, lng: 28.990 },
    { lat: 41.040, lng: 28.980 },
  ]);

  // 1. Completely Free-Flow Route
  it('1. completely free-flow route uses baseline consumption with zero traffic penalty', () => {
    const freeFlowRoute: RouteInfo = {
      id: 'free-flow-1',
      label: 'Via Highway Free Flow',
      distanceKm: 30,
      durationMins: 25,
      trafficDurationMins: 25,
      polyline: samplePolyline,
      trafficIntervals: [{ startPointIndex: 0, endPointIndex: 5, speed: 'NORMAL' }],
      warnings: [],
    };

    const result = estimateRealWorldConsumption({ route: freeFlowRoute, vehicle: petrolQ2 });
    expect(result.estimatedConsumptionL100km).toBe(6.0);
    expect(result.trafficImpactPercentage).toBe(0);
    expect(result.trafficSegments.normalKm).toBe(30);
    expect(result.trafficSegments.slowKm).toBe(0);
    expect(result.trafficSegments.jamKm).toBe(0);
    expect(result.dataQuality).toBe('LIVE_TRAFFIC');
  });

  // 2. Moderately Congested Route
  it('2. moderately congested route applies moderate traffic penalty', () => {
    const moderateRoute: RouteInfo = {
      id: 'moderate-1',
      label: 'Via Coastal Road Moderate Traffic',
      distanceKm: 20,
      durationMins: 20,
      trafficDurationMins: 28,
      polyline: samplePolyline,
      trafficIntervals: [
        { startPointIndex: 0, endPointIndex: 2, speed: 'NORMAL' },
        { startPointIndex: 3, endPointIndex: 5, speed: 'SLOW' },
      ],
      warnings: [],
    };

    const result = estimateRealWorldConsumption({ route: moderateRoute, vehicle: petrolQ2 });
    expect(result.estimatedConsumptionL100km).toBeGreaterThan(6.0);
    expect(result.trafficImpactPercentage).toBeGreaterThan(5);
    expect(result.trafficImpactPercentage).toBeLessThan(35);
    expect(result.trafficSegments.slowKm).toBeGreaterThan(0);
  });

  // 3. Severe Stop-and-Go Traffic
  it('3. severe stop-and-go traffic applies substantial fuel increase', () => {
    const heavyJamRoute: RouteInfo = {
      id: 'jam-1',
      label: 'Via Bridge Heavy Congestion',
      distanceKm: 18,
      durationMins: 22,
      trafficDurationMins: 55,
      polyline: samplePolyline,
      trafficIntervals: [
        { startPointIndex: 0, endPointIndex: 1, speed: 'NORMAL' },
        { startPointIndex: 2, endPointIndex: 5, speed: 'TRAFFIC_JAM' },
      ],
      warnings: [],
    };

    const result = estimateRealWorldConsumption({ route: heavyJamRoute, vehicle: petrolQ2 });
    expect(result.estimatedConsumptionL100km).toBeGreaterThan(7.5);
    expect(result.trafficImpactPercentage).toBeGreaterThan(30);
    expect(result.trafficSegments.jamKm).toBeGreaterThan(0);
  });

  // 4. Same Vehicle on Two Alternative Routes (Congested Short vs Free-Flow Longer)
  it('4. same vehicle on two alternative routes shows longer flowing route has better consumption rate', () => {
    // Route A: 15 km, heavy traffic jam
    const routeA: RouteCalculation = {
      route: {
        id: 'alt-a',
        label: 'Route A (Short but Stalled)',
        distanceKm: 15,
        durationMins: 18,
        trafficDurationMins: 50,
        polyline: samplePolyline,
        trafficIntervals: [{ startPointIndex: 0, endPointIndex: 5, speed: 'TRAFFIC_JAM' }],
        warnings: [],
      },
      toll: { totalTRY: 0, currency: 'TRY', status: 'LIVE', providerName: 'KGM', retrievedAt: '' },
    };

    // Route B: 22 km, completely free flow on highway
    const routeB: RouteCalculation = {
      route: {
        id: 'alt-b',
        label: 'Route B (Longer but Free Flow)',
        distanceKm: 22,
        durationMins: 20,
        trafficDurationMins: 20,
        polyline: samplePolyline,
        trafficIntervals: [{ startPointIndex: 0, endPointIndex: 5, speed: 'NORMAL' }],
        warnings: [],
      },
      toll: { totalTRY: 0, currency: 'TRY', status: 'LIVE', providerName: 'KGM', retrievedAt: '' },
    };

    const calcA = calculateOneWayCost(routeA, petrolQ2, testFuelPrice, 0);
    const calcB = calculateOneWayCost(routeB, petrolQ2, testFuelPrice, 0);

    // Route A should have higher L/100km consumption rate than Route B
    expect(calcA.estimationDetails!.estimatedConsumptionL100km).toBeGreaterThan(
      calcB.estimationDetails!.estimatedConsumptionL100km
    );
  });

  // 5. Petrol vs Hybrid Under Identical Traffic
  it('5. hybrid vehicle receives substantially smaller traffic congestion penalty than petrol', () => {
    const jammedRoute: RouteInfo = {
      id: 'jammed-test',
      label: 'Identical Heavy Jam',
      distanceKm: 15,
      durationMins: 18,
      trafficDurationMins: 45,
      polyline: samplePolyline,
      trafficIntervals: [{ startPointIndex: 0, endPointIndex: 5, speed: 'TRAFFIC_JAM' }],
      warnings: [],
    };

    const petrolResult = estimateRealWorldConsumption({ route: jammedRoute, vehicle: petrolQ2 });
    const hybridResult = estimateRealWorldConsumption({ route: jammedRoute, vehicle: hybridCar });

    expect(petrolResult.trafficImpactPercentage).toBeGreaterThan(hybridResult.trafficImpactPercentage);
  });

  // 6. Missing Traffic Data Fallback
  it('6. gracefully falls back to baseline when traffic data is unavailable without throwing', () => {
    const noTrafficRoute: RouteInfo = {
      id: 'no-traffic',
      label: 'Route with No Traffic Data',
      distanceKm: 25,
      durationMins: 20,
      trafficDurationMins: 20,
      polyline: '',
      warnings: [],
    };

    const result = estimateRealWorldConsumption({ route: noTrafficRoute, vehicle: petrolQ2 });
    expect(result.dataQuality).toBe('FALLBACK_BASELINE');
    expect(result.estimatedConsumptionL100km).toBe(6.0);
    expect(result.estimatedFuelLiters).toBe(1.5); // (25 * 6) / 100
  });

  // 7. Short Urban Trip Cold-Start Correction
  it('7. applies short-trip cold start correction on trips < 5km for combustion engines', () => {
    const shortTrip: RouteInfo = {
      id: 'short-1',
      label: 'Short 3km Trip',
      distanceKm: 3,
      durationMins: 8,
      trafficDurationMins: 8,
      polyline: samplePolyline,
      trafficIntervals: [{ startPointIndex: 0, endPointIndex: 5, speed: 'NORMAL' }],
      warnings: [],
    };

    const longTrip: RouteInfo = {
      id: 'long-1',
      label: 'Long 30km Trip',
      distanceKm: 30,
      durationMins: 25,
      trafficDurationMins: 25,
      polyline: samplePolyline,
      trafficIntervals: [{ startPointIndex: 0, endPointIndex: 5, speed: 'NORMAL' }],
      warnings: [],
    };

    const shortRes = estimateRealWorldConsumption({ route: shortTrip, vehicle: petrolQ2 });
    const longRes = estimateRealWorldConsumption({ route: longTrip, vehicle: petrolQ2 });

    expect(shortRes.shortTripFactor).toBeGreaterThan(1.0);
    expect(longRes.shortTripFactor).toBe(1.0);
    expect(shortRes.estimatedConsumptionL100km).toBeGreaterThan(longRes.estimatedConsumptionL100km);
  });

  // 8. Long Highway Trip
  it('8. long highway trip maintains steady baseline consumption', () => {
    const highwayTrip: RouteInfo = {
      id: 'hwy-1',
      label: 'O-7 Northern Marmara Highway',
      distanceKm: 85,
      durationMins: 55,
      trafficDurationMins: 55,
      polyline: samplePolyline,
      trafficIntervals: [{ startPointIndex: 0, endPointIndex: 5, speed: 'NORMAL' }],
      warnings: [],
    };

    const res = estimateRealWorldConsumption({ route: highwayTrip, vehicle: petrolQ2 });
    expect(res.estimatedConsumptionL100km).toBe(6.0);
    expect(res.trafficSegments.normalKm).toBe(85);
  });

  // 9. Round Trip with Differing Outbound and Return Traffic
  it('9. calculates outbound and return trips independently for round trips', () => {
    const outboundRoute: RouteCalculation = {
      route: {
        id: 'outbound',
        label: 'Outbound Morning Rush',
        distanceKm: 20,
        durationMins: 20,
        trafficDurationMins: 50,
        polyline: samplePolyline,
        trafficIntervals: [{ startPointIndex: 0, endPointIndex: 5, speed: 'TRAFFIC_JAM' }],
        warnings: [],
      },
      toll: { totalTRY: 50, currency: 'TRY', status: 'LIVE', providerName: '', retrievedAt: '' },
    };

    const returnRoute: RouteCalculation = {
      route: {
        id: 'return',
        label: 'Return Evening Free Flow',
        distanceKm: 20,
        durationMins: 20,
        trafficDurationMins: 20,
        polyline: samplePolyline,
        trafficIntervals: [{ startPointIndex: 0, endPointIndex: 5, speed: 'NORMAL' }],
        warnings: [],
      },
      toll: { totalTRY: 50, currency: 'TRY', status: 'LIVE', providerName: '', retrievedAt: '' },
    };

    const outCalc = calculateOneWayCost(outboundRoute, petrolQ2, testFuelPrice, 0);
    const retCalc = calculateOneWayCost(returnRoute, petrolQ2, testFuelPrice, 0);

    expect(outCalc.fuelLiters).toBeGreaterThan(retCalc.fuelLiters);
    expect(outCalc.fuelCostTRY).toBeGreaterThan(retCalc.fuelCostTRY);

    const totalRoundTripFuelLiters = outCalc.fuelLiters + retCalc.fuelLiters;
    expect(totalRoundTripFuelLiters).toBeGreaterThan(2.4); // 40km * 6.0 / 100 = 2.4L baseline
  });

  // 10. User-Calibrated Consumption vs Manufacturer-Only Estimate
  it('10. uses user dashboard average to calibrate baseline and adjusts for traffic', () => {
    const calibratedVehicle: VehicleSettings = {
      ...petrolQ2,
      personalAverageConsumption: 8.0, // Owner knows their real average is 8.0 L/100km
    };

    const routeWithTraffic: RouteInfo = {
      id: 'traffic-1',
      label: 'Traffic Route',
      distanceKm: 20,
      durationMins: 20,
      trafficDurationMins: 35,
      polyline: samplePolyline,
      trafficIntervals: [{ startPointIndex: 0, endPointIndex: 5, speed: 'SLOW' }],
      warnings: [],
    };

    const standardRes = estimateRealWorldConsumption({ route: routeWithTraffic, vehicle: petrolQ2 });
    const calibratedRes = estimateRealWorldConsumption({
      route: routeWithTraffic,
      vehicle: calibratedVehicle,
    });

    expect(standardRes.officialConsumptionL100km).toBe(6.0);
    expect(calibratedRes.officialConsumptionL100km).toBe(6.0);
    expect(calibratedRes.estimatedConsumptionL100km).toBeGreaterThan(8.0);
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
    { lat: 40.990, lng: 29.030 },
    { lat: 40.995, lng: 29.015 },
    { lat: 41.0028, lng: 29.0016 }, // Tunnel
    { lat: 41.006, lng: 28.980 }, // Kennedy Cd. coast
    { lat: 41.018, lng: 28.985 }, // Karakoy coast
    { lat: 41.042, lng: 28.985 }, // Besiktas
  ]);

  const polyEurasiaInland = encodePoly([
    { lat: 40.990, lng: 29.030 },
    { lat: 40.995, lng: 29.015 },
    { lat: 41.0028, lng: 29.0016 }, // Tunnel
    { lat: 41.018, lng: 28.945 }, // D100 inland / Vatan Cd.
    { lat: 41.035, lng: 28.955 }, // Halic
    { lat: 41.042, lng: 28.985 }, // Besiktas
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

    const wp1 = new URL(url1).searchParams.get('waypoints');
    const wp2 = new URL(url2).searchParams.get('waypoints');
    expect(wp1).not.toBe(wp2);
  });

  it('formats up to 3 waypoints in route order separated by %7C', () => {
    const allRoutes = [routeEurasia1, routeEurasia2];
    const url = buildDirectionsUrl(routeEurasia1, { allRoutes });

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
