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

interface MapProps {
  polyline?: string;
  isLoaded: boolean;
  isMockFallback?: boolean;
}

export default function Map({ polyline, isLoaded = true, isMockFallback }: MapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [decodedPath, setDecodedPath] = useState<google.maps.LatLng[]>([]);

  useEffect(() => {
    if (polyline && typeof google !== 'undefined') {
      const path = google.maps.geometry.encoding.decodePath(polyline);
      setDecodedPath(path);

      if (map && path.length > 0) {
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
  }, [polyline, map]);

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
              <Polyline
                path={decodedPath}
                options={{
                  strokeColor: '#ef4444',
                  strokeOpacity: 0.8,
                  strokeWeight: 5,
                }}
              />
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
