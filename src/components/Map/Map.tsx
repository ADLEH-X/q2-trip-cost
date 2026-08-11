'use client';

import React, { useEffect, useState } from 'react';
import { GoogleMap, Polyline, Marker, TrafficLayer } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '100%'
};

// Default center: Istanbul
const defaultCenter = {
  lat: 41.0082,
  lng: 28.9784
};

import { RouteInfo } from '@/lib/providers/interfaces';

interface MapProps {
  activeRoute?: RouteInfo;
  isLoaded: boolean;
  isMockFallback?: boolean;
}

export default function Map({ activeRoute, isLoaded = true, isMockFallback }: MapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [decodedPath, setDecodedPath] = useState<google.maps.LatLng[]>([]);
  const polylinesRef = React.useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    // Clear old polylines from the map immediately
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    if (activeRoute?.polyline && typeof google !== 'undefined') {
      const path = google.maps.geometry.encoding.decodePath(activeRoute.polyline);
      setDecodedPath(path);

      if (map && path.length > 0) {
        // Draw the new segmented polylines manually to bypass buggy React wrappers
        if (activeRoute.trafficIntervals && activeRoute.trafficIntervals.length > 0) {
          activeRoute.trafficIntervals.forEach((interval) => {
            const segmentPath = path.slice(interval.startPointIndex, interval.endPointIndex + 1);
            let color = '#3b82f6';
            let zIndex = 1;
            if (interval.speed === 'SLOW') { color = '#f59e0b'; zIndex = 2; }
            else if (interval.speed === 'TRAFFIC_JAM') { color = '#ef4444'; zIndex = 3; }

            const polyline = new google.maps.Polyline({
              path: segmentPath,
              strokeColor: color,
              strokeOpacity: 1.0,
              strokeWeight: 6,
              zIndex: zIndex,
              map: map
            });
            polylinesRef.current.push(polyline);
          });
        } else {
          const polyline = new google.maps.Polyline({
            path: path,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.8,
            strokeWeight: 6,
            map: map
          });
          polylinesRef.current.push(polyline);
        }

        const bounds = new google.maps.LatLngBounds();
        path.forEach(p => bounds.extend(p));
        map.fitBounds(bounds);
        
        // Add a small padding
        const padding = { top: 50, bottom: 50, left: 50, right: 50 };
        map.fitBounds(bounds, padding);
      }
    } else {
      setDecodedPath([]);
    }
    
    // Cleanup on unmount or route change
    return () => {
      polylinesRef.current.forEach(p => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [activeRoute?.polyline, activeRoute?.trafficIntervals, map]);

  const onLoad = React.useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = React.useCallback(function callback() {
    setMap(null);
  }, []);

  if (!isLoaded) return <div className="w-full h-full bg-neutral-200 animate-pulse rounded-2xl"></div>;

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden relative border border-neutral-200/50 shadow-inner">
      {typeof google !== 'undefined' ? (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={defaultCenter}
          zoom={11}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            styles: [
              {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }]
              }
            ] // A bit cleaner
          }}
        >
          {decodedPath.length > 0 && (
            <>
              <TrafficLayer />
              <Marker position={decodedPath[0]} label="A" />
              <Marker position={decodedPath[decodedPath.length - 1]} label="B" />
            </>
          )}
        </GoogleMap>
      ) : (
        <div className="w-full h-full bg-neutral-100 flex items-center justify-center text-neutral-500">
          Map Loading...
        </div>
      )}
    </div>
  );
}
