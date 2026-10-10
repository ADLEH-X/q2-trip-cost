import { describe, it, expect } from 'vitest';
import {
  allowRequest,
  buildCacheKey,
  getCached,
  isAllowedEmissionType,
  isValidPlaceId,
  reserveUpstreamCalls,
  setCached,
} from './routesGuard';

describe('routesGuard', () => {
  it('accepts realistic Google place IDs and rejects junk', () => {
    expect(isValidPlaceId('ChIJgUbEo8cfqokR5lP9_Wh_DaM')).toBe(true);
    expect(isValidPlaceId('')).toBe(false);
    expect(isValidPlaceId('short')).toBe(false);
    expect(isValidPlaceId('has spaces and $ymbols!!')).toBe(false);
    expect(isValidPlaceId({ placeId: 'x' })).toBe(false);
    expect(isValidPlaceId('a'.repeat(301))).toBe(false);
  });

  it('whitelists emission types', () => {
    expect(isAllowedEmissionType('GASOLINE')).toBe(true);
    expect(isAllowedEmissionType('full_hybrid')).toBe(true);
    expect(isAllowedEmissionType('ROCKET_FUEL')).toBe(false);
  });

  it('caches and returns stored values', () => {
    const key = buildCacheKey('ChIJoriginAAAAAA', 'ChIJdestinationBBB', 'GASOLINE');
    expect(getCached(key)).toBeUndefined();
    setCached(key, { routes: [1] });
    expect(getCached(key)).toEqual({ routes: [1] });
  });

  it('rate limits a single client after the maximum number of requests', () => {
    const client = `test-client-${Math.random()}`;
    let allowed = 0;
    for (let i = 0; i < 100; i++) {
      if (allowRequest(client)) allowed++;
    }
    expect(allowed).toBeGreaterThan(0);
    expect(allowed).toBeLessThan(100);
    expect(allowRequest(client)).toBe(false);
    // A different client is unaffected.
    expect(allowRequest(`other-${Math.random()}`)).toBe(true);
  });

  it('stops reserving upstream calls once the daily cap is reached', () => {
    let reserved = 0;
    while (reserveUpstreamCalls(1) && reserved < 100000) reserved++;
    expect(reserved).toBeLessThan(100000);
    expect(reserveUpstreamCalls(1)).toBe(false);
  });
});
