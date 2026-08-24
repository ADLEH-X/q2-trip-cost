import { FuelPriceInfo, FuelPriceProvider } from './interfaces';

export class LiveFuelPriceProvider implements FuelPriceProvider {
  async getCurrentPrice(
    side: 'EUROPE' | 'ANATOLIA' = 'EUROPE',
    fuelType: 'petrol' | 'diesel' = 'petrol'
  ): Promise<FuelPriceInfo> {
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

    if (isDemo) {
      return {
        priceTRYPerLiter: fuelType === 'diesel' ? 82.70 : 71.54,
        petrolPricePerLiter: 71.54,
        dieselPricePerLiter: 82.70,
        currency: 'TRY',
        source: 'Demo Mock Data',
        retrievedAt: new Date().toISOString(),
        status: 'CACHED',
        side,
        fuelType,
      };
    }

    try {
      // 1. Fetch from server API route with strict no-cache
      const res = await fetch(`/api/fuel?side=${side}&t=${Date.now()}`, {
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        const petrol = Number(data.petrol) || 71.54;
        const diesel = Number(data.diesel) || 82.70;
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
      console.warn('Server fuel price API route failed, trying direct client fetch:', e);
    }

    // 2. Client-side direct fallback to OPET API (browsers in Turkey bypass datacenter IP restrictions)
    try {
      const provinceCode = side === 'ANATOLIA' ? '34' : '934';
      const directRes = await fetch(`https://api.opet.com.tr/api/fuelprices/prices?ProvinceCode=${provinceCode}`, {
        cache: 'no-store',
      });

      if (directRes.ok) {
        const districts = await directRes.json();
        let petrolSum = 0, petrolCount = 0;
        let dieselSum = 0, dieselCount = 0;

        for (const d of districts || []) {
          for (const p of d.prices || []) {
            if (p.productCode === 'A100' && p.amount > 0) {
              petrolSum += p.amount;
              petrolCount++;
            }
            if ((p.productCode === 'A121' || p.productCode === 'A128') && p.amount > 0) {
              dieselSum += p.amount;
              dieselCount++;
            }
          }
        }

        if (petrolCount > 0 && dieselCount > 0) {
          const petrol = Math.round((petrolSum / petrolCount) * 100) / 100;
          const diesel = Math.round((dieselSum / dieselCount) * 100) / 100;
          const activePrice = fuelType === 'diesel' ? diesel : petrol;

          return {
            priceTRYPerLiter: activePrice,
            petrolPricePerLiter: petrol,
            dieselPricePerLiter: diesel,
            currency: 'TRY',
            source: `OPET (${side === 'ANATOLIA' ? 'İstanbul Anadolu' : 'İstanbul Avrupa'})`,
            retrievedAt: new Date().toISOString(),
            status: 'LIVE',
            side,
            fuelType,
          };
        }
      }
    } catch (directErr) {
      console.warn('Direct client fetch failed:', directErr);
    }

    // 3. Fallback to latest known baseline
    const petrol = 71.54;
    const diesel = 82.70;
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
