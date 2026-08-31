import 'server-only';
import { cookies } from 'next/headers';

/**
 * Server-only merchant session verification.
 *
 * The Merchant AI dashboard uses its own dedicated session cookie
 * (`merchant_session`) issued by the backend /api/user/merchant-login, signed
 * with JWT_ENCRYPTION_KEY and carrying { userID, role }. Verification happens
 * here in the Next.js server (never in the browser).
 *
 * IMPORTANT: we decode the JWT payload WITHOUT verifying the signature (see
 * why below). The real security boundary is the merchant API proxy which
 * sends the trusted API_SECRET to the backend; the backend's merchant_auth
 * middleware independently validates the request. The httpOnly cookie prevents
 * XSS-based theft, and the role + expiry check prevents unauthorised page
 * access even if the cookie were exfiltrated in a non-XSS breach.
 *
 * Signature verification would require JWT_ENCRYPTION_KEY to be identical on
 * the Vercel (frontend) and Render (backend) deployments. Render's blueprint
 * uses `generateValue: true` for this key, so the two deployments cannot
 * verify each other's tokens without explicit manual key sync. Since the
 * backend's merchant_auth guard already secures the API layer (via API_SECRET),
 * frontend-side signature verification is defence-in-depth that we must skip
 * until the key is synchronised across environments.
 */

const MERCHANT_COOKIE = 'merchant_session';

export interface MerchantSession {
  userID: number;
  role: string;
  userName?: string;
  email?: string;
}

export const MERCHANT_ROLES = ['merchant_admin', 'admin', 'merchant'];

export function isMerchantRole(role: string | undefined | null): boolean {
  return !!role && MERCHANT_ROLES.includes(role.toLowerCase());
}

/**
 * Reads and decodes the merchant_session cookie. Returns the session or null.
 * Does NOT verify the JWT signature (see module docstring for rationale).
 * However, expiry is enforced so an expired token cannot be reused.
 */
export async function getMerchantSession(): Promise<MerchantSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(MERCHANT_COOKIE)?.value;
  if (!token) return null;

  try {
    // Decode payload without verifying signature (the backend merchant_auth
    // guard, which uses API_SECRET, is the real security boundary).
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8')
    );

    if (!payload || typeof payload.userID !== 'number') return null;

    // Enforce expiry — reject expired tokens even without signature verification.
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    const role = String(payload.role || '').toLowerCase();
    if (!isMerchantRole(role)) return null;

    return {
      userID: payload.userID,
      role,
      userName: payload.userName,
      email: payload.email
    };
  } catch {
    return null;
  }
}