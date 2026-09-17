'use client';

import React, { useState, useMemo } from 'react';
import { POPULAR_CARS, CAR_BRANDS, CarPreset } from '@/lib/carPresets';
import { VehicleSettings, PowertrainType } from '@/lib/providers/interfaces';
import { getTranslation, Language } from '@/lib/translations';
import {
  X,
  Search,
  Check,
  Fuel,
  Sparkles,
  Sliders,
  ChevronRight,
  Plus,
  Minus,
  Car as CarIcon,
} from 'lucide-react';

interface CarSelectorModalProps {
  currentSettings: VehicleSettings;
  language: Language;
  isOpen: boolean;
  onSelect: (settings: VehicleSettings) => void;
  onClose: () => void;
}

export default function CarSelectorModal({
  currentSettings,
  language,
  isOpen,
  onSelect,
  onClose,
}: CarSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Custom vehicle working state
  const [customModel, setCustomModel] = useState(() => {
    const model = currentSettings.carModel || '';
    const isPreset = POPULAR_CARS.some((c) => c.makeModel.toLowerCase() === model.toLowerCase());
    return model && !isPreset ? model : '';
  });
  const [customFuelType, setCustomFuelType] = useState<'petrol' | 'diesel'>(currentSettings.fuelType || 'petrol');
  const [customPowertrain, setCustomPowertrain] = useState<PowertrainType>(currentSettings.powertrain || 'petrol');
  const [customConsumption, setCustomConsumption] = useState<number>(currentSettings.consumptionL100km || 6.0);

  // Filter cars based on search and brand
  const filteredCars = useMemo(() => {
    return POPULAR_CARS.filter((car) => {
      const matchesBrand = selectedBrand === 'All' || car.brand.toLowerCase() === selectedBrand.toLowerCase();
      const matchesSearch =
        !searchQuery.trim() ||
        car.makeModel.toLowerCase().includes(searchQuery.toLowerCase()) ||
        car.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        car.engine.toLowerCase().includes(searchQuery.toLowerCase()) ||
        car.segment.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesBrand && matchesSearch;
    });
  }, [searchQuery, selectedBrand]);

  if (!isOpen) return null;

  const handleApplyPreset = (car: CarPreset) => {
    const updated: VehicleSettings = {
      ...currentSettings,
      carModel: car.makeModel,
      fuelType: car.fuelType,
      powertrain: car.powertrain,
      consumptionL100km: car.defaultConsumption,
    };
    onSelect(updated);
    onClose();
  };

  const handleApplyCustom = () => {
    const modelName = customModel.trim() || (language === 'tr' ? 'Özel Araç' : 'Custom Car');
    const updated: VehicleSettings = {
      ...currentSettings,
      carModel: modelName,
      fuelType: customFuelType,
      powertrain: customPowertrain,
      consumptionL100km: Number(customConsumption) || 6.0,
    };
    onSelect(updated);
    onClose();
  };

  const getPowertrainBadge = (powertrain: PowertrainType, fuelType: 'petrol' | 'diesel') => {
    if (powertrain === 'full_hybrid') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          🔋 {language === 'tr' ? 'Tam Hibrit' : 'Full Hybrid'}
        </span>
      );
    }
    if (powertrain === 'mild_hybrid') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30">
          ⚡ {language === 'tr' ? 'Mild Hibrit' : 'Mild Hybrid'}
        </span>
      );
    }
    if (fuelType === 'diesel') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          🛢️ {language === 'tr' ? 'Dizel' : 'Diesel'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
        ⛽ {language === 'tr' ? 'Benzin' : 'Petrol'}
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#121217] border border-white/10 w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-600/10 border border-red-500/25 flex items-center justify-center text-red-500">
              <CarIcon size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {getTranslation(language, 'selectYourCar')}
              </h2>
              <p className="text-[11px] text-neutral-400 hidden sm:block">
                {getTranslation(language, 'carSelectorSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search & Brand Filters */}
        <div className="p-4 border-b border-white/5 bg-white/[0.01] shrink-0 flex flex-col gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder={getTranslation(language, 'searchCar')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (isCustomMode) setIsCustomMode(false);
              }}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-red-500 transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Brand Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            {CAR_BRANDS.map((brand) => {
              const isSelected = selectedBrand === brand && !isCustomMode;
              return (
                <button
                  key={brand}
                  onClick={() => {
                    setSelectedBrand(brand);
                    setIsCustomMode(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-red-600 text-white shadow-lg shadow-red-950/40 font-semibold'
                      : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {brand === 'All' ? getTranslation(language, 'allBrands') : brand}
                </button>
              );
            })}

            {/* Custom vehicle chip */}
            <button
              onClick={() => setIsCustomMode(true)}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                isCustomMode
                  ? 'bg-amber-500 text-black font-bold shadow-lg shadow-amber-950/40'
                  : 'bg-white/5 text-amber-400 hover:bg-white/10'
              }`}
            >
              <Sparkles size={12} />
              <span>{getTranslation(language, 'customVehicle')}</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-4 overflow-y-auto flex-1 overscroll-contain">
          {/* Custom Mode View */}
          {isCustomMode ? (
            <div className="flex flex-col gap-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
                <Sparkles size={16} className="shrink-0 text-amber-400" />
                <span>{getTranslation(language, 'customVehicleDesc')}</span>
              </div>

              {/* Model Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">
                  {getTranslation(language, 'customVehicleName')}
                </label>
                <input
                  type="text"
                  placeholder="Örn: BMW 320i, Honda Civic, Togg T10X..."
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-white placeholder:text-neutral-600 text-sm font-medium"
                />
              </div>

              {/* Powertrain / Fuel */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">
                  {getTranslation(language, 'fuelType')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomFuelType('petrol');
                      setCustomPowertrain('petrol');
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      customFuelType === 'petrol' && customPowertrain === 'petrol'
                        ? 'bg-red-600/20 border-red-500 text-white'
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                    }`}
                  >
                    ⛽ {getTranslation(language, 'petrol')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomFuelType('diesel');
                      setCustomPowertrain('diesel');
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      customFuelType === 'diesel'
                        ? 'bg-amber-600/20 border-amber-500 text-white'
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                    }`}
                  >
                    🛢️ {getTranslation(language, 'diesel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomFuelType('petrol');
                      setCustomPowertrain('full_hybrid');
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      customPowertrain === 'full_hybrid'
                        ? 'bg-emerald-600/20 border-emerald-500 text-white'
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                    }`}
                  >
                    🔋 {getTranslation(language, 'fullHybrid')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomFuelType('petrol');
                      setCustomPowertrain('mild_hybrid');
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      customPowertrain === 'mild_hybrid'
                        ? 'bg-teal-600/20 border-teal-500 text-white'
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                    }`}
                  >
                    ⚡ {getTranslation(language, 'mildHybrid')}
                  </button>
                </div>
              </div>

              {/* Consumption Stepper */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">
                    {getTranslation(language, 'officialConsumption')}
                  </label>
                  <span className="text-xs font-bold text-amber-400">
                    {customConsumption.toFixed(1)} L/100km
                  </span>
                </div>
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-2">
                  <button
                    type="button"
                    onClick={() => setCustomConsumption((prev) => Math.max(2.0, parseFloat((prev - 0.1).toFixed(1))))}
                    className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0"
                  >
                    <Minus size={18} />
                  </button>
                  <input
                    type="range"
                    min="2.0"
                    max="18.0"
                    step="0.1"
                    value={customConsumption}
                    onChange={(e) => setCustomConsumption(parseFloat(e.target.value))}
                    className="flex-1 accent-amber-400 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setCustomConsumption((prev) => Math.min(20.0, parseFloat((prev + 0.1).toFixed(1))))}
                    className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleApplyCustom}
                className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-black font-bold uppercase tracking-wider text-sm rounded-2xl transition-all mt-2 shadow-lg shadow-amber-950/30"
              >
                {getTranslation(language, 'applyAndSave')}
              </button>
            </div>
          ) : (
            /* Vehicle Cards Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredCars.map((car) => {
                const isSelected =
                  currentSettings.carModel?.toLowerCase() === car.makeModel.toLowerCase() ||
                  (car.id === 'audi-q2' && currentSettings.carModel === 'Audi Q2');

                return (
                  <div
                    key={car.id}
                    onClick={() => handleApplyPreset(car)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all duration-200 relative group flex flex-col justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-red-950/30 border-red-500/80 shadow-[0_0_20px_rgba(230,0,0,0.2)] ring-1 ring-red-500/50'
                        : 'bg-white/[0.02] hover:bg-white/[0.06] border-white/10 hover:border-white/20'
                    }`}
                  >
                    {/* Top Row: Make & Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-white tracking-tight group-hover:text-red-400 transition-colors">
                            {car.makeModel}
                          </span>
                        </div>
                        <span className="text-[11px] text-neutral-400 font-light mt-0.5">
                          {car.engine}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {getPowertrainBadge(car.powertrain, car.fuelType)}
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center shadow">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Segment & Consumption */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                      <span className="px-2 py-0.5 rounded-md bg-white/5 text-neutral-400 text-[10px] font-medium">
                        {car.segment}
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold text-white">
                          {car.defaultConsumption.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-medium">L/100km</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* If no results found */}
              {filteredCars.length === 0 && (
                <div className="col-span-full py-10 text-center flex flex-col items-center justify-center gap-3">
                  <CarIcon size={32} className="text-neutral-600" />
                  <p className="text-neutral-400 text-sm">
                    "{searchQuery}" bulunamadı.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomModel(searchQuery);
                      setIsCustomMode(true);
                    }}
                    className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-xl transition-all"
                  >
                    ✨ "{searchQuery}" Özel Olarak Ekle
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3.5 bg-black/40 border-t border-white/5 shrink-0 flex items-center justify-between text-xs text-neutral-400 px-5">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 font-medium">{getTranslation(language, 'selectedVehicle')}:</span>
            <span className="text-white font-semibold">{currentSettings.carModel}</span>
            <span className="text-emerald-400 font-medium">({currentSettings.consumptionL100km} L)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors text-xs font-medium"
          >
            {language === 'tr' ? 'Kapat' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
