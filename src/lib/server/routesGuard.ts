/**
 * Cost guardrails for the Google Routes proxy (/api/routes).
 *
 * Every upstream call to the toll-enabled Routes API is billable, so we:
 *  1. validate input (only well-formed place IDs, whitelisted emission types),
 *  2. cache identical queries for a short TTL,
 *  3. rate-limit per client IP,
 *  4. cap the number of upstream Google calls per UTC day.
 *
 * NOTE: state lives in module memory. On serverless platforms each warm instance
 * has its own counters, so this is a best-effort first line of defense. The
 * authoritative hard cap must be set as an API quota in Google Cloud Console.
 */

const CACHE_TTL_MS = 15 * 60 * 1000; // traffic data stays reasonably fresh for 15 min
const CACHE_MAX_ENTRIES = 500;

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS = Number(process.env.ROUTES_RATE_LIMIT_PER_10MIN) || 20;

/** Max upstream Google calls per UTC day (one user request can use up to 3). */
const DAILY_UPSTREAM_CAP = Number(process.env.ROUTES_DAILY_UPSTREAM_CAP) || 800;

const ALLOWED_EMISSION_TYPES = new Set([
  'GASOLINE',
  'DIESEL',
  'HYBRID',
  'ELECTRIC',
  'petrol',
  'diesel',
  'full_hybrid',
  'mild_hybrid',
  'phev',
  'ev',
]);

// Google place IDs are URL-safe base64-like strings.
const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{10,300}$/;

type CacheEntry = { expiresAt: number; data: unknown };

const cache = new Map<string, CacheEntry>();
const rateBuckets = new Map<string, number[]>();
let dailyCount = 0;
let dailyDay = currentUtcDay();

function currentUtcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function rollDailyCounter() {
  const today = currentUtcDay();
  if (today !== dailyDay) {
    dailyDay = today;
    dailyCount = 0;
  }
}

export function isValidPlaceId(value: unknown): value is string {
  return typeof value === 'string' && PLACE_ID_PATTERN.test(value);
}

export function isAllowedEmissionType(value: unknown): value is string {
  return typeof value === 'string' && ALLOWED_EMISSION_TYPES.has(value);
}

export function buildCacheKey(origin: string, destination: string, emissionType: string): string {
  return `${origin}|${destination}|${emissionType}`;
}

export function getCached(key: string): unknown | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

export function setCached(key: string, data: unknown) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Map preserves insertion order: evict the oldest entry.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data });
}

/** Returns true if the client is within its rate limit (and records the hit). */
export function allowRequest(clientId: string): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(clientId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX_REQUESTS) {
    rateBuckets.set(clientId, hits);
    return false;
  }
  hits.push(now);
  rateBuckets.set(clientId, hits);

  // Opportunistic cleanup to keep memory bounded.
  if (rateBuckets.size > 5000) {
    for (const [id, times] of rateBuckets) {
      if (times.every((t) => now - t >= RATE_WINDOW_MS)) rateBuckets.delete(id);
    }
  }
  return true;
}

/** Reserve `n` upstream calls against today's cap. Returns false if the cap would be exceeded. */
export function reserveUpstreamCalls(n: number): boolean {
  rollDailyCounter();
  if (dailyCount + n > DAILY_UPSTREAM_CAP) return false;
  dailyCount += n;
  return true;
}

export function getClientId(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}
