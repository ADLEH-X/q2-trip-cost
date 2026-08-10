'use client';

import React, { useState, useEffect } from 'react';
import TripForm from '@/components/Forms/TripForm';
import RouteCards from '@/components/Results/RouteCards';
import VehicleSetup from '@/components/Settings/VehicleSetup';
import Map from '@/components/Map/Map';
import AudiLogo from '@/components/UI/AudiLogo';
import { Settings, AlertTriangle } from 'lucide-react';
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

  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  useEffect(() => {
    setLanguage(storage.getLanguage());
    const vs = storage.getVehicleSettings();
    setVehicleSettings(vs);
    if (!vs || vs.consumptionL100km === 0) {
      setShowSettings(true); 
    }
    fuelPriceProvider.getCurrentPrice().then(setFuelPrice);
  }, []);

  const handleTripSubmit = async (originId: string, destinationId: string, isRoundTrip: boolean) => {
    if (!vehicleSettings || !fuelPrice) return;
    
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
            }));
          }
        }

        setRouteResults({ calcs, routes: outboundRoutes });
        setSelectedRouteId(calcs[0].routeId); 
      } else {
        setRouteResults(null);
        alert('No driving route found');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to calculate routes. Check API keys.');
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
          DEMO MODE ACTIVE
        </div>
      )}
      <div className="w-full sm:max-w-md md:max-w-4xl grid md:grid-cols-2 gap-6 mt-4">
        
        {/* Left Column */}
        <div className="flex flex-col gap-6 w-full">
          
          {/* Header */}
          <div className="px-6 py-5 rounded-b-3xl sm:rounded-3xl backdrop-blur-xl bg-black/40 border border-white/10 shadow-2xl flex items-center justify-between sticky top-0 z-40 sm:static transition-all">
            <div className="flex items-center gap-3">
              <div className="text-white">
                <AudiLogo className="w-14 h-6 opacity-90" />
              </div>
              <div className="h-6 w-px bg-white/20 mx-1"></div>
              <h1 className="font-light text-lg tracking-wide text-neutral-200">Trip Cost</h1>
            </div>
            <button 
              onClick={() => setShowSettings(true)}
              className="text-neutral-400 hover:text-white transition-colors p-2.5 rounded-full hover:bg-white/10 backdrop-blur-sm"
            >
              <Settings size={22} strokeWidth={1.5} />
            </button>
          </div>

          <div className="px-4 sm:px-0 flex flex-col gap-5">
            {apiKeyMissing && (
              <div className="bg-amber-50 text-amber-700 p-3 rounded-xl flex gap-2 items-start text-sm border border-amber-200">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" /> 
                <p>Google Maps API Key is missing. The UI is running in visual mock mode.</p>
              </div>
            )}
            {loadError && !apiKeyMissing && (
              <div className="bg-red-50 text-red-700 p-3 rounded-xl flex gap-2 items-center text-sm border border-red-200">
                <AlertTriangle size={16} /> Google Maps failed to load. Please check your API key restrictions.
              </div>
            )}
            <TripForm 
              language={language}
              isLoaded={isLoaded}
              onSubmit={handleTripSubmit}
              isLoading={isLoading}
              isMockFallback={apiKeyMissing || !!loadError}
            />

            {fuelPrice && (
              <div className="backdrop-blur-md bg-white/5 rounded-2xl px-5 py-4 flex items-center justify-between text-xs text-neutral-400 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => setShowSettings(true)}>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-white text-sm tracking-wide">
                    {fuelPrice.priceTRYPerLiter.toFixed(2)} TL/L <span className="opacity-50 font-normal">({(fuelPrice as any).fuelType === 'diesel' ? 'Diesel' : 'Petrol'})</span>
                  </span>
                  <span className={`text-[10px] ${fuelPrice.status === 'CACHED_STALE' ? 'text-amber-500' : 'text-neutral-500'} tracking-wider uppercase`}>
                    Data: {fuelPrice.source} • {new Date(fuelPrice.retrievedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-[10px] uppercase tracking-widest font-bold text-red-500 hover:text-red-400 transition-colors">
                  {getTranslation(language, 'change')}
                </div>
              </div>
            )}
            
            <div className="md:hidden h-56 w-full rounded-2xl overflow-hidden border border-white/10 shadow-lg">
              <Map polyline={activeRoute?.route.polyline} isLoaded={isLoaded} isMockFallback={apiKeyMissing || !!loadError} />
            </div>

            {routeResults && (
              <div className="mt-4 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
                <h3 className="font-light tracking-wide text-neutral-400 mb-4 ml-1 uppercase text-xs">Alternative Routes</h3>
                <RouteCards 
                  calculations={routeResults.calcs}
                  routes={routeResults.routes}
                  selectedRouteId={selectedRouteId}
                  onSelectRoute={setSelectedRouteId}
                  language={language}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="hidden md:flex flex-col gap-6 sticky top-6 h-[calc(100vh-3rem)]">
           <div className="flex-1 rounded-3xl overflow-hidden border border-white/10 shadow-2xl ring-1 ring-white/5 relative group">
             <Map polyline={activeRoute?.route.polyline} isLoaded={isLoaded} isMockFallback={apiKeyMissing || !!loadError} />
             <div className="absolute inset-0 pointer-events-none ring-inset ring-1 ring-white/10 rounded-3xl transition-opacity group-hover:opacity-50"></div>
           </div>
           
           {activeCalc && activeRoute && (
             <div className="backdrop-blur-xl bg-black/40 rounded-3xl p-7 shadow-2xl border border-white/10 flex flex-col gap-3 transition-all">
               <h3 className="font-light text-xl tracking-wide text-white">Trip Details</h3>
               <div className="grid grid-cols-2 gap-y-6 gap-x-4 text-sm mt-3">
                 <div className="flex flex-col gap-1">
                   <span className="text-neutral-500 uppercase text-[10px] tracking-widest font-bold">Distance</span>
                   <span className="font-medium text-neutral-200 text-lg">{activeRoute.route.distanceKm.toFixed(1)} <span className="text-sm opacity-50">km</span></span>
                 </div>
                 <div className="flex flex-col gap-1">
                   <span className="text-neutral-500 uppercase text-[10px] tracking-widest font-bold">Duration</span>
                   <span className="font-medium text-neutral-200 text-lg">{activeRoute.route.trafficDurationMins} <span className="text-sm opacity-50">mins</span></span>
                 </div>
                 <div className="flex flex-col gap-1">
                   <span className="text-neutral-500 uppercase text-[10px] tracking-widest font-bold">Fuel Used</span>
                   <span className="font-medium text-neutral-200 text-lg">{activeCalc.fuelLiters.toFixed(2)} <span className="text-sm opacity-50">L</span></span>
                 </div>
                 <div className="flex flex-col gap-1">
                   <span className="text-neutral-500 uppercase text-[10px] tracking-widest font-bold">Consumption</span>
                   <span className="font-medium text-neutral-200 text-lg">{vehicleSettings?.consumptionL100km} <span className="text-sm opacity-50">L/100km</span></span>
                 </div>
               </div>
             </div>
           )}
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
