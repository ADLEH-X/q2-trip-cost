'use client';

import React, { useState, useRef } from 'react';
import { ArrowDownUp, MapPin, Navigation, Home } from 'lucide-react';
import { getTranslation, Language } from '@/lib/translations';
import { Autocomplete } from '@react-google-maps/api';

interface TripFormProps {
  language: Language;
  isLoaded: boolean;
  onSubmit: (originId: string, destinationId: string, isRoundTrip: boolean, originText: string, destinationText: string) => void;
  isLoading: boolean;
  isMockFallback?: boolean;
}

export default function TripForm({ language, isLoaded, onSubmit, isLoading, isMockFallback }: TripFormProps) {
  const [originText, setOriginText] = useState('');
  const [destinationText, setDestinationText] = useState('');
  const [originPlaceId, setOriginPlaceId] = useState('');
  const [destinationPlaceId, setDestinationPlaceId] = useState('');
  const [isRoundTrip, setIsRoundTrip] = useState(false);

  const originAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const destinationAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const handleSwap = () => {
    setOriginText(destinationText);
    setDestinationText(originText);
    const tempId = originPlaceId;
    setOriginPlaceId(destinationPlaceId);
    setDestinationPlaceId(tempId);
  };

  const handleSetHome = () => {
    const homeAddress = "Fit216 Sports Club & SPA, Dumlupınar, Barış Sk. No:45 D:2.Etap -2, 34720 Kadıköy/İstanbul";
    setOriginText(homeAddress);
    
    if (typeof window !== 'undefined' && window.google) {
      const service = new google.maps.places.PlacesService(document.createElement('div'));
      service.findPlaceFromQuery(
        { query: "Fit216 Sports Club & SPA Kadikoy", fields: ['place_id'] }, 
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            if (results[0].place_id) {
               setOriginPlaceId(results[0].place_id);
            }
          } else {
            console.error("Failed to find Place ID for Home address:", status);
          }
        }
      );
    }
  };
  const handleSetCurrentLocation = () => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          if (isLoaded && window.google) {
            const geocoder = new google.maps.Geocoder();
            const latlng = { lat: latitude, lng: longitude };
            geocoder.geocode({ location: latlng }, (results, status) => {
              if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
                setOriginText(results[0].formatted_address);
                if (results[0].place_id) {
                  setOriginPlaceId(results[0].place_id);
                }
              } else {
                console.error('Geocode error', status);
              }
            });
          }
        },
        (error) => {
          console.error('Geolocation error', error);
          alert(getTranslation(language, 'unableToRetrieveLocation'));
        }
      );
    } else {
      alert(getTranslation(language, 'geolocationNotSupported'));
    }
  };
  const onOriginLoad = (autocomplete: google.maps.places.Autocomplete) => {
    originAutocompleteRef.current = autocomplete;
    autocomplete.setComponentRestrictions({ country: 'TR' });
  };

  const onDestinationLoad = (autocomplete: google.maps.places.Autocomplete) => {
    destinationAutocompleteRef.current = autocomplete;
    autocomplete.setComponentRestrictions({ country: 'TR' });
  };

  const onOriginPlaceChanged = () => {
    if (originAutocompleteRef.current !== null) {
      const place = originAutocompleteRef.current.getPlace();
      if (place?.place_id && place?.formatted_address) {
        setOriginPlaceId(place.place_id);
        setOriginText(place.name ? `${place.name}, ${place.formatted_address}` : place.formatted_address);
      }
    }
  };

  const onDestinationPlaceChanged = () => {
    if (destinationAutocompleteRef.current !== null) {
      const place = destinationAutocompleteRef.current.getPlace();
      if (place?.place_id && place?.formatted_address) {
        setDestinationPlaceId(place.place_id);
        setDestinationText(place.name ? `${place.name}, ${place.formatted_address}` : place.formatted_address);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isMockFallback) {
      // Allow visual testing bypassing real Places IDs
      onSubmit('mock_origin_id', 'mock_destination_id', isRoundTrip, originText, destinationText);
      return;
    }
    
    if (!originPlaceId || !destinationPlaceId) {
      alert(getTranslation(language, 'selectValidLocations'));
      return;
    }
    onSubmit(originPlaceId, destinationPlaceId, isRoundTrip, originText, destinationText);
  };

  if (!isLoaded && !isMockFallback) return <div className="p-5 bg-white/5 backdrop-blur-xl rounded-3xl animate-pulse h-48 border border-white/5"></div>;

  const renderOriginInput = () => (
    <input
      type="text"
      placeholder={getTranslation(language, 'from')}
      value={originText}
      onChange={(e) => {
        setOriginText(e.target.value);
        if (!isMockFallback) setOriginPlaceId(''); 
      }}
      className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition-all text-white placeholder:text-neutral-500 font-light"
      required
    />
  );

  const renderDestinationInput = () => (
    <input
      type="text"
      placeholder={getTranslation(language, 'to')}
      value={destinationText}
      onChange={(e) => {
        setDestinationText(e.target.value);
        if (!isMockFallback) setDestinationPlaceId(''); 
      }}
      className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition-all text-white placeholder:text-neutral-500 font-light"
      required
    />
  );

  return (
    <div className="backdrop-blur-xl bg-black/40 rounded-3xl border border-white/10 p-5 w-full shadow-2xl relative overflow-hidden">
      {/* Decorative gradient orb */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 relative z-10">
        <div className="relative flex flex-col gap-3">
          
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 z-10">
              <Navigation size={18} strokeWidth={1.5} />
            </div>
            {isLoaded ? (
              <Autocomplete onLoad={onOriginLoad} onPlaceChanged={onOriginPlaceChanged} fields={['place_id', 'formatted_address', 'name']}>
                {renderOriginInput()}
              </Autocomplete>
            ) : renderOriginInput()}
            <button 
              type="button"
              onClick={handleSetHome}
              title={getTranslation(language, 'setToHome')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-red-500 p-2 hover:bg-red-500/10 rounded-xl transition-all z-10"
            >
              <Home size={18} />
            </button>
                      <button
              type="button"
              onClick={handleSetCurrentLocation}
              title={getTranslation(language, 'useCurrentLocation')}
              className="absolute right-10 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-red-500 p-2 hover:bg-red-500/10 rounded-xl transition-all z-10"
            >
              <Navigation size={18} />
            </button>
          </div>

          <button
            type="button"
            onClick={handleSwap}
            className="absolute left-7 top-1/2 -translate-y-1/2 -translate-x-1/2 bg-neutral-900 border border-white/10 rounded-full p-2 shadow-xl hover:bg-neutral-800 transition-all z-10 text-neutral-400 hover:text-red-500"
            aria-label={getTranslation(language, 'swapLocations')}
          >
            <ArrowDownUp size={16} strokeWidth={2} />
          </button>

          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-red-600 z-10">
              <MapPin size={18} strokeWidth={1.5} />
            </div>
            {isLoaded ? (
              <Autocomplete onLoad={onDestinationLoad} onPlaceChanged={onDestinationPlaceChanged} fields={['place_id', 'formatted_address', 'name']}>
                {renderDestinationInput()}
              </Autocomplete>
            ) : renderDestinationInput()}
          </div>
        </div>

        <div className="flex bg-white/5 border border-white/5 rounded-2xl p-1">
          <button
            type="button"
            onClick={() => setIsRoundTrip(false)}
            className={`flex-1 py-2.5 text-xs uppercase tracking-widest font-semibold rounded-xl transition-all duration-300 ${!isRoundTrip ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'}`}
          >
            {getTranslation(language, 'oneWay')}
          </button>
          <button
            type="button"
            onClick={() => setIsRoundTrip(true)}
            className={`flex-1 py-2.5 text-xs uppercase tracking-widest font-semibold rounded-xl transition-all duration-300 ${isRoundTrip ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'}`}
          >
            {getTranslation(language, 'roundTrip')}
          </button>
        </div>

        <button
          type="submit"
          disabled={isLoading || (!isMockFallback && (!originPlaceId || !destinationPlaceId))}
          className="w-full bg-white hover:bg-neutral-200 text-black font-bold uppercase tracking-widest text-sm py-4 rounded-2xl transition-all duration-300 disabled:bg-white/10 disabled:text-neutral-500 flex items-center justify-center mt-1 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]"
        >
          {isLoading ? (
            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            getTranslation(language, 'calculateCost')
          )}
        </button>
      </form>
    </div>
  );
}
