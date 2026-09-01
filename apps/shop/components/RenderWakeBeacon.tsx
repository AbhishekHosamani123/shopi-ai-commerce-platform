'use client';

import { useEffect, useRef } from 'react';

/**
 * Dual-backend Render wake-up + activity-based keep-alive.
 *
 * TWO Render services exist:
 *   1. shopi-backend  (Express commerce API)   — NEXT_PUBLIC_BACKEND_URL
 *   2. Evolution API  (WhatsApp gateway)       — NEXT_PUBLIC_EVOLUTION_API_URL
 *
 * Render's free tier sleeps a service after ~15 minutes without traffic, and
 * the first request to a sleeping service pays a 30–60s cold start. This
 * beacon therefore:
 *
 *   WAKE  — on first page load and whenever the user returns to the tab, it
 *           pings BOTH services' lightweight health endpoints immediately so
 *           both are awake before the user's first real interaction.
 *
 *   KEEP-ALIVE — while the user is PRESENT on the site (tab visible AND
 *           interacted within the last 15 minutes), it re-pings both services
 *           every 14 minutes — just under Render's 15-minute idle window, so
 *           neither service sleeps while someone is genuinely using the site.
 *
 *   STOP — when the tab is hidden/backgrounded, or the user has been idle for
 *           15+ minutes, or the page is closed, all pinging stops. With no
 *           active users the services are allowed to sleep (no abuse of
 *           Render's free tier).
 *
 * Interval choice (14 min): Render's documented inactivity window is 15
 * minutes. Pinging at 14 keeps the service warm with a 1-minute safety margin
 * while generating at most ~4.3 requests/hour/service — negligible load.
 *
 * The Evolution API is optional: if NEXT_PUBLIC_EVOLUTION_API_URL is not
 * configured the beacon silently skips it (same-origin /health passthrough
 * still wakes the commerce backend).
 */

const KEEPALIVE_INTERVAL_MS = 14 * 60 * 1000; // 14 min < Render's 15-min idle
const USER_IDLE_TIMEOUT_MS = 15 * 60 * 1000;  // user "present" = active <15min

/** Silent fire-and-forget GET with cache-buster so no CDN answers for Render. */
function ping(url: string): void {
  try {
    void fetch(`${url}?_w=${Date.now()}`, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      keepalive: true,
      priority: 'low',
    } as RequestInit).catch(() => { /* intentionally silent */ });
  } catch {
    /* never surface beacon errors */
  }
}

function normalizeBase(raw: string | undefined): string {
  if (!raw) return '';
  return raw.replace(/\/+$/, '');
}

/** Health path per service. Both expose a cheap GET endpoint. */
function healthUrl(base: string, kind: 'commerce' | 'evolution'): string {
  return kind === 'evolution' ? `${base}/` : `${base}/health`;
}

export function RenderWakeBeacon() {
  // Both bases are PUBLIC env vars (browser needs direct access to wake the
  // services). Fallback: same-origin /health proxies to the commerce backend.
  const commerceBase = normalizeBase(process.env.NEXT_PUBLIC_BACKEND_URL);
  const evolutionBase = normalizeBase(process.env.NEXT_PUBLIC_EVOLUTION_API_URL);

  const lastActivity = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const wakeBoth = () => {
      // Commerce backend (or same-origin proxy when no direct URL is set).
      ping(commerceBase ? healthUrl(commerceBase, 'commerce') : '/health');
      // Evolution API (WhatsApp gateway) — skipped silently when unset.
      if (evolutionBase) ping(healthUrl(evolutionBase, 'evolution'));
    };

    // ── 1. Wake on load ────────────────────────────────────────────
    if (document.readyState === 'complete') {
      wakeBoth();
    } else {
      window.addEventListener('load', wakeBoth, { once: true });
    }

    // ── 2. Track genuine user activity ────────────────────────────
    const onActivity = () => { lastActivity.current = Date.now(); };
    window.addEventListener('scroll', onActivity, { passive: true });
    window.addEventListener('click', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });
    window.addEventListener('mousemove', onActivity, { passive: true });

    // ── 3. Keep-alive loop while the user is present ──────────────
    const userPresent = () =>
      document.visibilityState === 'visible' &&
      Date.now() - lastActivity.current < USER_IDLE_TIMEOUT_MS;

    const startLoop = () => {
      if (timerRef.current) return;
      timerRef.current = setInterval(() => {
        if (userPresent()) {
          // User still on the site → keep BOTH services warm ahead of
          // Render's 15-minute idle window.
          wakeBoth();
        }
        // User idle/hidden → do nothing; the services may sleep normally.
      }, KEEPALIVE_INTERVAL_MS);
    };
    const stopLoop = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    // ── 4. Visibility: wake on return, pause when hidden ──────────
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Returned to the tab → wake both immediately (they may have
        // slept while the tab was in the background) and resume keep-alive.
        wakeBoth();
        startLoop();
      } else {
        // Hidden/background tab = not "present on the site" → stop pinging.
        stopLoop();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    startLoop();

    return () => {
      window.removeEventListener('load', wakeBoth);
      window.removeEventListener('scroll', onActivity);
      window.removeEventListener('click', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('mousemove', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
      stopLoop();
    };
  }, [commerceBase, evolutionBase]);

  return null;
}