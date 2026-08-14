'use client';

import React, { useState, useEffect } from 'react';
import TripForm from '@/components/Forms/TripForm';
import RouteCards from '@/components/Results/RouteCards';
import RecentTrips from '@/components/Results/RecentTrips';
import VehicleSetup from '@/components/Settings/VehicleSetup';
import Map from '@/components/Map/Map';
import AudiLogo from '@/components/UI/AudiLogo';
import { Settings, AlertTriangle, Sun, Moon } from 'lucide-react';
import { useLoadScript } from '@react-google-maps/api';

import { routingProvider } from '@/lib/providers/googleRoutesAdapter';
import { fuelPriceProvider } from '@/lib/providers/fuelPrice';
import { 
  TripCostCalculation, 
  VehicleSettings, 
  RouteCalculation,
  FuelPriceInfo
} from '@/lib/providers/interfaces';
import { storage } from '@/lib/storage';
import { getTranslation, Language } from '@/lib/translations';
import { calculateOneWayCost, rankAlternativeRoutes } from '@/lib/calculations';

const LIBRARIES: ("places" | "geometry")[] = ["places", "geometry"];

function getLocalizedFuelSource(source: string, language: Language): string {
  if (!source) return '';
  const lower = source.toLowerCase();
  if (lower.includes('avrupa') || lower.includes('europe')) {
    return getTranslation(language, 'sourceOpetEurope');
  }
  if (lower.includes('anadolu') || lower.includes('anatolia')) {
    return getTranslation(language, 'sourceOpetAnatolia');
  }
  if (lower.includes('doviz') || lower.includes('döviz')) {
    return getTranslation(language, 'sourceDovizFallback');
  }
  if (lower.includes('tahmin') || lower.includes('estimated') || lower.includes('referans') || lower.includes('reference')) {
    return getTranslation(language, 'sourceEstimated');
  }
  if (lower.includes('demo')) {
    return getTranslation(language, 'sourceDemo');
  }
  return source;
}

// Wrapper component to only call useLoadScript if we have an API key.
// This prevents console errors when the user is testing the UI visually without an API key.
export default function Home() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  
  if (!apiKey) {
    return <AppContent isLoaded={false} loadError={new Error('No API Key')} apiKeyMissing={true} />;
  }

  return <AppWithMapLoader apiKey={apiKey} />;
}

function AppWithMapLoader({ apiKey }: { apiKey: string }) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
    region: 'TR',
  });

  return <AppContent isLoaded={isLoaded} loadError={loadError} apiKeyMissing={false} />;
}

