import { WeatherData } from '../providers/interfaces';

interface CachedWeather {
  data: WeatherData;
  timestamp: number;
}

const WEATHER_CACHE = new Map<string, CachedWeather>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache duration

/**
 * Maps WMO weather code to plain language description and rain status.
 */
function parseWmoWeatherCode(code: number): { description: string; isRainy: boolean } {
  if (code === 0) return { description: 'Clear sky', isRainy: false };
  if (code === 1 || code === 2) return { description: 'Partly cloudy', isRainy: false };
  if (code === 3) return { description: 'Overcast', isRainy: false };
  if (code >= 45 && code <= 48) return { description: 'Foggy', isRainy: false };
  if (code >= 51 && code <= 67) return { description: 'Rain / Drizzle', isRainy: true };
  if (code >= 71 && code <= 77) return { description: 'Snow', isRainy: true };
  if (code >= 80 && code <= 82) return { description: 'Rain showers', isRainy: true };
  if (code >= 95 && code <= 99) return { description: 'Thunderstorm', isRainy: true };
  return { description: 'Normal', isRainy: false };
}

/**
 * Fetches ambient weather data for route location.
 * Implements strict 30-minute geo-cell caching (rounded to ~1km grid) to prevent redundant API calls.
 */
export async function getRouteWeather(lat: number, lng: number): Promise<WeatherData> {
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const now = Date.now();

  const cached = WEATHER_CACHE.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // Safe fallback
  const fallbackWeather: WeatherData = {
    temperatureC: 20.0,
    weatherCode: 0,
    weatherDescription: 'Mild',
    isRainy: false,
    windSpeedKmh: 10.0,
    retrievedAt: new Date().toISOString(),
  };

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,weather_code,wind_speed_10m`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return fallbackWeather;
    }

    const json = await res.json();
    const current = json.current;
    if (!current) return fallbackWeather;

    const temp = typeof current.temperature_2m === 'number' ? current.temperature_2m : 20.0;
    const wCode = typeof current.weather_code === 'number' ? current.weather_code : 0;
    const wind = typeof current.wind_speed_10m === 'number' ? current.wind_speed_10m : 10.0;
    const { description, isRainy } = parseWmoWeatherCode(wCode);

    const weatherData: WeatherData = {
      temperatureC: parseFloat(temp.toFixed(1)),
      weatherCode: wCode,
      weatherDescription: description,
      isRainy,
      windSpeedKmh: parseFloat(wind.toFixed(1)),
      retrievedAt: new Date().toISOString(),
    };

    WEATHER_CACHE.set(cacheKey, { data: weatherData, timestamp: now });
    return weatherData;
  } catch (e) {
    // Graceful silent fallback
    return fallbackWeather;
  }
}
