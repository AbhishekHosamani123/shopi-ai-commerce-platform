/**
 * In-Memory Client Cache for Merchant AI Telemetry
 * Provides instantaneous tab switching with Stale-While-Revalidate behavior.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const DEFAULT_TTL_MS = 60 * 1000; // 60 seconds

export async function fetchWithClientCache<T>(
  url: string,
  options?: RequestInit,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T | null> {
  const cacheKey = `${options?.method || 'GET'}:${url}`;
  const cached = memoryCache.get(cacheKey);
  const now = Date.now();

  // If fresh cache exists, return immediately for 0ms tab navigation
  if (cached && now - cached.timestamp < ttlMs) {
    return cached.data as T;
  }

  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      if (cached) return cached.data as T;
      return null;
    }
    const data = await res.json();
    memoryCache.set(cacheKey, { data, timestamp: now });
    return data as T;
  } catch (err) {
    if (cached) return cached.data as T;
    console.warn(`[ClientCache] Fetch error for ${url}:`, err);
    return null;
  }
}

export function invalidateMerchantCache(pattern?: string) {
  if (!pattern) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.includes(pattern)) {
      memoryCache.delete(key);
    }
  }
}
