import { FuelPriceInfo, FuelPriceProvider } from './interfaces';

export class LiveFuelPriceProvider implements FuelPriceProvider {
  async getCurrentPrice(
    side: 'EUROPE' | 'ANATOLIA' = 'EUROPE',
    fuelType: 'petrol' | 'diesel' = 'petrol'
  ): Promise<FuelPriceInfo> {
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

    if (isDemo) {
      return {
        priceTRYPerLiter: fuelType === 'diesel' ? 79.69 : 71.45,
        petrolPricePerLiter: 71.45,
        dieselPricePerLiter: 79.69,
        currency: 'TRY',
        source: 'Demo Mock Data',
        retrievedAt: new Date().toISOString(),
        status: 'CACHED',
        side,
        fuelType,
      };
    }

    try {
      const res = await fetch(`/api/fuel?side=${side}`);
      if (!res.ok) throw new Error('Failed to fetch fuel prices');
      const data = await res.json();

      const petrol = data.petrol ?? data.priceTRYPerLiter ?? 71.45;
      const diesel = data.diesel ?? data.priceTRYPerLiter ?? 79.69;
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
    } catch (e) {
      console.warn('Fuel price API failed, falling back to manual entry.', e);
      return {
        priceTRYPerLiter: 0,
        petrolPricePerLiter: 0,
        dieselPricePerLiter: 0,
        currency: 'TRY',
        source: 'Unknown',
        retrievedAt: new Date().toISOString(),
        status: 'MANUAL',
        side,
        fuelType,
      };
    }
  }
}

export const fuelPriceProvider = new LiveFuelPriceProvider();
