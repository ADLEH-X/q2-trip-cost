'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GoogleMap, Marker, TrafficLayer } from '@react-google-maps/api';
import { RouteInfo, LatLngLiteral } from '@/lib/providers/interfaces';
import { decodePolyline } from '@/utils/googleMaps';

const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  touchAction: 'manipulation',
};

// Default center: Istanbul
const defaultCenter: LatLngLiteral = {
  lat: 41.0082,
  lng: 28.9784,
};

interface MapProps {
  activeRoute?: RouteInfo;
  isLoaded: boolean;
  isMockFallback?: boolean;
  theme?: 'dark' | 'light';
  currentLocation?: LatLngLiteral | null;
}

const darkMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#2d2d44' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#4b5563' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1f1f35' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a40' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3b3b55' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1f1f35' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0f1a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#374151' }] },
];

const lightMapStyles = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9d6e3' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f0eeeb' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e0dcd7' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#d4cfc9' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
];

export default function Map({
  activeRoute,
  isLoaded = true,
  isMockFallback,
  theme = 'dark',
  currentLocation,
}: MapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [decodedPath, setDecodedPath] = useState<LatLngLiteral[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-resize handler for car screens, orientation changes & split-screen CarPlay
  useEffect(() => {
    if (!containerRef.current || !map || typeof google === 'undefined') return;

    const resizeObserver = new ResizeObserver(() => {
      google.maps.event.trigger(map, 'resize');
      if (decodedPath.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        decodedPath.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [map, decodedPath]);

  useEffect(() => {
    // Clear old polylines from the map immediately
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (activeRoute?.polyline) {
      const path = decodePolyline(activeRoute.polyline);
      setDecodedPath(path);

      if (map && typeof google !== 'undefined' && path.length > 0) {
        // Draw the new segmented polylines with live traffic coloring
        if (activeRoute.trafficIntervals && activeRoute.trafficIntervals.length > 0) {
          activeRoute.trafficIntervals.forEach((interval) => {
            const segmentPath = path.slice(interval.startPointIndex, interval.endPointIndex + 1);
            let color = '#3b82f6';
            let zIndex = 1;
            if (interval.speed === 'SLOW') {
              color = '#f59e0b';
              zIndex = 2;
            } else if (interval.speed === 'TRAFFIC_JAM') {
              color = '#ef4444';
              zIndex = 3;
            }

            const polyline = new google.maps.Polyline({
              path: segmentPath,
              strokeColor: color,
              strokeOpacity: 1.0,
              strokeWeight: 6,
              zIndex: zIndex,
              map: map,
            });
            polylinesRef.current.push(polyline);
          });
        } else {
          const polyline = new google.maps.Polyline({
            path: path,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.8,
            strokeWeight: 6,
            map: map,
          });
          polylinesRef.current.push(polyline);
        }

        const bounds = new google.maps.LatLngBounds();
        path.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
      }
    } else {
      setDecodedPath([]);
    }

    // Cleanup on unmount or route change
    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [activeRoute?.polyline, activeRoute?.trafficIntervals, map]);

  useEffect(() => {
    if (map) {
      map.setOptions({
        styles: theme === 'light' ? lightMapStyles : darkMapStyles,
      });
    }
  }, [theme, map]);

  const onLoad = useCallback(function callback(mapInstance: google.maps.Map) {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(function callback() {
    setMap(null);
  }, []);

  if (!isLoaded) {
    return <div className="w-full h-full bg-neutral-900/60 animate-pulse rounded-2xl"></div>;
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-2xl overflow-hidden relative border border-white/10 shadow-inner select-none"
      style={{ touchAction: 'manipulation' }}
    >
      {typeof google !== 'undefined' ? (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={currentLocation || defaultCenter}
          zoom={11}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: 'greedy', // 1-finger panning on car touchscreens
            clickableIcons: false, // Disables accidental business taps while driving
            keyboardShortcuts: false,
            styles: theme === 'light' ? lightMapStyles : darkMapStyles,
          }}
        >
          {decodedPath.length > 0 && (
            <>
              <TrafficLayer />
              <Marker position={decodedPath[0]} label="A" />
              <Marker position={decodedPath[decodedPath.length - 1]} label="B" />
            </>
          )}

          {/* Live Car / Driver Location Marker */}
          {currentLocation && (
            <Marker
              position={currentLocation}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#ef4444',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2.5,
              }}
              zIndex={999}
            />
          )}
        </GoogleMap>
      ) : (
        <div className="w-full h-full bg-neutral-900 flex items-center justify-center text-neutral-500 text-xs">
          Map Loading...
        </div>
      )}
    </div>
  );
}
