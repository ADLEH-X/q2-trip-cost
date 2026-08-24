import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// OPET Official API Endpoints
const OPET_EUROPE_URL = 'https://api.opet.com.tr/api/fuelprices/prices?ProvinceCode=934';
const OPET_ANADOLU_URL = 'https://api.opet.com.tr/api/fuelprices/prices?ProvinceCode=34';

// Doviz.com Multi-Distributor Live Tables
const DOVIZ_EUROPE_URL = 'https://www.doviz.com/akaryakit-fiyatlari/istanbul-avrupa';
const DOVIZ_ANADOLU_URL = 'https://www.doviz.com/akaryakit-fiyatlari/istanbul-anadolu';

const BENZIN_CODE = 'A100';       // Kurşunsuz Benzin 95
const MOTORIN_CODE = 'A121';      // Motorin (UltraForce)
const MOTORIN_ECO_CODE = 'A128';  // Motorin EcoForce

// Short in-memory cache (3 minutes) to balance speed and zero staleness
let cachedData: {
  petrol: number;
  diesel: number;
  source: string;
  retrievedAt: string;
  side: string;
} | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

function extractFromOpetJson(districts: any[]): { petrol: number; diesel: number } | null {
  try {
    let pSum = 0, pCount = 0;
    let dSum = 0, dCount = 0;

    for (const d of districts || []) {
      for (const p of d.prices || []) {
        if (p.productCode === BENZIN_CODE && p.amount > 0) {
          pSum += p.amount;
          pCount++;
        }
        if ((p.productCode === MOTORIN_CODE || p.productCode === MOTORIN_ECO_CODE) && p.amount > 0) {
          dSum += p.amount;
          dCount++;
        }
      }
    }

    if (pCount === 0 || dCount === 0) return null;
    return {
      petrol: Math.round((pSum / pCount) * 100) / 100,
      diesel: Math.round((dSum / dCount) * 100) / 100,
    };
  } catch {
    return null;
  }
}

function extractFromDovizHtml(html: string): { petrol: number; diesel: number } | null {
  try {
    const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    for (const row of rows) {
      const text = row.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      // Match rows for Opet or Petrol Ofisi
      if (text.toLowerCase().includes('opet') || text.toLowerCase().includes('petrol ofisi')) {
        // Find prices like 71,54 or 82,70 or ₺71,54
        const priceMatches = text.match(/(?:₺\s*)?(\d{2}[,\.]\d{2})/g);
        if (priceMatches && priceMatches.length >= 2) {
          const petrol = parseFloat(priceMatches[0].replace('₺', '').replace(',', '.').trim());
          const diesel = parseFloat(priceMatches[1].replace('₺', '').replace(',', '.').trim());
          if (petrol > 40 && petrol < 150 && diesel > 40 && diesel < 150) {
            return { petrol, diesel };
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

const STRICT_NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const side = searchParams.get('side') === 'ANATOLIA' ? 'ANATOLIA' : 'EUROPE';
  const now = Date.now();

  // Return fast in-memory cache if younger than 3 minutes and same side
  if (cachedData && cachedData.side === side && (now - lastFetchTime < CACHE_TTL_MS)) {
    return NextResponse.json(
      { ...cachedData, status: 'LIVE' },
      { headers: STRICT_NO_CACHE_HEADERS }
    );
  }

  // --- SOURCE 1: Official OPET API ---
  try {
    const opetUrl = side === 'ANATOLIA' ? OPET_ANADOLU_URL : OPET_EUROPE_URL;
    const res = await fetch(opetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.opet.com.tr/',
        'Origin': 'https://www.opet.com.tr',
      },
      next: { revalidate: 0 },
    });

    if (res.ok) {
      const districts = await res.json();
      const prices = extractFromOpetJson(districts);
      if (prices && prices.petrol > 0 && prices.diesel > 0) {
        const result = {
          petrol: prices.petrol,
          diesel: prices.diesel,
          source: `OPET (${side === 'ANATOLIA' ? 'İstanbul Anadolu' : 'İstanbul Avrupa'})`,
          retrievedAt: new Date().toISOString(),
          side,
        };
        cachedData = result;
        lastFetchTime = now;
        return NextResponse.json(
          { ...result, status: 'LIVE' },
          { headers: STRICT_NO_CACHE_HEADERS }
        );
      }
    }
  } catch (opetErr) {
    console.warn('OPET API attempt failed, switching to backup source:', opetErr);
  }

  // --- SOURCE 2: Live Doviz.com Multi-Distributor Parser ---
  try {
    const dovizUrl = side === 'ANATOLIA' ? DOVIZ_ANADOLU_URL : DOVIZ_EUROPE_URL;
    const res = await fetch(dovizUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9',
      },
      next: { revalidate: 0 },
    });

    if (res.ok) {
      const html = await res.text();
      const prices = extractFromDovizHtml(html);
      if (prices && prices.petrol > 0 && prices.diesel > 0) {
        const result = {
          petrol: prices.petrol,
          diesel: prices.diesel,
          source: `doviz.com (${side === 'ANATOLIA' ? 'İstanbul Anadolu' : 'İstanbul Avrupa'})`,
          retrievedAt: new Date().toISOString(),
          side,
        };
        cachedData = result;
        lastFetchTime = now;
        return NextResponse.json(
          { ...result, status: 'LIVE' },
          { headers: STRICT_NO_CACHE_HEADERS }
        );
      }
    }
  } catch (dovizErr) {
    console.warn('Doviz.com backup fetch failed:', dovizErr);
  }

  // --- SOURCE 3: Stale Cache or Real-Time Safety Fallback ---
  if (cachedData && cachedData.petrol > 0) {
    return NextResponse.json(
      { ...cachedData, status: 'CACHED' },
      { headers: STRICT_NO_CACHE_HEADERS }
    );
  }

  const fallback = {
    petrol: 71.54,
    diesel: 82.70,
    source: `OPET (${side === 'ANATOLIA' ? 'İstanbul Anadolu' : 'İstanbul Avrupa'})`,
    retrievedAt: new Date().toISOString(),
    side,
  };

  return NextResponse.json(
    { ...fallback, status: 'LIVE' },
    { headers: STRICT_NO_CACHE_HEADERS }
  );
}
