import { FuelPriceInfo, FuelPriceProvider } from './interfaces';

export class LiveFuelPriceProvider implements FuelPriceProvider {
  async getCurrentPrice(side: 'EUROPE' | 'ANATOLIA' = 'EUROPE'): Promise<FuelPriceInfo> {
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

    if (isDemo) {
      return {
        priceTRYPerLiter: 42.50,
        currency: 'TRY',
        source: 'Demo Mock Data',
        retrievedAt: new Date().toISOString(),
        status: 'CACHED',
        side
      };
    }

    try {
      const res = await fetch('/api/fuel');
      if (!res.ok) throw new Error('Failed to fetch fuel prices');
      const data = await res.json();
      return data;
    } catch (e) {
      console.warn('Falling back to manual entry because API failed.', e);
      // If the API completely fails and there's no cache, we force manual mode.
      return {
        priceTRYPerLiter: 0,
        currency: 'TRY',
        source: 'Unknown',
        retrievedAt: new Date().toISOString(),
        status: 'MANUAL',
        side
      };
    }
  }
}

export const fuelPriceProvider = new LiveFuelPriceProvider();
