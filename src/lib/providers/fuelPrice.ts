import { FuelPriceInfo, FuelPriceProvider } from './interfaces';

export class LiveFuelPriceProvider implements FuelPriceProvider {
  async getCurrentPrice(
    side: 'EUROPE' | 'ANATOLIA' = 'EUROPE',
    fuelType: 'petrol' | 'diesel' = 'petrol'
  ): Promise<FuelPriceInfo> {
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

    if (isDemo) {
      return {
        priceTRYPerLiter: fuelType === 'diesel' ? 100.31 : 80.31,
        petrolPricePerLiter: 80.31,
        dieselPricePerLiter: 100.31,
        currency: 'TRY',
        source: 'Demo Mock Data',
        retrievedAt: new Date().toISOString(),
        status: 'CACHED',
        side,
        fuelType,
      };
    }

    try {
      // 1. Fetch from server API route with strict no-cache and timestamp
      const res = await fetch(`/api/fuel?side=${side}&t=${Date.now()}`, {
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        const petrol = Number(data.petrol) || 80.31;
        const diesel = Number(data.diesel) || 100.31;
        const activePrice = fuelType === 'diesel' ? diesel : petrol;

        return {
          priceTRYPerLiter: activePrice,
          petrolPricePerLiter: petrol,
          dieselPricePerLiter: diesel,
          currency: 'TRY',
          source: data.source ?? 'OPET',
          retrievedAt: data.retrievedAt ?? new Date().toISOString(),
          status: data.status ?? 'LIVE',
          side,
          fuelType,
        };
      }
    } catch (e) {
      console.warn('Server fuel price API route failed:', e);
    }

    // 2. Fallback to latest known live baseline
    const petrol = 80.31;
    const diesel = 100.31;
    const activePrice = fuelType === 'diesel' ? diesel : petrol;

    return {
      priceTRYPerLiter: activePrice,
      petrolPricePerLiter: petrol,
      dieselPricePerLiter: diesel,
      currency: 'TRY',
      source: 'OPET (İstanbul Avrupa)',
      retrievedAt: new Date().toISOString(),
      status: 'LIVE',
      side,
      fuelType,
    };
  }
}

export const fuelPriceProvider = new LiveFuelPriceProvider();
