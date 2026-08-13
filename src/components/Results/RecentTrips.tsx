'use client';

import React from 'react';
import { Clock, X, MapPin } from 'lucide-react';
import { getTranslation, Language } from '@/lib/translations';

interface TripRecord {
  originText: string;
  destinationText: string;
  originPlaceId: string;
  destinationPlaceId: string;
  date: string;
}

interface RecentTripsProps {
  trips: TripRecord[];
  onSelect: (trip: TripRecord) => void;
  onClear: () => void;
  language: Language;
}

function shortenAddress(address: string): string {
  const parts = address.split(',');
  const first = parts[0].trim();
  return first.length > 28 ? first.substring(0, 26) + '…' : first;
}

function timeAgo(dateString: string, language: Language): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return getTranslation(language, 'justNow');
  if (mins < 60) return `${mins} ${getTranslation(language, 'minutesAgo')}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${getTranslation(language, 'hoursAgo')}`;
  const days = Math.floor(hours / 24);
  return `${days} ${getTranslation(language, 'daysAgo')}`;
}

export default function RecentTrips({ trips, onSelect, onClear, language }: RecentTripsProps) {
  if (!trips || trips.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-bold tracking-widest uppercase text-neutral-500 flex items-center gap-1.5">
          <Clock size={12} /> {getTranslation(language, 'recentTrips')}
        </span>
        <button
          onClick={onClear}
          className="text-[10px] font-bold tracking-widest uppercase text-neutral-600 hover:text-red-500 transition-colors flex items-center gap-1"
          title={getTranslation(language, 'clearHistoryTitle')}
        >
          <X size={10} /> {getTranslation(language, 'clearHistory')}
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {trips.slice(0, 5).map((trip, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(trip)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/15 transition-all text-left group"
          >
            <div className="shrink-0 w-8 h-8 rounded-full bg-red-600/10 flex items-center justify-center">
              <MapPin size={14} className="text-red-500" />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="text-sm text-white font-medium truncate">
                {shortenAddress(trip.originText)} → {shortenAddress(trip.destinationText)}
              </span>
              <span className="text-[10px] text-neutral-500 tracking-wide">
                {timeAgo(trip.date, language)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
