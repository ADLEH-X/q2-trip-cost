import { RouteInfo } from '@/lib/providers/interfaces';

/**
 * Key corridor crossing coordinates in Turkey.
 * Using precise coordinates on the bridge deck or tunnel interior ensures Google Maps
 * routes through the desired corridor without creating separate destination stops.
 */
export const WAYPOINT_COORDINATES = {
  eurasia: { lat: 41.0028, lng: 29.0016, name: 'Eurasia Tunnel' },
  fsm: { lat: 41.0911, lng: 29.0558, name: 'Fatih Sultan Mehmet Bridge' },
  bridge15July: { lat: 41.0456, lng: 29.0343, name: '15 Temmuz Bridge' },
  yss: { lat: 41.2028, lng: 29.1119, name: 'Yavuz Sultan Selim Bridge' },
  osmangazi: { lat: 40.7540, lng: 29.5180, name: 'Osmangazi Bridge' },
  canakkale: { lat: 40.3370, lng: 26.6340, name: '1915 Canakkale Bridge' },
} as const;

/**
 * Fast, self-contained Google Encoded Polyline endpoint decoder.
 * Extracts the exact first (origin) and last (destination) coordinates from a polyline.
 */
export function decodePolylineEndpoints(encoded?: string): {
  origin?: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
} {
  if (!encoded || typeof encoded !== 'string') return {};
  
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  let firstPoint: { lat: number; lng: number } | undefined;
  let lastPoint: { lat: number; lng: number } | undefined;

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

    const pt = { lat: lat / 1e5, lng: lng / 1e5 };
    if (!firstPoint) firstPoint = pt;
    lastPoint = pt;
  }

  return { origin: firstPoint, destination: lastPoint };
}

/**
 * Determines if a route requires a waypoint to preserve the user-selected corridor,
 * and returns the precise waypoint coordinates string ("lat,lng") or null.
 */
export function getRouteWaypoint(routeLabel?: string): string | null {
  if (!routeLabel) return null;
  const label = routeLabel.toLowerCase();

  // 1. Eurasia Tunnel
  if (label.includes('eurasia') || label.includes('avrasya')) {
    return `${WAYPOINT_COORDINATES.eurasia.lat.toFixed(6)},${WAYPOINT_COORDINATES.eurasia.lng.toFixed(6)}`;
  }

  // 2. FSM Bridge
  if (label.includes('fsm') || label.includes('fatih sultan')) {
    return `${WAYPOINT_COORDINATES.fsm.lat.toFixed(6)},${WAYPOINT_COORDINATES.fsm.lng.toFixed(6)}`;
  }

  // 3. 15 Temmuz Bridge
  if (label.includes('15 temmuz') || label.includes('bosphorus') || label.includes('boğaziçi') || label.includes('bogazici')) {
    return `${WAYPOINT_COORDINATES.bridge15July.lat.toFixed(6)},${WAYPOINT_COORDINATES.bridge15July.lng.toFixed(6)}`;
  }

  // 4. Yavuz Sultan Selim Bridge (YSS / 3. Köprü)
  if (label.includes('yavuz sultan') || label.includes('yss')) {
    return `${WAYPOINT_COORDINATES.yss.lat.toFixed(6)},${WAYPOINT_COORDINATES.yss.lng.toFixed(6)}`;
  }

  // 5. Osmangazi Bridge
  if (label.includes('osmangazi') || label.includes('körfez') || label.includes('korfez')) {
    return `${WAYPOINT_COORDINATES.osmangazi.lat.toFixed(6)},${WAYPOINT_COORDINATES.osmangazi.lng.toFixed(6)}`;
  }

  // 6. 1915 Çanakkale Bridge
  if (label.includes('canakkale') || label.includes('çanakkale') || label.includes('1915')) {
    return `${WAYPOINT_COORDINATES.canakkale.lat.toFixed(6)},${WAYPOINT_COORDINATES.canakkale.lng.toFixed(6)}`;
  }

  // Toll-free, direct, or generic highway routes do NOT need a waypoint
  return null;
}

/**
 * Builds the official Google Maps Directions URL format:
 * https://www.google.com/maps/dir/?api=1&origin=ORIGIN&destination=DESTINATION&travelmode=driving&dir_action=navigate
 *
 * Uses latitude/longitude coordinates whenever available, encodes all parameters with encodeURIComponent(),
 * and adds waypoints only when needed for specific bridge/tunnel crossings.
 */
export function buildDirectionsUrl(route: RouteInfo): string {
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

  // 4. Direction Action (Directly triggers turn-by-turn or route navigation)
  queryParts.push(`dir_action=${encodeURIComponent('navigate')}`);

  // 5. Waypoints (Only if specific corridor/crossing is needed to preserve user route)
  const waypoint = getRouteWaypoint(route.label);
  if (waypoint) {
    queryParts.push(`waypoints=${encodeURIComponent(waypoint)}`);
  }

  return `${baseUrl}&${queryParts.join('&')}`;
}
