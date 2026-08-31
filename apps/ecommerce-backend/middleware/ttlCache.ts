/**
 * Lightweight in-process TTL cache for expensive merchant intelligence engines.
 *
 * Why: /api/merchant/overview fans out into ~12 engine computations, of which
 * campaign proposals (~1.8s), profit-safe recommendations (~0.6s) and the
 * opportunity engine (~0.5s) dominate. They are recomputed on EVERY dashboard
 * load, tab re-entry and period switch even though the underlying shopi_*
 * analytics tables only change when new orders/events are recorded. A short
 * TTL cache makes repeat loads near-instant while keeping data fresh enough
 * for an executive dashboard.
 *
 * Design:
 * - Single-flight: concurrent requests for the same key share one in-flight
 *   promise, so a dashboard load and its sub-panels don't stampede the engine.
 * - Stale-while-revalidate: `peek()` can serve an expired-but-present value
 *   immediately while a background refresh runs. The overview endpoint uses
 *   this so a cached dashboard paints instantly and syncs in the background.
 * - Cache is per merchantId/period key where relevant.
 * - `invalidate()` clears affected keys after mutations (approvals, rejects,
 *   campaign state changes) so merchants never see stale decision state.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  staleUntil: number;
}

const store = new Map<string, CacheEntry<any>>();
const inFlight = new Map<string, Promise<any>>();

const DEFAULT_TTL_MS = 60_000; // 60s: fresh data, ~0ms repeat loads
const STALE_GRACE_MS = 300_000; // serve up to 5-min-old data while revalidating

async function getOrCompute<T>(
  key: string,
  compute: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);

  if (hit && now < hit.expiresAt) {
    return hit.value as T;
  }

  // Single-flight: reuse an in-progress computation for the same key.
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const p = (async () => {
    try {
      const value = await compute();
      store.set(key, { value, expiresAt: Date.now() + ttlMs, staleUntil: Date.now() + ttlMs + STALE_GRACE_MS });
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, p);
  return p;
}

/**
 * Stale-while-revalidate read: returns `{ value, isStale }` where `value` may
 * be a freshly-expired cached result served instantly. When `isStale` is true
 * the caller SHOULD kick off `revalidate()` in the background (fire-and-forget)
 * so the next load is fresh.
 */
function peek<T>(key: string): { value: T; isStale: boolean } | null {
  const now = Date.now();
  const hit = store.get(key);
  if (!hit || now > hit.staleUntil) return null;
  return { value: hit.value as T, isStale: now >= hit.expiresAt };
}

async function revalidate<T>(
  key: string,
  compute: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  return getOrCompute(
    key,
    compute,
    // Bypass the fresh window by recomputing under the normal TTL.
    ttlMs
  ).then(async v => {
    // Force actual recompute when explicitly asked to revalidate: drop entry
    // then recompute so callers get NEW data, not the cached value.
    const now = Date.now();
    const hit = store.get(key);
    if (hit && now < hit.expiresAt) {
      // The shared getOrCompute returned the cached fresh value; recompute only
      // if caller wants a forced refresh. We simply return cached here —
      // explicit invalidation is the mechanism for forced refreshes.
      return v;
    }
    return v;
  });
}

/** Drop cached entries matching a substring pattern (e.g. "campaigns:default_merchant"). */
function invalidate(pattern?: string): void {
  if (!pattern) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.includes(pattern)) store.delete(key);
  }
}

/** Invalidate ALL merchant decision caches (approvals/rejects change global state). */
function invalidateAllMerchant(): void {
  invalidate('overview:');
  invalidate('opportunities:');
  invalidate('recommendations:');
  invalidate('campaigns:');
  invalidate('audience:');
  invalidate('customer-intelligence:');
  invalidate('health:');
}

const ttlCache = {
  get: getOrCompute,
  peek,
  revalidate,
  invalidate,
  invalidateAllMerchant,
  DEFAULT_TTL_MS,
  STALE_GRACE_MS
};

export default ttlCache;
