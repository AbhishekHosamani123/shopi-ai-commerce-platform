/**
 * Bounded Evolution gateway warm-assist.
 *
 * When a merchant clicks "Connect" and the Evolution Render service is asleep,
 * waiting for Render's own wake-up cadence can feel broken. This helper pings
 * the gateway every 10 seconds for up to 2 minutes (MAX 12 requests) to pull
 * it out of sleep faster.
 *
 * Guardrails (anti-abuse):
 *  - Triggered ONLY by an actual merchant Connect attempt.
 *  - Single-flight: concurrent triggers share one loop.
 *  - Hard-capped at 12 pings then stops — never an infinite keep-alive.
 *  - The frontend modal independently retries every 20s, so the pair
 *    (frontend poll + backend assist) converges as soon as the service is up.
 */

let assistInFlight: Promise<void> | null = null;
let lastAssistAt = 0;
const ASSIST_COOLDOWN_MS = 60_000; // don't start a new loop more than once a minute

export function warmEvolutionGateway(): void {
  const now = Date.now();
  if (assistInFlight) return; // already running
  if (now - lastAssistAt < ASSIST_COOLDOWN_MS) return; // recently assisted

  assistInFlight = (async () => {
    try {
      const { evolutionApiClient } = await import('./evolution-api-client');
      const cfg = evolutionApiClient.describeConfig();
      if (!cfg.configured) return;

      console.log('[Evolution Warm] Gateway cold-start detected — assisting wake-up (max 2 min)...');
      const MAX_PINGS = 12;
      const INTERVAL_MS = 10_000;

      for (let i = 0; i < MAX_PINGS; i++) {
        await new Promise(r => setTimeout(r, INTERVAL_MS));
        try {
          // Cheap reachability probe — any HTTP response means the service
          // is up (even 401/404 count as "awake"); only network failures /
          // 502-class responses mean still sleeping.
          const res = await fetch(`${cfg.baseUrl.replace(/\/+$/, '')}/`, {
            method: 'GET',
            signal: AbortSignal.timeout(8000)
          });
          if (res.status !== 502 && res.status !== 503 && res.status !== 504) {
            console.log(`[Evolution Warm] Gateway is awake (HTTP ${res.status}) after ${(i + 1) * 10}s.`);
            return;
          }
        } catch {
          // still sleeping — keep pinging
        }
      }
      console.warn('[Evolution Warm] Gateway did not come up within 2 minutes.');
    } catch (e: any) {
      console.warn('[Evolution Warm] Assist skipped:', e.message);
    } finally {
      assistInFlight = null;
      lastAssistAt = Date.now();
    }
  })();
}
