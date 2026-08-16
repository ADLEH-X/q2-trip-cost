'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useJsApiLoader } from '@react-google-maps/api';
import TripForm from '@/components/Forms/TripForm';
import RouteCards from '@/components/Results/RouteCards';
import Map from '@/components/Map/Map';
import VehicleSetup from '@/components/Settings/VehicleSetup';
import RecentTrips from '@/components/Results/RecentTrips';
import { VehicleSettings, RouteCalculation, TripCostCalculation, FuelPriceInfo, LiveTripState } from '@/lib/providers/interfaces';
import { routingProvider } from '@/lib/providers/googleRoutesAdapter';
import { fuelPriceProvider } from '@/lib/providers/fuelPrice';
import { calculateOneWayCost, rankAlternativeRoutes } from '@/lib/calculations';
import { storage } from '@/lib/storage';
import { getTranslation, Language } from '@/lib/translations';
import { liveTripTracker } from '@/lib/services/liveTripTracker';
import { Settings, Moon, Sun, AlertTriangle, Play, Square, Pause, RotateCcw, Navigation2 } from 'lucide-react';

const libraries: ("places" | "geometry")[] = ["places", "geometry"];

function getLocalizedFuelSource(source: string, language: Language): string {
  if (source.includes('OPET') && source.includes('Avrupa')) {
    return getTranslation(language, 'sourceOpetEurope');
  }
  if (source.includes('OPET') && source.includes('Anadolu')) {
    return getTranslation(language, 'sourceOpetAnatolia');
  }
  if (source.includes('doviz.com')) {
    return getTranslation(language, 'sourceDovizFallback');
  }
  if (source.includes('Sabit')) {
    return getTranslation(language, 'sourceEstimated');
  }
  if (source.includes('Demo')) {
    return getTranslation(language, 'sourceDemo');
  }
  return source;
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">Loading...</div>}>
      <AppContent />
    </Suspense>
  );
}

