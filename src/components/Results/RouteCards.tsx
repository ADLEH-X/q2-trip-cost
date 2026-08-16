'use client';
import { buildDirectionsUrl } from '@/utils/googleMaps';

import React from 'react';
import { TripCostCalculation, RouteCalculation } from '@/lib/providers/interfaces';
import { getTranslation, localizeRouteLabel, Language } from '@/lib/translations';
import { Zap, CheckCircle2, Fuel, Coins, Navigation, Info, Leaf, CloudRain, Sun } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface RouteCardsProps {
  calculations: TripCostCalculation[];
  routes: RouteCalculation[];
  selectedRouteId: string;
  onSelectRoute: (id: string) => void;
  language: Language;
  isRoundTripActive?: boolean;
}

export default function RouteCards({ calculations, routes, selectedRouteId, onSelectRoute, language, isRoundTripActive = false }: RouteCardsProps) {
  if (!calculations || calculations.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {calculations.map((calc, idx) => {
        const isSelected = selectedRouteId === calc.routeId;
        const route = routes.find(r => r.route.id === calc.routeId)?.route;
        
        if (!route) return null;
        
        return (
          <div
            key={calc.routeId}
            onClick={() => onSelectRoute(calc.routeId)}
            className={`
              relative p-5 rounded-3xl cursor-pointer transition-all duration-300 border backdrop-blur-xl overflow-hidden
              ${isSelected 
                ? 'bg-red-950/20 border-red-600 shadow-[0_0_30px_rgba(230,0,0,0.15)] transform scale-[1.02]' 
                : 'bg-black/40 border-white/5 hover:bg-white/5 hover:border-white/20'
              }
            `}
          >
            {isSelected && (
              <div className="absolute inset-0 bg-gradient-to-br from-red-600/10 to-transparent pointer-events-none"></div>
            )}
            
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-white text-lg tracking-wide">{localizeRouteLabel(route.label, language) || `${getTranslation(language, 'routeLabel')} ${idx + 1}`}</span>
                <span className="text-xs text-neutral-400 font-light">
                  {(route.distanceKm * (isRoundTripActive ? 2 : 1)).toFixed(1)} {getTranslation(language, 'km')} • {Number(route.trafficDurationMins) * (isRoundTripActive ? 2 : 1)} {getTranslation(language, 'min')}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xl font-light tracking-tight ${isSelected ? 'text-red-500' : 'text-white'}`}>
                  {calc.totalOneWayTRY.toFixed(0)} <span className="text-sm opacity-50">{getTranslation(language, 'currencyTRY')}</span>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3 relative z-10">
              {calc.isCheapest && (
                <span className="flex items-center gap-1 text-xs font-bold tracking-widest uppercase bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <CheckCircle2 size={12} /> {getTranslation(language, 'cheapest')}
                </span>
              )}
              {calc.isFastest && (
                <span className="flex items-center gap-1 text-xs font-bold tracking-widest uppercase bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full border border-blue-500/20">
                  <Zap size={12} /> {getTranslation(language, 'fastest')}
                </span>
              )}
              {calc.isLowestFuel && (
                <span className="flex items-center gap-1 text-xs font-bold tracking-widest uppercase bg-teal-500/10 text-teal-300 px-2.5 py-1 rounded-full border border-teal-500/20">
                  <Leaf size={12} /> {getTranslation(language, 'lowestFuel')}
                </span>
              )}
              {calc.isEcoRoute && !calc.isLowestFuel && (
                <span className="flex items-center gap-1 text-xs font-bold tracking-widest uppercase bg-green-500/10 text-green-300 px-2.5 py-1 rounded-full border border-green-500/20">
                  <Leaf size={12} /> {getTranslation(language, 'ecoRoute')}
                </span>
              )}
              {calc.isTollFree && (
                <span className="flex items-center gap-1 text-xs font-bold tracking-widest uppercase bg-white/10 text-neutral-300 px-2.5 py-1 rounded-full border border-white/10">
                  {getTranslation(language, 'tollFree')}
                </span>
              )}

              {/* Ambient Weather Indicator */}
              {route.weather && (
                <span 
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border bg-white/5 text-neutral-300 border-white/10"
                  title={`${route.weather.weatherDescription} (${route.weather.temperatureC}°C, ${route.weather.windSpeedKmh} km/h wind)`}
                >
                  {route.weather.isRainy ? (
                    <CloudRain size={11} className="text-blue-400 shrink-0" />
                  ) : (
                    <Sun size={11} className="text-amber-400 shrink-0" />
                  )}
                  <span>{route.weather.temperatureC}°C</span>
                </span>
              )}

              {/* Traffic Impact Indication */}
              {calc.estimationDetails && (
                <span 
                  className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${
                    calc.estimationDetails.trafficImpactPercentage >= 15
                      ? 'bg-red-500/10 text-red-400 border-red-500/20 font-medium'
                      : calc.estimationDetails.dataQuality === 'HIGH' || calc.estimationDetails.dataQuality === 'MEDIUM'
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                      : 'bg-white/5 text-neutral-400 border-white/10'
                  }`}
                  title={getTranslation(language, 'trafficInfoTooltip')}
                >
                  <Info size={11} className="opacity-70 shrink-0" />
                  <span>
                    {calc.estimationDetails.trafficImpactPercentage >= 15
                      ? `${getTranslation(language, 'heavyTraffic')} +${calc.estimationDetails.trafficImpactPercentage.toFixed(0)}%`
                      : calc.estimationDetails.dataQuality === 'HIGH' || calc.estimationDetails.dataQuality === 'MEDIUM'
                      ? getTranslation(language, 'trafficAdjusted')
                      : getTranslation(language, 'officialConsumption')}
                  </span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10 text-xs relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 flex items-center gap-1.5"><Fuel size={14} /> {getTranslation(language, 'fuel')}</span>
                <div className="flex flex-col items-end">
                  <span className="font-medium text-neutral-300">{calc.fuelCostTRY.toFixed(0)} {getTranslation(language, 'currencyTRY')}</span>
                  {calc.estimationDetails && (
                    <span className="text-[11px] text-neutral-500">
                      ~{calc.estimationDetails.estimatedConsumptionL100km} {getTranslation(language, 'consumptionUnit')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 flex items-center gap-1.5"><Coins size={14} /> {getTranslation(language, 'tolls')}</span>
                <span className="font-medium text-neutral-300">{calc.tollCostTRY.toFixed(0)} {getTranslation(language, 'currencyTRY')}</span>
              </div>
            </div>
            {isSelected && (
              <a
                href={buildDirectionsUrl(route, {
                  allRoutes: routes.map((r) => r.route),
                  isTollFree: calc.isTollFree
                })}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 mt-3 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/10 hover:border-white/20 shadow-sm"
                title={getTranslation(language, 'openInMapsTitle')}
                aria-label={getTranslation(language, 'openInMapsTitle')}
              >
                <Navigation size={14} className="text-red-500 shrink-0" />
                <span>{getTranslation(language, 'openInMaps')}</span>
              </a>
            )}
            
            {calc.tollCostTRY === 0 && !calc.isTollFree && (
              <div className="mt-3 text-xs text-amber-500 bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/20 backdrop-blur-md">
                {getTranslation(language, 'tollUnavailable')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
