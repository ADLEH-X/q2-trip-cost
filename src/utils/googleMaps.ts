import { RouteInfo } from '@/lib/providers/interfaces';

export function buildDirectionsUrl(route: RouteInfo): string {
  if (!route.originPlaceId || !route.destinationPlaceId) {
    return 'https://www.google.com/maps/dir/?api=1';
  }

  const baseUrl = 'https://www.google.com/maps/dir/?api=1';
  const origin = `&origin=Origin&origin_place_id=${route.originPlaceId}`;
  const destination = `&destination=Destination&destination_place_id=${route.destinationPlaceId}`;
  const mode = '&travelmode=driving';

  let waypoints = '';
  const label = route.label.toLowerCase();
  
  if (label.includes('eurasia') || label.includes('avrasya')) {
    waypoints = '&waypoints=Eurasia+Tunnel';
  } else if (label.includes('15 temmuz')) {
    waypoints = '&waypoints=15+Temmuz+Sehitler+Bridge';
  } else if (label.includes('fsm') || label.includes('fatih sultan')) {
    waypoints = '&waypoints=Fatih+Sultan+Mehmet+Bridge';
  } else if (label.includes('osmangazi')) {
    waypoints = '&waypoints=Osmangazi+Bridge';
  } else if (label.includes('canakkale') || label.includes('çanakkale') || label.includes('1915')) {
    waypoints = '&waypoints=1915+Canakkale+Bridge';
  }

  return `${baseUrl}${origin}${destination}${waypoints}${mode}`;
}
