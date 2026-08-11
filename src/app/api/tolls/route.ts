import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// Cache this endpoint's result for 24 hours (86400 seconds) globally on the Vercel Edge Network
export const revalidate = 86400; 

export async function GET() {
  // Default fallback prices in case scraping fails (e.g. if their website goes down or changes layout)
  const tolls = {
    avrasya: 330.00, // 2026 Daytime Rate
    yss: 110.00,
    fsm: 59.00,
    osmangazi: 399.00, // Current ~2024/2025 estimate
    canakkale: 419.00,
    lastUpdated: new Date().toISOString()
  };

  try {
    // 1. Scrape Eurasia Tunnel
    try {
      const res = await fetch('https://www.avrasyatuneli.com/ucretlendirme/', { 
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        
        // Find the specific table cell containing the Automobile (Otomobil) daytime tariff.
        // It's typically structured near the word "Otomobil" or "₺"
        const textNodes = $('body').text();
        
        // Match pattern: 330,00 or 330.00 near the word Otomobil or just find the highest likely price in the table
        const otomobilMatch = textNodes.match(/Otomobil[\s\S]{0,100}?(\d{2,3})[,.](\d{2})/i);
        if (otomobilMatch && otomobilMatch[1]) {
           tolls.avrasya = parseFloat(`${otomobilMatch[1]}.${otomobilMatch[2]}`);
        }
      }
    } catch (e) {
      console.warn('Avrasya Scrape failed, using fallback.', e);
    }

    // 2. Scrape Yavuz Sultan Selim Bridge
    try {
       const yssRes = await fetch('https://www.ysskoprusuveotoyolu.com.tr/tr/gecis-ucretleri');
       if (yssRes.ok) {
          const yssHtml = await yssRes.text();
          const $ = cheerio.load(yssHtml);
          const yssText = $('body').text();
          const yssMatch = yssText.match(/Otomobil[\s\S]{0,100}?(\d{2,3})[,.](\d{2})/i);
          if (yssMatch && yssMatch[1]) {
            tolls.yss = parseFloat(`${yssMatch[1]}.${yssMatch[2]}`);
          }
       }
    } catch (e) {
       console.warn('YSS Scrape failed, using fallback.', e);
    }

    return NextResponse.json(tolls);
  } catch (error) {
    return NextResponse.json(tolls); // Always return fallback if everything crashes
  }
}