function AppContent({ isLoaded, loadError, apiKeyMissing }: { isLoaded: boolean, loadError: Error | undefined, apiKeyMissing: boolean }) {
  const [language, setLanguage] = useState<Language>('tr');
  const [vehicleSettings, setVehicleSettings] = useState<VehicleSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  const [fuelPrice, setFuelPrice] = useState<FuelPriceInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [routeResults, setRouteResults] = useState<{ calcs: TripCostCalculation[], routes: RouteCalculation[] } | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [isRoundTripActive, setIsRoundTripActive] = useState<boolean>(false);
  const [tripHistory, setTripHistory] = useState<any[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  useEffect(() => {
    const savedLang = storage.getLanguage();
    setLanguage(savedLang);
    document.documentElement.lang = savedLang;
    const vs = storage.getVehicleSettings();
    setVehicleSettings(vs);
    if (!vs || vs.consumptionL100km === 0) {
      setShowSettings(true); 
    }
    fuelPriceProvider.getCurrentPrice('EUROPE', vs?.fuelType ?? 'petrol').then(setFuelPrice);
    setTripHistory(storage.getHistory());
    storage.applyTheme();
    setTheme(storage.getTheme());
  }, []);

  // Re-fetch fuel price whenever vehicle fuel type changes
  useEffect(() => {
    if (vehicleSettings) {
      fuelPriceProvider.getCurrentPrice('EUROPE', vehicleSettings.fuelType).then(setFuelPrice);
    }
  }, [vehicleSettings?.fuelType]);

  const handleTripSubmit = async (originId: string, destinationId: string, isRoundTrip: boolean, originText?: string, destinationText?: string) => {
    if (!vehicleSettings || !fuelPrice) return;
    
    setIsRoundTripActive(isRoundTrip);
    setIsLoading(true);
    try {
      const outboundRoutes = await routingProvider.calculateRoutes(originId, destinationId);
      
      if (outboundRoutes.length > 0) {
        let calcs = outboundRoutes.map(r => calculateOneWayCost(r, vehicleSettings, fuelPrice, 0));
        calcs = rankAlternativeRoutes(calcs, outboundRoutes);
        
        if (isRoundTrip) {
          const returnRoutes = await routingProvider.calculateRoutes(destinationId, originId);
          if (returnRoutes.length > 0) {
            let returnCalcs = returnRoutes.map(r => calculateOneWayCost(r, vehicleSettings, fuelPrice, 0));
            returnCalcs = rankAlternativeRoutes(returnCalcs, returnRoutes);
            const bestReturn = returnCalcs[0]; 
            
            calcs = calcs.map(c => ({
              ...c,
              fuelCostTRY: c.fuelCostTRY + bestReturn.fuelCostTRY,
              tollCostTRY: c.tollCostTRY + bestReturn.tollCostTRY,
              totalOneWayTRY: c.totalOneWayTRY + bestReturn.totalOneWayTRY,
              fuelLiters: c.fuelLiters + bestReturn.fuelLiters,
            }));
          }
        }

        setRouteResults({ calcs, routes: outboundRoutes });
        setSelectedRouteId(calcs[0].routeId);

        // Save to trip history
        if (originText && destinationText) {
          storage.saveToHistory({
            originText,
            destinationText,
            originPlaceId: originId,
            destinationPlaceId: destinationId,
          });
          setTripHistory(storage.getHistory());
        } 
      } else {
        setRouteResults(null);
        alert(getTranslation(language, 'noDrivingRouteFound'));
      }
    } catch (err) {
      console.error(err);
      alert(getTranslation(language, 'failedToCalculateRoutes'));
    } finally {
      setIsLoading(false);
    }
  };

  const activeRoute = routeResults?.routes.find(r => r.route.id === selectedRouteId);
  const activeCalc = routeResults?.calcs.find(c => c.routeId === selectedRouteId);

  return (
    <main className="min-h-screen text-neutral-100 flex flex-col sm:items-center sm:p-6 pb-20 selection:bg-red-500/30">
      {isDemo && (
        <div className="w-full bg-red-600 text-white font-bold text-center py-1.5 text-xs tracking-wider sticky top-0 z-50 shadow-md">
          {getTranslation(language, 'demoModeActive')}
        </div>
      )}
      <div className="w-full sm:max-w-md md:max-w-4xl grid md:grid-cols-2 gap-6 mt-4">
        
        {/* Left Column */}
        <div className="flex flex-col gap-6 w-full">
          
          {/* Header */}
          <div className="px-6 py-5 rounded-b-3xl sm:rounded-3xl backdrop-blur-xl bg-black/40 border border-white/10 shadow-2xl flex items-center justify-between sticky top-0 z-40 sm:static transition-all">
            <div className="flex items-center gap-3">
              <div className="text-white">
                {vehicleSettings?.carModel === 'Hyundai i20 2025' ? (
                   <span className="font-bold text-xl italic tracking-tighter">HYUNDAI</span>
                ) : (
                  <AudiLogo className="w-14 h-6 opacity-90" />
                )}
              </div>
              <div className="h-6 w-px bg-white/20 mx-1"></div>
              <h1 className="font-light text-lg tracking-wide text-neutral-200">{getTranslation(language, 'appTitle')}</h1>
            </div>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => {
                  const newLang = language === 'tr' ? 'en' : 'tr';
                  setLanguage(newLang);
                  storage.saveLanguage(newLang);
                  document.documentElement.lang = newLang;
                }}
                className="text-neutral-400 hover:text-white transition-colors px-2.5 py-1.5 rounded-full hover:bg-white/10 backdrop-blur-sm text-xs font-bold tracking-wider uppercase"
                title={language === 'tr' ? 'Switch to English' : 'Türkçeye geç'}
                aria-label={language === 'tr' ? 'Switch to English' : 'Türkçeye geç'}
              >
                {language === 'tr' ? '🇬🇧 EN' : '🇹🇷 TR'}
              </button>
              <button 
                onClick={() => {
                  const newTheme = theme === 'dark' ? 'light' : 'dark';
                  setTheme(newTheme);
                  storage.saveTheme(newTheme);
                }}
                className="text-neutral-400 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10 backdrop-blur-sm"
                title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              >
                {theme === 'dark' ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
              </button>
              <button 
                onClick={() => setShowSettings(true)}
                className="text-neutral-400 hover:text-white transition-colors p-2.5 rounded-full hover:bg-white/10 backdrop-blur-sm"
                aria-label={getTranslation(language, 'settings')}
              >
                <Settings size={22} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          <div className="px-4 sm:px-0 flex flex-col gap-5">
            {apiKeyMissing && (
              <div className="bg-amber-50 text-amber-700 p-3 rounded-xl flex gap-2 items-start text-sm border border-amber-200">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" /> 
                <p>{getTranslation(language, 'apiKeyMissingWarning')}</p>
              </div>
            )}
            {loadError && !apiKeyMissing && (
              <div className="bg-red-50 text-red-700 p-3 rounded-xl flex gap-2 items-center text-sm border border-red-200">
                <AlertTriangle size={16} /> {getTranslation(language, 'mapLoadError')}
              </div>
            )}
            <TripForm 
              language={language}
              isLoaded={isLoaded}
              onSubmit={handleTripSubmit}
              isLoading={isLoading}
              isMockFallback={apiKeyMissing || !!loadError}
            />

            <RecentTrips
              language={language}
              trips={tripHistory}
              onSelect={(trip) => {
                handleTripSubmit(trip.originPlaceId, trip.destinationPlaceId, false, trip.originText, trip.destinationText);
              }}
              onClear={() => {
                storage.clearHistory();
                setTripHistory([]);
              }}
            />


            {fuelPrice && (
              <div className="backdrop-blur-md bg-white/5 rounded-2xl px-5 py-4 border border-white/5 hover:bg-white/10 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${fuelPrice.status === 'LIVE' ? 'bg-emerald-400 animate-pulse' : fuelPrice.status === 'ESTIMATED' ? 'bg-amber-400' : 'bg-neutral-500'}`}></span>
                    <span className="text-xs uppercase tracking-widest text-neutral-500 font-bold">
                      {getLocalizedFuelSource(fuelPrice.source, language)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSettings(true)}
                    className="text-xs uppercase tracking-widest font-bold text-red-500 hover:text-red-400 transition-colors bg-transparent border-none cursor-pointer p-0"
                  >
                    {getTranslation(language, 'change')}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Benzin */}
                  <div className={`rounded-xl px-3 py-2.5 flex flex-col gap-0.5 border transition-colors ${vehicleSettings?.fuelType === 'petrol' ? 'bg-red-600/10 border-red-600/20' : 'bg-white/5 border-white/5'}`}>
                    <span className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">
                      {getTranslation(language, 'petrol')} 95
                    </span>
                    <span className={`text-base font-semibold tracking-tight ${vehicleSettings?.fuelType === 'petrol' ? 'text-white' : 'text-neutral-400'}`}>
                      {(fuelPrice.petrolPricePerLiter ?? fuelPrice.priceTRYPerLiter).toFixed(2)} <span className="text-xs opacity-60">TL/L</span>
                    </span>
                  </div>
                  {/* Motorin */}
                  <div className={`rounded-xl px-3 py-2.5 flex flex-col gap-0.5 border transition-colors ${vehicleSettings?.fuelType === 'diesel' ? 'bg-red-600/10 border-red-600/20' : 'bg-white/5 border-white/5'}`}>
                    <span className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">
                      {getTranslation(language, 'diesel')}
                    </span>
                    <span className={`text-base font-semibold tracking-tight ${vehicleSettings?.fuelType === 'diesel' ? 'text-white' : 'text-neutral-400'}`}>
                      {(fuelPrice.dieselPricePerLiter ?? fuelPrice.priceTRYPerLiter).toFixed(2)} <span className="text-xs opacity-60">TL/L</span>
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-neutral-500 tracking-wide">
                  {getTranslation(language, 'dataLabel')}: {new Date(fuelPrice.retrievedAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )}

            
            <div className="md:hidden h-56 w-full rounded-2xl overflow-hidden border border-white/10 shadow-lg">
              <Map activeRoute={activeRoute?.route} isLoaded={isLoaded} isMockFallback={apiKeyMissing || !!loadError} theme={theme} />
            </div>

            {routeResults && (
              <div className="mt-4 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out flex flex-col gap-6">
                <div>
                  <h2 className="font-light tracking-wide text-neutral-400 mb-4 ml-1 uppercase text-xs">{getTranslation(language, 'alternativeRoutes')}</h2>
                  <RouteCards 
                    calculations={routeResults.calcs}
                    routes={routeResults.routes}
                    selectedRouteId={selectedRouteId}
                    onSelectRoute={setSelectedRouteId}
                    language={language}
                    isRoundTripActive={isRoundTripActive}
                  />
                </div>
                
                {/* Mobile Trip Details */}
                <div className="md:hidden">
                  <TripDetailsCard 
                    activeCalc={activeCalc} 
                    activeRoute={activeRoute} 
                    isRoundTripActive={isRoundTripActive} 
                    vehicleSettings={vehicleSettings} 
                    language={language}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="hidden md:flex flex-col gap-6 sticky top-6 h-[calc(100vh-3rem)]">
           <div className="flex-1 rounded-3xl overflow-hidden border border-white/10 shadow-2xl ring-1 ring-white/5 relative group">
             <Map activeRoute={activeRoute?.route} isLoaded={isLoaded} isMockFallback={apiKeyMissing || !!loadError} theme={theme} />
             <div className="absolute inset-0 pointer-events-none ring-inset ring-1 ring-white/10 rounded-3xl transition-opacity group-hover:opacity-50"></div>
           </div>
           
           {/* Desktop Trip Details */}
           <TripDetailsCard 
             activeCalc={activeCalc} 
             activeRoute={activeRoute} 
             isRoundTripActive={isRoundTripActive} 
             vehicleSettings={vehicleSettings} 
             language={language}
           />
        </div>
      </div>

      {showSettings && (
        <VehicleSetup 
          language={language}
          onSave={setVehicleSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </main>
  );
}

function TripDetailsCard({ activeCalc, activeRoute, isRoundTripActive, vehicleSettings, language }: any) {
  if (!activeCalc || !activeRoute) return null;
  return (
    <div className="backdrop-blur-xl bg-black/40 rounded-3xl p-7 shadow-2xl border border-white/10 flex flex-col gap-3 transition-all w-full">
      <h2 className="font-light text-xl tracking-wide text-white">{getTranslation(language, 'tripDetails')}</h2>
      <div className="grid grid-cols-2 gap-y-6 gap-x-4 text-sm mt-3">
        <div className="flex flex-col gap-1">
          <span className="text-neutral-500 uppercase text-xs tracking-widest font-bold">{getTranslation(language, 'distance')}</span>
          <span className="font-medium text-neutral-200 text-lg">{(activeRoute.route.distanceKm * (isRoundTripActive ? 2 : 1)).toFixed(1)} <span className="text-sm opacity-50">{getTranslation(language, 'km')}</span></span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-neutral-500 uppercase text-xs tracking-widest font-bold">{getTranslation(language, 'duration')}</span>
          <div className="flex items-center gap-2">
            <span className="font-medium text-neutral-200 text-lg">{Number(activeRoute.route.trafficDurationMins) * (isRoundTripActive ? 2 : 1)} <span className="text-sm opacity-50">{getTranslation(language, 'mins')}</span></span>
            {(() => {
              const delay = (Number(activeRoute.route.trafficDurationMins) - Number(activeRoute.route.durationMins)) * (isRoundTripActive ? 2 : 1);
              if (delay >= 8) return <span className="text-xs font-bold bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20">+{delay} {getTranslation(language, 'minuteDelay')}</span>;
              if (delay >= 3) return <span className="text-xs font-bold bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">+{delay} {getTranslation(language, 'minuteDelay')}</span>;
              return <span className="text-xs font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">{getTranslation(language, 'trafficClear')}</span>;
            })()}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-neutral-500 uppercase text-xs tracking-widest font-bold">{getTranslation(language, 'fuelUsed')}</span>
          <span className="font-medium text-neutral-200 text-lg">{activeCalc.fuelLiters.toFixed(2)} <span className="text-sm opacity-50">{getTranslation(language, 'liters')}</span></span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-neutral-500 uppercase text-xs tracking-widest font-bold">{getTranslation(language, 'consumption')}</span>
          <span className="font-medium text-neutral-200 text-lg">{vehicleSettings?.consumptionL100km} <span className="text-sm opacity-50">{getTranslation(language, 'consumptionUnit')}</span></span>
        </div>
      </div>
    </div>
  );
}
