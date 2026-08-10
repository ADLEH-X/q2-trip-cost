'use client';

import React from 'react';
import { TripCostCalculation, RouteCalculation } from '@/lib/providers/interfaces';
import { getTranslation, Language } from '@/lib/translations';
import { Zap, CheckCircle2, Fuel, Coins } from 'lucide-react';
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
}

export default function RouteCards({ calculations, routes, selectedRouteId, onSelectRoute, language }: RouteCardsProps) {
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
                <span className="font-medium text-white text-lg tracking-wide">{route.label || `Route ${idx + 1}`}</span>
                <span className="text-xs text-neutral-400 font-light">
                  {route.distanceKm.toFixed(1)} km • {route.trafficDurationMins} min
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xl font-light tracking-tight ${isSelected ? 'text-red-500' : 'text-white'}`}>
                  {calc.totalOneWayTRY.toFixed(0)} <span className="text-sm opacity-50">TL</span>
                </span>
              </div>
            </div>

            <div className="flex gap-2 mb-4 relative z-10">
              {calc.isCheapest && (
                <span className="flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <CheckCircle2 size={12} /> {getTranslation(language, 'cheapest')}
                </span>
              )}
              {calc.isFastest && (
                <span className="flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full border border-blue-500/20">
                  <Zap size={12} /> {getTranslation(language, 'fastest')}
                </span>
              )}
              {calc.isTollFree && (
                <span className="flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase bg-white/10 text-neutral-300 px-2.5 py-1 rounded-full border border-white/10">
                  {getTranslation(language, 'tollFree')}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10 text-xs relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 flex items-center gap-1.5"><Fuel size={14} /> Fuel</span>
                <span className="font-medium text-neutral-300">{calc.fuelCostTRY.toFixed(0)} TL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 flex items-center gap-1.5"><Coins size={14} /> Toll</span>
                <span className="font-medium text-neutral-300">{calc.tollCostTRY.toFixed(0)} TL</span>
              </div>
            </div>
            
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
