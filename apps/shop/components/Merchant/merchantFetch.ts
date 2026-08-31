'use client';

/**
 * Merchant API fetch wrapper with automatic session-expiry handling.
 *
 * All /api/merchant/* requests go through the Next.js proxy route which
 * validates the merchant_session cookie. When the session has expired (12h
 * token lifetime) or was cleared, the proxy responds 401. Without this
 * wrapper every dashboard component would surface a confusing
 * "Unauthorized" error banner while the user still appears logged in.
 *
 * Behaviour:
 *  - 401 response → clear the stale session server-side and redirect to
 *    /merchant-sign-in once (a session-wide guard prevents redirect loops
 *    when several parallel requests fail at the same time).
 *  - Every other status is passed through untouched, preserving existing
 *    per-component error handling.
 */
let redirectingToLogin = false;

export async function merchantFetch(
  input: string,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init);

  if (res.status === 401 && !redirectingToLogin) {
    redirectingToLogin = true;
    try {
      // Clear the expired cookie server-side (it is httpOnly so JS cannot
      // remove it directly), then send the merchant to the login page.
      const { default: merchantLogoutHandler } = await import(
        '@/app/api/merchantlogout'
      );
      await merchantLogoutHandler();
    } catch {
      // Even if the cookie clear fails, the redirect below still lands the
      // user on the sign-in page where a fresh session is created.
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/merchant-sign-in';
    }
  }

  return res;
}
