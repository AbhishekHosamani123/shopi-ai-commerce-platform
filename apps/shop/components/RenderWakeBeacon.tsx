'use client';

import { useEffect } from 'react';

/**
 * Render wake-up beacon.
 *
 * Render's free/standard tier sleeps idle web services after ~15 minutes, and
 * the first request after sleep pays the cold-start (~30-60s). This beacon
 * pings the backend's lightweight /health endpoint in the BACKGROUND on every
 * page load, so a sleeping Render service begins waking immediately — while
 * the user is still reading the page — instead of when they first click
 * something that needs the backend.
 *
 * Properties:
 * - Never blocks or delays page rendering (fires after load, `keepalive`,
 *   no awaits on the critical path).
 * - Completely silent on failure: fire-and-forget with catch(); no console
 *   errors, no UI state, no retries that could spam a down backend.
 * - Runs once per page view (not per route change) to avoid hammering the
 *   service; navigating a Next app doesn't reload the page.
 * - Uses a HEAD-ish GET with a cache-buster so no layer (CDN/service worker)
 *   can answer from cache — the request must reach Render to wake it.
 *
 * The backend URL is resolved server-side via NEXT_PUBLIC_BACKEND_URL when
 * provided (Vercel env var); in the default same-origin setup the beacon
 * proxies through the Next /api route, which itself wakes the Render service
 * via its server-side fetch — so the wake works in both configurations.
 */
export function RenderWakeBeacon() {
  useEffect(() => {
    const wake = () => {
      try {
        const base = process.env.NEXT_PUBLIC_BACKEND_URL || '';
        const url = `${base}/health?_wake=${Date.now()}`;
        // keepalive lets the request outlive this page's lifetime budget;
        // mode 'no-cors' avoids CORS noise for cross-origin beacons.
        void fetch(url, {
          method: 'GET',
          mode: base ? 'no-cors' : 'same-origin',
          cache: 'no-store',
          keepalive: true,
          priority: 'low'
        } as RequestInit).catch(() => {
          /* Backend asleep/down/unreachable: intentionally silent. */
        });
      } catch {
        /* Never surface beacon errors to the user. */
      }
    };

    // Fire after the window load event so page rendering is never delayed.
    if (document.readyState === 'complete') {
      wake();
    } else {
      window.addEventListener('load', wake, { once: true });
      return () => window.removeEventListener('load', wake);
    }
  }, []);

  return null;
}
