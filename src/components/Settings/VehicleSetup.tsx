'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSettings(storage.getVehicleSettings());
  }, []);

  // Focus trap and Escape handler
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Focus first focusable element
    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusables = dialog.querySelectorAll<HTMLElement>(focusableSelector);
    if (focusables.length > 0) focusables[0].focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const focusableEls = dialog.querySelectorAll<HTMLElement>(focusableSelector);
        if (focusableEls.length === 0) return;
        const first = focusableEls[0];
        const last = focusableEls[focusableEls.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!settings) return null;

  const handleSave = () => {
    storage.saveVehicleSettings(settings);
    onSave(settings);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={dialogRef} className="bg-[#111] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 text-neutral-500 hover:text-white transition-colors"
          aria-label={getTranslation(language, 'save') === 'Save' ? 'Close settings' : 'Ayarları kapat'}
        >
          <X size={20} />
        </button>
        
        <h2 id="settings-dialog-title" className="text-xl font-light text-white mb-6">{settings.carModel || getTranslation(language, 'vehicle')} {getTranslation(language, 'settings')}</h2>
        
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-neutral-400">
              {getTranslation(language, 'vehicleModel')}
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
                {getTranslation(language, 'consumption')} ({getTranslation(language, 'consumptionUnit')})
              </label>
              <span className="text-xs text-neutral-500 uppercase tracking-widest font-bold">{getTranslation(language, 'wltpAverage')}</span>
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
