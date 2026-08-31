'use client';

import { useEffect, useRef } from 'react';

/**
 * Activity-aware Render wake-up and keep-alive system.
 *
 * ### Wake-up on page load
 * Fires a lightweight `GET /health` to the backend as soon as the page finishes
 * loading.  If the Render service is sleeping, this starts the cold-start
 * (~30–60s) well before the user's first actionable request.
 *
 * ### Activity-based heartbeat
 * While the page is visible and the user has interacted recently, a heartbeat
 * request is sent at a sensible interval (every 60s) to keep the Render
 * service warm.  The heartbeat stops when:
 *  - The page/tab is hidden (Page Visibility API).
 *  - The user has been idle for 5+ minutes (no scroll, click, or keydown).
 *  - The window is closed.
 *
 * This avoids the two extreme anti-patterns:
 *  - **Infinite keep-alive** that wastes Render free-tier CPU hours.
 *  - **Cold start on every interaction** by allowing the service to sleep
 *    only when there is genuinely no active user.
 *
 * ### Which backend is targeted
 * `NEXT_PUBLIC_BACKEND_URL` tells the beacon which Render service to warm.
 * If unset, the beacon is same-origin (the Next.js /health route, which
 * proxies to the configured BACKEND_URL behind the scenes).
 *
 * The merchant-intelligence (Streamlit) backend is kept warm separately by
 * using the backend's wake-up url for the merchant AI dashboard specifically.
 */

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of inactivity → stop heartbeat
const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 60 seconds between pings while active

/**
 * Builds a wake-up URL with a cache-busting query param so no layer (CDN,
 * service worker, browser cache) can answer from cache — the request must
 * reach the Render service to wake it.
 */
function wakeUrl(base: string): string {
  return `${base}/health?_w=${Date.now()}`;
}

/**
 * Silent fetch: fire-and-forget, never blocks rendering, never surfaces
 * errors. `keepalive` ensures the request survives page navigation.
 */
function ping(url: string): void {
  try {
    void fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      keepalive: true,
      priority: 'low',
    } as RequestInit).catch(() => { /* silent */ });
  } catch {
    /* silent */
  }
}

export function RenderWakeBeacon() {
  const base = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/+$/, '');
  const lastActivity = useRef<number>(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // ── 1. Wake-up on page load ────────────────────────────────────
    const wake = () => ping(wakeUrl(base));
    if (document.readyState === 'complete') {
      wake();
    } else {
      window.addEventListener('load', wake, { once: true });
    }

    // ── 2. Activity tracking ───────────────────────────────────────
    const onActivity = () => { lastActivity.current = Date.now(); };
    window.addEventListener('scroll', onActivity, { passive: true });
    window.addEventListener('click', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });

    // ── 3. Visibility-aware heartbeat ──────────────────────────────
    const startHeartbeat = () => {
      stopHeartbeat();
      intervalRef.current = setInterval(() => {
        const idle = Date.now() - lastActivity.current;
        if (idle < IDLE_TIMEOUT_MS) {
          ping(wakeUrl(base));
        }
        // Idle too long → stop heartbeat (allow Render to sleep)
      }, HEARTBEAT_INTERVAL_MS);
    };

    const stopHeartbeat = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // User returned to the tab — wake immediately and resume heartbeat
        ping(wakeUrl(base));
        startHeartbeat();
      } else {
        // Tab hidden — stop heartbeat (don't waste resources on a background tab)
        stopHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    // Start heartbeat on initial load
    startHeartbeat();

    return () => {
      window.removeEventListener('load', wake);
      window.removeEventListener('scroll', onActivity);
      window.removeEventListener('click', onActivity);
      window.removeEventListener('keydown', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
      stopHeartbeat();
    };
  }, [base]);

  return null;
}