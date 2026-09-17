'use client';

import React, { useState, useEffect, useRef } from 'react';
import { VehicleSettings, PowertrainType } from '@/lib/providers/interfaces';
import { storage, SavedLocation } from '@/lib/storage';
import { getTranslation, Language } from '@/lib/translations';
import { POPULAR_CARS, CarPreset } from '@/lib/carPresets';
import { X, ChevronDown, Car, Gauge, Fuel, Home, Trash2, Sparkles } from 'lucide-react';
import CarSelectorModal from './CarSelectorModal';

interface VehicleSetupProps {
  language: Language;
  onSave: (settings: VehicleSettings) => void;
  onClose: () => void;
}

export default function VehicleSetup({ language, onSave, onClose }: VehicleSetupProps) {
  const [settings, setSettings] = useState<VehicleSettings | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('audi-q2');
  const [isCustomModel, setIsCustomModel] = useState<boolean>(false);
  const [homeLocation, setHomeLocation] = useState<SavedLocation | null>(null);
  const [showVisualModal, setShowVisualModal] = useState<boolean>(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = storage.getVehicleSettings();
    setSettings(saved);

    const savedHome = storage.getHomeLocation();
    setHomeLocation(savedHome);

    // Check if the saved carModel matches any preset
    const matchingPreset = POPULAR_CARS.find(
      (c) => c.makeModel.toLowerCase() === (saved.carModel || '').toLowerCase()
    );

    if (matchingPreset) {
      setSelectedPresetId(matchingPreset.id);
      setIsCustomModel(false);
    } else if (saved.carModel && saved.carModel !== 'Audi Q2') {
      setSelectedPresetId('custom');
      setIsCustomModel(true);
    } else {
      setSelectedPresetId('audi-q2');
      setIsCustomModel(false);
    }
  }, []);

  // Focus trap and Escape handler
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

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

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);

    if (presetId === 'custom') {
      setIsCustomModel(true);
      return;
    }

    setIsCustomModel(false);
    const preset = POPULAR_CARS.find((c) => c.id === presetId);
    if (preset) {
      setSettings({
        ...settings,
        carModel: preset.makeModel,
        fuelType: preset.fuelType,
        powertrain: preset.powertrain,
        consumptionL100km: preset.defaultConsumption,
      });
    }
  };

  const handleSave = () => {
    storage.saveVehicleSettings(settings);

    // Save or clear Home Location
    if (homeLocation && homeLocation.address.trim()) {
      storage.saveHomeLocation(homeLocation);
    } else {
      storage.clearHomeLocation();
    }

    onSave(settings);
    onClose();
  };

  const activePreset = POPULAR_CARS.find((c) => c.id === selectedPresetId);

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="bg-[#111] border border-white/10 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl relative my-8"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-neutral-500 hover:text-white transition-colors"
          aria-label={getTranslation(language, 'save') === 'Save' ? 'Close settings' : 'Ayarları kapat'}
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500">
            <Car size={16} />
          </div>
          <h2 id="settings-dialog-title" className="text-lg font-medium text-white">
            {settings.carModel || getTranslation(language, 'vehicle')} {getTranslation(language, 'settings')}
          </h2>
        </div>

        <div className="flex flex-col gap-4">
          {/* Visual Vehicle Selector Banner */}
          <button
            type="button"
            onClick={() => setShowVisualModal(true)}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-red-950/40 via-red-900/20 to-transparent border border-red-500/25 hover:border-red-500/50 hover:bg-white/5 transition-all text-left group cursor-pointer shadow-lg shadow-red-950/20"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-400 group-hover:scale-105 transition-transform shrink-0">
                <Car size={20} />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-xs font-bold text-white group-hover:text-red-400 transition-colors truncate">
                    {settings.carModel || getTranslation(language, 'selectYourCar')}
                  </span>
                  <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-md shrink-0">
                    {settings.consumptionL100km} L
                  </span>
                </div>
                <span className="text-[11px] text-neutral-400 truncate">
                  {getTranslation(language, 'openVisualSelector')}
                </span>
              </div>
            </div>
            <div className="px-2.5 py-1.5 rounded-xl bg-red-600/15 group-hover:bg-red-600 text-red-400 group-hover:text-white text-xs font-semibold flex items-center gap-1 shrink-0 transition-all">
              <Sparkles size={12} />
              <span className="text-[11px] font-bold">{getTranslation(language, 'change')}</span>
            </div>
          </button>

          {/* 1. Quick Vehicle Preset Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">
              {getTranslation(language, 'selectVehiclePreset')}
            </label>
            <div className="relative">
              <select
                value={selectedPresetId}
                onChange={(e) => handleSelectPreset(e.target.value)}
                className="w-full appearance-none bg-white/5 border border-white/10 rounded-2xl py-3 pl-4 pr-10 outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition-all text-white font-medium text-sm cursor-pointer"
              >
                <optgroup label={getTranslation(language, 'popularVehicles')}>
                  {POPULAR_CARS.map((car) => (
                    <option key={car.id} value={car.id} className="bg-[#1a1a1a] text-white py-1">
                      {car.rank ? `${car.rank}. ` : ''}{car.makeModel} • {car.engine} ({car.defaultConsumption}L)
                    </option>
                  ))}
                </optgroup>
                <option value="custom" className="bg-[#1a1a1a] text-amber-400 font-semibold py-1">
                  ✨ {getTranslation(language, 'customVehicle')}
                </option>
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                <ChevronDown size={18} />
              </div>
            </div>

            {/* Information badge for selected preset */}
            {activePreset && !isCustomModel && (
              <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-neutral-400 mt-1">
                <span className="px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 font-medium">
                  {activePreset.segment}
                </span>
                <span>{activePreset.engine}</span>
                <span className="text-neutral-500">•</span>
                <span className="text-emerald-400 font-medium">{activePreset.consumptionRange}</span>
              </div>
            )}
          </div>

          {/* 2. Custom Model Name input (if custom selected) */}
          {isCustomModel && (
            <div className="flex flex-col gap-1.5 animate-in fade-in duration-200">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">
                {getTranslation(language, 'customVehicleName')}
              </label>
              <input
                type="text"
                placeholder={getTranslation(language, 'customVehicleHint')}
                value={settings.carModel || ''}
                onChange={(e) => setSettings({ ...settings, carModel: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition-all text-white placeholder:text-neutral-600 font-light text-sm"
              />
            </div>
          )}

          {/* 3. Powertrain / Fuel Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">
              {getTranslation(language, 'fuelType')} & {getTranslation(language, 'powertrain')}
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-white/5 border border-white/10 rounded-xl p-1">
              <button
                type="button"
                className={`py-2 text-xs font-medium rounded-lg transition-colors ${
                  settings.fuelType === 'petrol' && (!settings.powertrain || settings.powertrain === 'petrol')
                    ? 'bg-red-600 text-white shadow-lg shadow-red-900/20'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
                onClick={() =>
                  setSettings({
                    ...settings,
                    fuelType: 'petrol',
                    powertrain: 'petrol',
                  })
                }
              >
                {getTranslation(language, 'petrol')}
              </button>
              <button
                type="button"
                className={`py-2 text-xs font-medium rounded-lg transition-colors ${
                  settings.fuelType === 'diesel'
                    ? 'bg-red-600 text-white shadow-lg shadow-red-900/20'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
                onClick={() =>
                  setSettings({
                    ...settings,
                    fuelType: 'diesel',
                    powertrain: 'diesel',
                  })
                }
              >
                {getTranslation(language, 'diesel')}
              </button>
              <button
                type="button"
                className={`py-2 text-xs font-medium rounded-lg transition-colors ${
                  settings.powertrain === 'mild_hybrid'
                    ? 'bg-red-600 text-white shadow-lg shadow-red-900/20'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
                onClick={() =>
                  setSettings({
                    ...settings,
                    fuelType: 'petrol',
                    powertrain: 'mild_hybrid',
                  })
                }
              >
                {getTranslation(language, 'mildHybrid')}
              </button>
              <button
                type="button"
                className={`py-2 text-xs font-medium rounded-lg transition-colors ${
                  settings.powertrain === 'full_hybrid'
                    ? 'bg-red-600 text-white shadow-lg shadow-red-900/20'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
                onClick={() =>
                  setSettings({
                    ...settings,
                    fuelType: 'petrol',
                    powertrain: 'full_hybrid',
                  })
                }
              >
                {getTranslation(language, 'fullHybrid')}
              </button>
            </div>
          </div>

          {/* 4. Official WLTP Baseline */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-end">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                <Fuel size={12} className="text-red-500" />
                {getTranslation(language, 'officialConsumption')} ({getTranslation(language, 'consumptionUnit')})
              </label>
              <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">
                {getTranslation(language, 'wltpAverage')}
              </span>
            </div>
            <input
              type="number"
              step="0.1"
              min="1.0"
              max="25.0"
              value={settings.consumptionL100km}
              onChange={(e) =>
                setSettings({ ...settings, consumptionL100km: parseFloat(e.target.value) || 0 })
              }
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition-all text-white placeholder:text-neutral-600 font-medium text-sm"
            />
          </div>

          {/* 5. Optional User Dashboard Average Calibration */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-end">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                <Gauge size={12} className="text-neutral-400" />
                {getTranslation(language, 'personalAverage')}
              </label>
              <span className="text-[10px] text-neutral-500 font-light">
                {getTranslation(language, 'personalAverageHint')}
              </span>
            </div>
            <input
              type="number"
              step="0.1"
              min="1.0"
              max="25.0"
              placeholder={getTranslation(language, 'personalAverageHint')}
              value={settings.personalAverageConsumption ?? ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  personalAverageConsumption: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition-all text-white placeholder:text-neutral-600 font-light text-sm"
            />
          </div>

          {/* 6. Custom Home Address Setup */}
          <div className="flex flex-col gap-1.5 pt-1 border-t border-white/10">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-widest flex items-center gap-1.5">
                <Home size={13} className="text-red-500" />
                {getTranslation(language, 'homeAddress')}
              </label>
              {homeLocation?.address && (
                <button
                  type="button"
                  onClick={() => setHomeLocation(null)}
                  className="text-[10px] text-neutral-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                  title={getTranslation(language, 'clearHistory')}
                >
                  <Trash2 size={10} />
                  {getTranslation(language, 'clearHistory')}
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder={getTranslation(language, 'homeAddressHint')}
              value={homeLocation?.address || ''}
              onChange={(e) => setHomeLocation({ address: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition-all text-white placeholder:text-neutral-600 font-light text-sm"
            />
          </div>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSave}
            className="w-full bg-white hover:bg-neutral-200 text-black font-bold uppercase tracking-widest text-sm py-3.5 rounded-xl transition-all duration-300 mt-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            {getTranslation(language, 'save')}
          </button>
        </div>
      </div>

      {showVisualModal && (
        <CarSelectorModal
          isOpen={showVisualModal}
          currentSettings={settings}
          language={language}
          onSelect={(updated) => {
            setSettings(updated);
            const matching = POPULAR_CARS.find(
              (c) => c.makeModel.toLowerCase() === (updated.carModel || '').toLowerCase()
            );
            if (matching) {
              setSelectedPresetId(matching.id);
              setIsCustomModel(false);
            } else {
              setSelectedPresetId('custom');
              setIsCustomModel(true);
            }
            setShowVisualModal(false);
          }}
          onClose={() => setShowVisualModal(false)}
        />
      )}
    </div>
  );
}
