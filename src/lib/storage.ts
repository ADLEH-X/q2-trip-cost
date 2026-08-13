import { VehicleSettings } from './providers/interfaces';

const STORAGE_KEYS = {
  VEHICLE_SETTINGS: 'q2_vehicle_settings',
  LANGUAGE: 'q2_language',
  HISTORY: 'q2_history',
  THEME: 'q2_theme',
};

export const defaultVehicleSettings: VehicleSettings = {
  carModel: 'Audi Q2',
  fuelType: 'petrol',
  consumptionL100km: 5.4, // 2026 Audi Q2 35 TFSI WLTP Combined Average
  tollClass: 1, // standard passenger car
};

export const storage = {
  getVehicleSettings(): VehicleSettings {
    if (typeof window === 'undefined') return defaultVehicleSettings;
    const data = localStorage.getItem(STORAGE_KEYS.VEHICLE_SETTINGS);
    if (!data) return defaultVehicleSettings;
    try {
      return JSON.parse(data);
    } catch (e) {
      return defaultVehicleSettings;
    }
  },
  
  saveVehicleSettings(settings: VehicleSettings): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.VEHICLE_SETTINGS, JSON.stringify(settings));
  },
  
  getLanguage(): 'tr' | 'en' {
    if (typeof window === 'undefined') return 'tr';
    const lang = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
    return (lang === 'en' ? 'en' : 'tr');
  },
  
  saveLanguage(lang: 'tr' | 'en'): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
  },

  // Stub for history features
  getHistory(): any[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return data ? JSON.parse(data) : [];
  },

  saveToHistory(trip: any): void {
    if (typeof window === 'undefined') return;
    const history = this.getHistory();
    history.unshift({ ...trip, date: new Date().toISOString() });
    // Keep only last 20
    const limitedHistory = history.slice(0, 20);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(limitedHistory));
  },
  
  clearHistory(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
  },

  getTheme(): 'dark' | 'light' {
    if (typeof window === 'undefined') return 'dark';
    const theme = localStorage.getItem(STORAGE_KEYS.THEME);
    return theme === 'light' ? 'light' : 'dark';
  },

  saveTheme(theme: 'dark' | 'light'): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
  },

  applyTheme(): void {
    if (typeof window === 'undefined') return;
    const theme = this.getTheme();
    document.documentElement.setAttribute('data-theme', theme);
  }
};
