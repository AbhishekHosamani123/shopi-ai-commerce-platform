/**
 * In-Memory Request & TTL Cache for Customer Storefront
 * Provides sub-millisecond responses for read-heavy catalog, product, and category data.
 * Does NOT cache transactional, user-specific, or cart/checkout state.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

/**
 * Fetch or get cached data with in-flight deduplication and stale-while-revalidate pattern.
 */
export async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  const now = Date.now();
  const cached = memoryCache.get(key);

  // Return cached data immediately if fresh
  if (cached && now - cached.timestamp < cached.ttlMs) {
    return cached.data;
  }

  // Deduplicate concurrent in-flight requests for the exact same key
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  const fetchPromise = (async () => {
    try {
      const data = await fetcher();
      if (data !== undefined && data !== null) {
        memoryCache.set(key, {
          data,
          timestamp: Date.now(),
          ttlMs: ttlSeconds * 1000,
        });
      }
      return data;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, fetchPromise);

  // If we have stale cached data, return it while refreshing in the background (stale-while-revalidate)
  if (cached) {
    return cached.data;
  }

  return fetchPromise;
}

/**
 * Invalidate a specific cache key (e.g. after a review is created)
 */
export function invalidateCacheKey(keyPrefix: string) {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Clear the entire memory cache
 */
export function clearMemoryCache() {
  memoryCache.clear();
  inFlightRequests.clear();
}
