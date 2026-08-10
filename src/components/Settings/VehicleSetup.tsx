'use client';

import React, { useState, useEffect } from 'react';
import { VehicleSettings } from '@/lib/providers/interfaces';
import { storage } from '@/lib/storage';
import { getTranslation, Language } from '@/lib/translations';
import { X } from 'lucide-react';

interface VehicleSetupProps {
  language: Language;
  onSave: (settings: VehicleSettings) => void;
  onClose: () => void;
}

export default function VehicleSetup({ language, onSave, onClose }: VehicleSetupProps) {
  const [settings, setSettings] = useState<VehicleSettings | null>(null);

  useEffect(() => {
    setSettings(storage.getVehicleSettings());
  }, []);

  if (!settings) return null;

  const handleSave = () => {
    storage.saveVehicleSettings(settings);
    onSave(settings);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#111] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 text-neutral-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
        
        <h2 className="text-xl font-light text-white mb-6">{settings.carModel || 'Vehicle'} Settings</h2>
        
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-neutral-400">
              Vehicle Model
            </label>
            <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
              <button
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${settings.carModel !== 'Hyundai i20 2025' ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'text-neutral-400 hover:text-white hover:bg-white/5'}`}
                onClick={() => setSettings({...settings, carModel: 'Audi Q2', fuelType: 'petrol', consumptionL100km: 5.4})}
              >
                Audi Q2
              </button>
              <button
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${settings.carModel === 'Hyundai i20 2025' ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'text-neutral-400 hover:text-white hover:bg-white/5'}`}
                onClick={() => setSettings({...settings, carModel: 'Hyundai i20 2025', fuelType: 'petrol', consumptionL100km: 5.3})}
              >
                Hyundai i20
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-neutral-400">
              {getTranslation(language, 'fuelType')}
            </label>
            <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
              <button
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${settings.fuelType === 'petrol' ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'text-neutral-400 hover:text-white hover:bg-white/5'}`}
                onClick={() => setSettings({...settings, fuelType: 'petrol', consumptionL100km: settings.carModel === 'Hyundai i20 2025' ? 5.3 : 5.4})}
              >
                {getTranslation(language, 'petrol')}
              </button>
              <button
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${settings.fuelType === 'diesel' ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'text-neutral-400 hover:text-white hover:bg-white/5'}`}
                onClick={() => setSettings({...settings, fuelType: 'diesel', consumptionL100km: settings.carModel === 'Hyundai i20 2025' ? 4.5 : 6.0})}
              >
                {getTranslation(language, 'diesel')}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-end">
              <label className="text-sm font-medium text-neutral-400">
                {getTranslation(language, 'consumption')} (L/100km)
              </label>
              <span className="text-[10px] text-neutral-600 uppercase tracking-widest font-bold">WLTP Average</span>
            </div>
            <input 
              type="number"
              step="0.1"
              value={settings.consumptionL100km}
              onChange={(e) => setSettings({...settings, consumptionL100km: parseFloat(e.target.value) || 0})}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition-all text-white placeholder:text-neutral-600 font-light"
            />
          </div>

          <button 
            onClick={handleSave}
            className="w-full bg-white hover:bg-neutral-200 text-black font-bold uppercase tracking-widest text-sm py-3.5 rounded-xl transition-all duration-300 mt-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            {getTranslation(language, 'save')}
          </button>
        </div>
      </div>
    </div>
  );
}
