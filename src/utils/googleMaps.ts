import { RouteInfo } from '@/lib/providers/interfaces';

export interface Point {
  lat: number;
  lng: number;
}

export interface BuildDirectionsUrlOptions {
  allRoutes?: RouteInfo[];
  isTollFree?: boolean;
}

/**
 * Key corridor crossing coordinates in Turkey (used as fallbacks if polyline is unavailable).
 */
export const WAYPOINT_COORDINATES: Record<string, Point & { name: string }> = {
  eurasia: { lat: 41.0028, lng: 29.0016, name: 'Eurasia Tunnel' },
  fsm: { lat: 41.0911, lng: 29.0558, name: 'Fatih Sultan Mehmet Bridge' },
  bridge15July: { lat: 41.0456, lng: 29.0343, name: '15 Temmuz Bridge' },
  yss: { lat: 41.2028, lng: 29.1119, name: 'Yavuz Sultan Selim Bridge' },
  osmangazi: { lat: 40.7540, lng: 29.5180, name: 'Osmangazi Bridge' },
  canakkale: { lat: 40.3370, lng: 26.6340, name: '1915 Canakkale Bridge' },
};

/**
 * Full Google Encoded Polyline decoder.
 * Converts an encoded polyline string into an array of {lat, lng} points.
 */
