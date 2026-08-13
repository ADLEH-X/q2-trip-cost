import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// OPET internal API — Province codes for Istanbul:
// 934 = İSTANBUL AVRUPA (European side)
// 34  = İSTANBUL ANADOLU (Asian side)
const OPET_EUROPE_URL = 'https://api.opet.com.tr/api/fuelprices/prices?ProvinceCode=934';
const OPET_ANADOLU_URL = 'https://api.opet.com.tr/api/fuelprices/prices?ProvinceCode=34';

// OPET product codes
const BENZIN_CODE = 'A100';       // Kurşunsuz Benzin 95
const MOTORIN_CODE = 'A121';      // Motorin (standard/UltraForce)
const MOTORIN_ECO_CODE = 'A128';  // Motorin EcoForce (same price usually)

// Cache for 1 hour  
let cachedData: {
  petrol: number;
  diesel: number;
  source: string;
  retrievedAt: string;
} | null = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

function extractPricesFromOpet(districts: any[]): { petrol: number; diesel: number } | null {
  try {
    // Average across all districts (prices are usually identical)
    let petrolSum = 0, petrolCount = 0;
    let dieselSum = 0, dieselCount = 0;

    for (const district of districts) {
      for (const price of district.prices || []) {
        if (price.productCode === BENZIN_CODE && price.amount > 0) {
          petrolSum += price.amount;
          petrolCount++;
        }
        if ((price.productCode === MOTORIN_CODE || price.productCode === MOTORIN_ECO_CODE) && price.amount > 0) {
          dieselSum += price.amount;
          dieselCount++;
        }
      }
    }

    if (petrolCount === 0 || dieselCount === 0) return null;

    return {
      petrol: Math.round((petrolSum / petrolCount) * 100) / 100,
      diesel: Math.round((dieselSum / dieselCount) * 100) / 100,
    };
  } catch {
    return null;
  }
}

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const side = searchParams.get('side') === 'ANATOLIA' ? 'ANATOLIA' : 'EUROPE';
  const now = Date.now();

  // Return cache if fresh
  if (cachedData && (now - lastFetchTime < CACHE_DURATION_MS)) {
    return NextResponse.json(
      { ...cachedData, status: 'CACHED' },
      { headers: CACHE_HEADERS }
    );
  }

  // --- Try OPET API (Primary Source) ---
  try {
    const url = side === 'ANATOLIA' ? OPET_ANADOLU_URL : OPET_EUROPE_URL;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.opet.com.tr/',
      },
    });

    if (!res.ok) throw new Error(`OPET API returned ${res.status}`);
    
    const districts = await res.json();
    const prices = extractPricesFromOpet(districts);

    if (!prices) throw new Error('Could not parse OPET price data');

    const result = {
      petrol: prices.petrol,
      diesel: prices.diesel,
      source: `OPET (${side === 'ANATOLIA' ? 'İstanbul Anadolu' : 'İstanbul Avrupa'})`,
      retrievedAt: new Date().toISOString(),
    };

    cachedData = result;
    lastFetchTime = now;

    return NextResponse.json(
      { ...result, status: 'LIVE' },
      { headers: CACHE_HEADERS }
    );

  } catch (primaryError) {
    console.error('OPET API failed:', primaryError);

    // --- Fallback: doviz.com HTML scrape ---
    try {
      const res = await fetch('https://www.doviz.com/akaryakit-fiyatlari', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'tr-TR,tr;q=0.9',
        },
      });

      if (!res.ok) throw new Error(`doviz.com returned ${res.status}`);

      const html = await res.text();

      // Parse prices from HTML — look for price pattern like "71,45" or "71.45"
      // doviz.com uses Turkish locale: commas as decimal separator
      const petrolMatch = html.match(/Kurşunsuz[^<]*95[^<]*<[^>]*>([^<]*?(\d{2}[,\.]\d{2})[^<]*?)<\/td>/i);
      const motorinMatch = html.match(/Motorin[^<]*<[^>]*>([^<]*?(\d{2}[,\.]\d{2})[^<]*?)<\/td>/i);

      let petrol = 0, diesel = 0;

      if (petrolMatch) {
        const raw = petrolMatch[2].replace(',', '.');
        petrol = parseFloat(raw);
      }
      if (motorinMatch) {
        const raw = motorinMatch[2].replace(',', '.');
        diesel = parseFloat(raw);
      }

      // Validate prices are in realistic range for Turkey (40–120 TL/L)
      if (petrol > 40 && petrol < 120 && diesel > 40 && diesel < 120) {
        const result = {
          petrol,
          diesel,
          source: 'doviz.com (fallback)',
          retrievedAt: new Date().toISOString(),
        };
        cachedData = result;
        lastFetchTime = now;
        return NextResponse.json(
          { ...result, status: 'LIVE' },
          { headers: CACHE_HEADERS }
        );
      }

      throw new Error('doviz.com prices out of expected range or not found');

    } catch (fallbackError) {
      console.error('doviz.com fallback failed:', fallbackError);

      // --- Final fallback: return stale cache or realistic estimate ---
      if (cachedData) {
        return NextResponse.json(
          { ...cachedData, status: 'CACHED_STALE' },
          { headers: CACHE_HEADERS }
        );
      }

      // Last resort: best estimate based on current market (updated August 2026)
      const estimate = {
        petrol: 71.45,
        diesel: 79.69,
        source: 'Sabit tahmin (OPET referansı)',
        retrievedAt: new Date().toISOString(),
      };
      return NextResponse.json(
        { ...estimate, status: 'ESTIMATED' },
        { headers: CACHE_HEADERS }
      );
    }
  }
}
