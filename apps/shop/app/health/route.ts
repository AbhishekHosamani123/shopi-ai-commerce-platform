import { NextResponse } from 'next/server';

/**
 * Same-origin health passthrough for the Render wake-up beacon.
 * The browser beacon hits /health on the storefront; this route server-side
 * fetches the Render backend's /health (waking it) and returns immediately.
 * Fails silently (still 200) when the backend is unreachable so the beacon
 * never surfaces errors in the browser.
 */
export async function GET() {
  const backend = process.env.BACKEND_URL || 'http://localhost:3500';
  try {
    // Wake the backend; a 5s timeout keeps this cheap. We return regardless.
    await fetch(`${backend}/health`, {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store'
    }).catch(() => null);
  } catch {
    /* silent by design */
  }
  return NextResponse.json({ status: 'ok' });
}