export function decodePolyline(encoded?: string): Point[] {
  if (!encoded || typeof encoded !== 'string') return [];
  const points: Point[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

/**
 * Extracts the exact first (origin) and last (destination) coordinates from a polyline.
 */
export function decodePolylineEndpoints(encoded?: string): {
  origin?: Point;
  destination?: Point;
} {
  const points = decodePolyline(encoded);
  if (points.length === 0) return {};
  return { origin: points[0], destination: points[points.length - 1] };
}

/**
 * Approximate squared Euclidean distance between two coordinates in degrees.
 */
function distanceSq(p1: Point, p2: Point): number {
  const dLat = p1.lat - p2.lat;
  const dLng = (p1.lng - p2.lng) * Math.cos((((p1.lat + p2.lat) / 2) * Math.PI) / 180);
  return dLat * dLat + dLng * dLng;
}

/**
 * Finds minimum distance from a point to a polyline with adaptive sampling.
 */
function minDistanceToPolyline(p: Point, polyline: Point[]): number {
  if (polyline.length === 0) return 0;
  let minD = Infinity;
  const step = polyline.length > 600 ? Math.ceil(polyline.length / 300) : 1;
  for (let i = 0; i < polyline.length; i += step) {
    const d = distanceSq(p, polyline[i]);
    if (d < minD) minD = d;
  }
  return Math.sqrt(minD);
}

/**
 * Returns fixed corridor coordinates if route label mentions a specific major crossing.
 * Only matches explicit crossing names — avoids loose keywords like 'körfez'
 * that can appear in Istanbul junction names and cause false positives.
 */
export function getCorridorPoint(routeLabel?: string): Point | null {
  if (!routeLabel) return null;
  const label = routeLabel.toLowerCase();

  if (label.includes('eurasia') || label.includes('avrasya')) return WAYPOINT_COORDINATES.eurasia;
  if (label.includes('fsm') || label.includes('fatih sultan')) return WAYPOINT_COORDINATES.fsm;
  if (label.includes('15 temmuz') || label.includes('bosphorus') || label.includes('boğaziçi') || label.includes('bogazici')) {
    return WAYPOINT_COORDINATES.bridge15July;
  }
  if (label.includes('yavuz sultan') || label.includes('yss')) return WAYPOINT_COORDINATES.yss;
  if (label.includes('osmangazi bridge') || label.includes('osmangazi köprüsü')) return WAYPOINT_COORDINATES.osmangazi;
  if (label.includes('canakkale') || label.includes('çanakkale') || label.includes('1915')) return WAYPOINT_COORDINATES.canakkale;

  return null;
}

/**
 * Extracts up to 3 route-shaping waypoints from the selected route's actual decoded polyline.
 * Prefers points where the selected route diverges most from other alternative routes,
 * preserving route order (origin -> destination).
 */
export function extractRouteShapingWaypoints(
  selectedRoute: RouteInfo,
  allRoutes?: RouteInfo[],
  isTollFree?: boolean
): Point[] {
  const points = decodePolyline(selectedRoute.polyline);

  // If polyline has insufficient points, use corridor fallback if applicable
  if (points.length < 3) {
    const corridor = getCorridorPoint(selectedRoute.label);
    return corridor ? [corridor] : [];
  }

  // Identify other distinct alternative routes for divergence comparison
  const otherRoutes = (allRoutes || []).filter(
    (r) => r.id !== selectedRoute.id && r.polyline && r.polyline !== selectedRoute.polyline
  );
  const otherPolylines = otherRoutes.map((r) => decodePolyline(r.polyline)).filter((pts) => pts.length > 0);

  // Focus candidate waypoints in the middle 84% of the route (excluding immediate origin/dest start & end)
  const minIdx = Math.max(1, Math.floor(points.length * 0.08));
  const maxIdx = Math.min(points.length - 2, Math.floor(points.length * 0.92));

  if (minIdx >= maxIdx) {
    return [points[Math.floor(points.length / 2)]];
  }

  // Score candidate points by their distance/divergence from other alternative routes
  const candidateIndices: number[] = [];
  const step = Math.max(1, Math.floor((maxIdx - minIdx) / 100)); // ~100 sample candidates
  for (let i = minIdx; i <= maxIdx; i += step) {
    candidateIndices.push(i);
  }

  const scoredPoints = candidateIndices.map((idx) => {
    const p = points[idx];
    let score = 0;
    if (otherPolylines.length > 0) {
      for (const otherPoly of otherPolylines) {
        score += minDistanceToPolyline(p, otherPoly);
      }
    }
    return { index: idx, point: p, score };
  });

  // Divide candidate corridor into 3 sequential segments (early, mid, late)
  const numSegments = 3;
  const segmentLength = (maxIdx - minIdx) / numSegments;
  const chosenPoints: { index: number; point: Point }[] = [];

  for (let seg = 0; seg < numSegments; seg++) {
    const segStart = minIdx + seg * segmentLength;
    const segEnd = minIdx + (seg + 1) * segmentLength;

    const segCandidates = scoredPoints.filter((sp) => sp.index >= segStart && sp.index <= segEnd);
    if (segCandidates.length === 0) continue;

    // Pick highest divergence point in this segment
    let best = segCandidates[0];
    for (let k = 1; k < segCandidates.length; k++) {
      if (segCandidates[k].score > best.score) {
        best = segCandidates[k];
      }
    }

    // If divergence score is 0 (e.g. no alternatives or perfectly overlapping segment), pick segment midpoint
    if (best.score === 0) {
      const midIdx = Math.floor(segCandidates.length / 2);
      best = segCandidates[midIdx];
    }

    chosenPoints.push({ index: best.index, point: best.point });
  }

  // Sort strictly by route order (origin -> destination)
  chosenPoints.sort((a, b) => a.index - b.index);

  // Filter out redundant points that are too close to each other (< ~300m)
  const waypoints: Point[] = [];
  for (const cp of chosenPoints) {
    const isDuplicate = waypoints.some((w) => distanceSq(w, cp.point) < 0.00005);
    if (!isDuplicate) {
      waypoints.push(cp.point);
    }
  }

  // If toll-free and label specifies a bridge/tunnel not used, ensure waypoint doesn't snap to toll
  // If route is toll-free or direct and allRoutes have no divergence, return up to 2-3 shaping points
  return waypoints.slice(0, 3);
}

/**
 * Builds the official Google Maps Directions URL format:
 * https://www.google.com/maps/dir/?api=1&origin=ORIGIN&destination=DESTINATION&travelmode=driving&dir_action=navigate&waypoints=WP1%7CWP2%7CWP3&avoid=tolls
 *
 * - Uses exact latitude/longitude coordinates for origin and destination whenever available.
 * - Encodes all parameters with encodeURIComponent().
 * - Extracts up to 3 route-shaping waypoints from the route's decoded polyline in route order, joined by %7C.
 * - Appends avoid=tolls for toll-free alternatives.
 * - Ensures a unique, well-shaped URL for every route card.
 */
export function buildDirectionsUrl(
  route: RouteInfo,
  options?: BuildDirectionsUrlOptions
): string {
  const baseUrl = 'https://www.google.com/maps/dir/?api=1';
  const queryParts: string[] = [];

  // 1. Resolve Origin (Prefer Lat/Lng coordinates)
  let originValue = '';
  if (route.originCoord && typeof route.originCoord.lat === 'number' && typeof route.originCoord.lng === 'number') {
    originValue = `${route.originCoord.lat.toFixed(6)},${route.originCoord.lng.toFixed(6)}`;
  } else if (route.polyline) {
    const endpoints = decodePolylineEndpoints(route.polyline);
    if (endpoints.origin) {
      originValue = `${endpoints.origin.lat.toFixed(6)},${endpoints.origin.lng.toFixed(6)}`;
    }
  }

  if (!originValue) {
    if (route.originText) {
      originValue = route.originText;
    } else {
      originValue = 'Origin';
    }
  }
  queryParts.push(`origin=${encodeURIComponent(originValue)}`);

  // Include origin place_id if available and valid
  if (route.originPlaceId && !route.originPlaceId.startsWith('mock_')) {
    queryParts.push(`origin_place_id=${encodeURIComponent(route.originPlaceId)}`);
  }

  // 2. Resolve Destination (Prefer Lat/Lng coordinates)
  let destinationValue = '';
  if (route.destinationCoord && typeof route.destinationCoord.lat === 'number' && typeof route.destinationCoord.lng === 'number') {
    destinationValue = `${route.destinationCoord.lat.toFixed(6)},${route.destinationCoord.lng.toFixed(6)}`;
  } else if (route.polyline) {
    const endpoints = decodePolylineEndpoints(route.polyline);
    if (endpoints.destination) {
      destinationValue = `${endpoints.destination.lat.toFixed(6)},${endpoints.destination.lng.toFixed(6)}`;
    }
  }

  if (!destinationValue) {
    if (route.destinationText) {
      destinationValue = route.destinationText;
    } else {
      destinationValue = 'Destination';
    }
  }
  queryParts.push(`destination=${encodeURIComponent(destinationValue)}`);

  // Include destination place_id if available and valid
  if (route.destinationPlaceId && !route.destinationPlaceId.startsWith('mock_')) {
    queryParts.push(`destination_place_id=${encodeURIComponent(route.destinationPlaceId)}`);
  }

  // 3. Travel Mode
  queryParts.push(`travelmode=${encodeURIComponent('driving')}`);

  // 4. Direction Action (Triggers navigation / route preview)
  queryParts.push(`dir_action=${encodeURIComponent('navigate')}`);

  // 5. Route-Shaping Waypoints (Up to 3 distinct coordinates in route order, joined by |)
  const isTollFree = options?.isTollFree ?? false;
  const waypoints = extractRouteShapingWaypoints(route, options?.allRoutes, isTollFree);

  if (waypoints.length > 0) {
    const waypointsParam = waypoints
      .map((w) => `${w.lat.toFixed(6)},${w.lng.toFixed(6)}`)
      .join('|');
    queryParts.push(`waypoints=${encodeURIComponent(waypointsParam)}`);
  }

  // 6. Avoid tolls parameter for toll-free route alternative
  if (isTollFree) {
    queryParts.push(`avoid=${encodeURIComponent('tolls')}`);
  }

  return `${baseUrl}&${queryParts.join('&')}`;
}