function AppContent() {
  const searchParams = useSearchParams();
  const [vehicleSettings, setVehicleSettings] = useState<VehicleSettings | null>(null);
  const [fuelPrice, setFuelPrice] = useState<FuelPriceInfo | null>(null);
  const [routeResults, setRouteResults] = useState<{ calcs: TripCostCalculation[]; routes: RouteCalculation[] } | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isRoundTripActive, setIsRoundTripActive] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [language, setLanguage] = useState<Language>('tr');
  const [recentTrips, setRecentTrips] = useState<any[]>([]);
  const [liveTripState, setLiveTripState] = useState<LiveTripState>(liveTripTracker.getState());

  // Google Maps JS API loader
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries
  });

  const apiKeyMissing = !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Initialize theme from storage
  useEffect(() => {
    const savedTheme = storage.getTheme();
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // Initialize language from storage
  useEffect(() => {
    const savedLang = storage.getLanguage();
    setLanguage(savedLang);
  }, []);

  // Load recent trips on mount
  useEffect(() => {
    setRecentTrips(storage.getRecentTrips());
  }, []);

  const toggleLanguage = () => {
    const nextLang = language === 'tr' ? 'en' : 'tr';
    setLanguage(nextLang);
    storage.saveLanguage(nextLang);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    storage.saveTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // Initial load: settings and fuel price
  useEffect(() => {
    const settings = storage.getVehicleSettings();
    setVehicleSettings(settings);

    // Initial fuel price fetch
    fuelPriceProvider.getCurrentPrice('EUROPE', settings.fuelType).then(setFuelPrice);
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
      const outboundRoutes = await routingProvider.calculateRoutes(originId, destinationId, undefined, vehicleSettings);
      
      if (outboundRoutes.length > 0) {
        let calcs = outboundRoutes.map(r => calculateOneWayCost(r, vehicleSettings, fuelPrice, 0));
        calcs = rankAlternativeRoutes(calcs, outboundRoutes);
        
        if (isRoundTrip) {
          const returnRoutes = await routingProvider.calculateRoutes(destinationId, originId, undefined, vehicleSettings);
          if (returnRoutes.length > 0) {
            let returnCalcs = returnRoutes.map(r => calculateOneWayCost(r, vehicleSettings, fuelPrice, 0));
            returnCalcs = rankAlternativeRoutes(returnCalcs, returnRoutes);
            const bestReturn = returnCalcs[0]; 
            
            calcs = calcs.map(c => {
              const combinedFuelLiters = c.fuelLiters + bestReturn.fuelLiters;
              const combinedFuelCostTRY = c.fuelCostTRY + bestReturn.fuelCostTRY;
              const combinedTollCostTRY = c.tollCostTRY + bestReturn.tollCostTRY;
              const combinedTotalTRY = combinedFuelCostTRY + combinedTollCostTRY + c.manualAdjustmentTRY;
              
              const totalDistanceKm = (c.estimationDetails?.trafficSegments.totalKm || 0) + (bestReturn.estimationDetails?.trafficSegments.totalKm || 0);
              const combinedEstimatedCons = totalDistanceKm > 0 ? (combinedFuelLiters / totalDistanceKm) * 100 : c.estimationDetails?.estimatedConsumptionL100km || vehicleSettings.consumptionL100km;
              
              return {
                ...c,
                fuelLiters: combinedFuelLiters,
                fuelCostTRY: combinedFuelCostTRY,
                tollCostTRY: combinedTollCostTRY,
                totalOneWayTRY: combinedTotalTRY,
                estimationDetails: c.estimationDetails ? {
                  ...c.estimationDetails,
                  estimatedFuelLiters: parseFloat(combinedFuelLiters.toFixed(3)),
                  estimatedConsumptionL100km: parseFloat(combinedEstimatedCons.toFixed(2)),
                  trafficSegments: {
                    normalKm: parseFloat(((c.estimationDetails.trafficSegments.normalKm || 0) + (bestReturn.estimationDetails?.trafficSegments.normalKm || 0)).toFixed(1)),
                    slowKm: parseFloat(((c.estimationDetails.trafficSegments.slowKm || 0) + (bestReturn.estimationDetails?.trafficSegments.slowKm || 0)).toFixed(1)),
                    jamKm: parseFloat(((c.estimationDetails.trafficSegments.jamKm || 0) + (bestReturn.estimationDetails?.trafficSegments.jamKm || 0)).toFixed(1)),
                    totalKm: parseFloat(totalDistanceKm.toFixed(1)),
                  }
                } : undefined,
              };
            });
          }
        }

        setRouteResults({ calcs, routes: outboundRoutes });
        setSelectedRouteId(calcs[0].routeId);

        // Save trip to recent history
        if (originText && destinationText) {
          storage.addRecentTrip({
            originText,
            destinationText,
            originPlaceId: originId,
            destinationPlaceId: destinationId,
            date: new Date().toISOString()
          });
          setRecentTrips(storage.getRecentTrips());
        }
      } else {
        alert(getTranslation(language, 'noDrivingRouteFound'));
      }
    } catch (e) {
      console.error(e);
      alert(getTranslation(language, 'failedToCalculateRoutes'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartLiveTrip = (route: RouteCalculation, calc: TripCostCalculation) => {
    const estimatedCons = calc.estimationDetails?.estimatedConsumptionL100km ?? vehicleSettings?.consumptionL100km ?? 6.0;
    liveTripTracker.startTrip(route.route, estimatedCons, (state) => {
      setLiveTripState({ ...state });
    });
  };

  const handleStopLiveTrip = () => {
    liveTripTracker.stopTrip();
    setLiveTripState(liveTripTracker.getState());
  };

  const activeRoute = routeResults?.routes.find(r => r.route.id === selectedRouteId) || routeResults?.routes[0];
  const activeCalc = routeResults?.calcs.find(c => c.routeId === selectedRouteId) || routeResults?.calcs[0];

  return (
    <main className="min-h-screen bg-transparent selection:bg-red-500 selection:text-white p-4 sm:p-6 md:p-8 flex flex-col items-center">
      
      {/* Demo Banner */}
      {searchParams.get('demo') === 'true' && (
        <div className="w-full max-w-5xl mb-4 py-2 px-4 bg-gradient-to-r from-red-600 to-amber-600 text-white text-xs font-bold uppercase tracking-widest text-center rounded-xl shadow-lg shadow-red-900/20">
          {getTranslation(language, 'demoModeActive')}
        </div>
      )}

      {/* Header */}
      <header className="w-full max-w-5xl flex items-center justify-between py-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500 font-bold text-sm shadow-[0_0_15px_rgba(220,38,38,0.2)]">
            Q2
          </div>
          <div>
            <h1 className="font-light tracking-wider text-xl text-neutral-100 flex items-center gap-2">
              {vehicleSettings?.carModel || 'Audi Q2'} <span className="font-semibold text-xs tracking-widest text-neutral-400 uppercase">{getTranslation(language, 'appTitle')}</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Toggle */}
          <button 
            onClick={toggleLanguage}
            className="px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-xs font-bold tracking-wider text-neutral-400 hover:text-white uppercase"
            title={language === 'tr' ? 'Switch to English' : 'Türkçeye geç'}
            aria-label={language === 'tr' ? 'Switch to English' : 'Türkçeye geç'}
          >
            {language === 'tr' ? 'EN' : 'TR'}
          </button>

          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-neutral-400 hover:text-white"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Settings */}
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-neutral-400 hover:text-white relative group"
            title={getTranslation(language, 'settings')}
            aria-label={getTranslation(language, 'settings')}
          >
            <Settings size={18} className="transition-transform group-hover:rotate-45" />
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        
        {/* Left Column */}
        <div className="flex flex-col gap-6 w-full">
          <div className="backdrop-blur-xl bg-white/[0.02] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-6 relative">
            
            {apiKeyMissing && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2.5 text-xs text-amber-300">
                <AlertTriangle size={16} className="shrink-0 text-amber-400" />
                <span>{getTranslation(language, 'apiKeyMissingWarning')}</span>
              </div>
            )}

            {loadError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2.5 text-xs text-red-300">
                <AlertTriangle size={16} className="shrink-0 text-red-400" />
                <span>{getTranslation(language, 'mapLoadError')}</span>
              </div>
            )}

            <TripForm 
              onSubmit={handleTripSubmit} 
              isLoading={isLoading} 
              isLoaded={isLoaded}
              language={language}
            />

            {/* Recent Trips Section */}
            {!routeResults && recentTrips.length > 0 && (
              <RecentTrips
                trips={recentTrips}
                onSelect={(trip) => handleTripSubmit(trip.originPlaceId, trip.destinationPlaceId, isRoundTripActive, trip.originText, trip.destinationText)}
                onClear={() => {
                  storage.clearRecentTrips();
                  setRecentTrips([]);
                }}
                language={language}
              />
            )}

            {/* Fuel Price Bar */}
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

            {/* Live Trip Tracker Active Card */}
            {liveTripState.isActive && (
              <div className="p-4 bg-red-600/10 border border-red-500/30 rounded-2xl flex flex-col gap-3 shadow-lg shadow-red-950/20 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                    <span className="text-xs font-bold uppercase tracking-widest text-red-400">
                      {getTranslation(language, 'liveTrip')}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-neutral-400">
                    {Math.floor(liveTripState.elapsedSeconds / 60)}m {liveTripState.elapsedSeconds % 60}s
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-black/30 p-2 rounded-xl">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500 block">{getTranslation(language, 'distanceTraveled')}</span>
                    <span className="text-sm font-semibold text-white">{liveTripState.distanceTraveledKm.toFixed(1)} km</span>
                  </div>
                  <div className="bg-black/30 p-2 rounded-xl">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500 block">{getTranslation(language, 'fuelUsedSoFar')}</span>
                    <span className="text-sm font-semibold text-white">{liveTripState.estimatedFuelUsedLiters.toFixed(2)} L</span>
                  </div>
                  <div className="bg-black/30 p-2 rounded-xl">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500 block">{getTranslation(language, 'currentSpeed')}</span>
                    <span className="text-sm font-semibold text-white">{liveTripState.currentSpeedKmh.toFixed(0)} km/h</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={handleStopLiveTrip}
                    className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <Square size={12} /> {getTranslation(language, 'endTrip')}
                  </button>
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
                    onStartLiveTrip={() => activeRoute && activeCalc && handleStartLiveTrip(activeRoute, activeCalc)}
                    isLiveTripActive={liveTripState.isActive}
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
             onStartLiveTrip={() => activeRoute && activeCalc && handleStartLiveTrip(activeRoute, activeCalc)}
             isLiveTripActive={liveTripState.isActive}
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

function TripDetailsCard({
  activeCalc,
  activeRoute,
  isRoundTripActive,
  vehicleSettings,
  language,
  onStartLiveTrip,
  isLiveTripActive,
}: any) {
  if (!activeCalc || !activeRoute) return null;

  const estimatedCons = activeCalc.estimationDetails?.estimatedConsumptionL100km ?? vehicleSettings?.consumptionL100km;
  const trafficImpact = activeCalc.estimationDetails?.trafficImpactPercentage ?? 0;
  const isLiveTraffic = activeCalc.estimationDetails?.dataQuality === 'HIGH' || activeCalc.estimationDetails?.dataQuality === 'MEDIUM';

  return (
    <div className="backdrop-blur-xl bg-black/40 rounded-3xl p-7 shadow-2xl border border-white/10 flex flex-col gap-3 transition-all w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-light text-xl tracking-wide text-white">{getTranslation(language, 'tripDetails')}</h2>
        {isLiveTraffic && (
          <span 
            className="text-[11px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded-full"
            title={getTranslation(language, 'trafficInfoTooltip')}
          >
            {getTranslation(language, 'trafficAdjusted')}
          </span>
        )}
      </div>

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
          <span className="text-neutral-500 uppercase text-xs tracking-widest font-bold">{getTranslation(language, 'estimatedConsumption')}</span>
          <div className="flex flex-col">
            <span className="font-medium text-neutral-200 text-lg">
              {estimatedCons} <span className="text-sm opacity-50">{getTranslation(language, 'consumptionUnit')}</span>
            </span>
            <span className="text-[11px] text-neutral-500 tracking-wide">
              {getTranslation(language, 'wltpAverage')}: {vehicleSettings?.consumptionL100km} {getTranslation(language, 'consumptionUnit')}
              {trafficImpact > 0 ? ` (+${trafficImpact.toFixed(0)}%)` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Start Live Trip Button */}
      {!isLiveTripActive && onStartLiveTrip && (
        <div className="mt-4 pt-3 border-t border-white/10">
          <button
            onClick={onStartLiveTrip}
            className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all group"
          >
            <Navigation2 size={14} className="text-red-500 group-hover:scale-110 transition-transform" />
            <span>{getTranslation(language, 'startTrip')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
