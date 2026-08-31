import 'server-only';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

/**
 * Server-only merchant session verification.
 *
 * The Merchant AI dashboard uses its own dedicated session cookie
 * (`merchant_session`) issued by the backend /api/user/merchant-login, signed
 * with JWT_ENCRYPTION_KEY and carrying { userID, role }. Verification happens
 * here in the Next.js server (never in the browser) using the same shared
 * secret, so:
 *  - an unauthenticated visitor gets no merchant session → 401/redirect;
 *  - a normal customer JWT (no role claim) is rejected by the role check;
 *  - the httpOnly cookie is never readable by client-side JS.
 *
 * JWT_ENCRYPTION_KEY must be configured in the frontend deployment env
 * (server-side only, same value as the backend). See .env.example.
 */

const MERCHANT_COOKIE = 'merchant_session';
const JWT_SECRET = process.env.JWT_ENCRYPTION_KEY || '';

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
 * Reads and verifies the merchant_session cookie. Returns the session or null.
 */
export async function getMerchantSession(): Promise<MerchantSession | null> {
  if (!JWT_SECRET) {
    // Misconfiguration: fail closed (treat as unauthenticated) and surface a
    // server-side warning instead of silently opening the dashboard.
    console.warn('[MerchantAuth] JWT_ENCRYPTION_KEY is not configured on the frontend.');
    return null;
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(MERCHANT_COOKIE)?.value;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded || typeof decoded.userID !== 'number') return null;
    const role = String(decoded.role || '').toLowerCase();
    if (!isMerchantRole(role)) return null;
    return {
      userID: decoded.userID,
      role,
      userName: decoded.userName,
      email: decoded.email
    };
  } catch {
    return null;
  }
}
