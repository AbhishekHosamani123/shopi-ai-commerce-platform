"use server"
import backendClient from '../../Helpers/backendClient';
import { cookies } from 'next/headers';

/**
 * Merchant/Admin sign-in.
 *
 * Authenticates against the backend /api/user/merchant-login (which verifies
 * bcrypt password + role gate) and stores the resulting JWT in a dedicated
 * httpOnly `merchant_session` cookie — separate from the customer
 * `sessionhold` cookie so a merchant session and a customer session can
 * coexist on the same browser. The token is never exposed to client JS.
 */
export default async function merchantLoginHandler({
  identifier,
  password,
}: {
  identifier: string;
  password: string;
}) {
  try {
    const response = await backendClient.post(`/api/user/merchant-login`, {
      identifier,
      password,
    });

    if (response.status === 200 && response.data?.token) {
      const cookieStore = await cookies();
      // Remove any cookie previously stored under the old path ('/merchant'),
      // then store under '/' so /api/merchant/* proxy requests include it.
      cookieStore.delete('merchant_session');
      cookieStore.set({
        name: 'merchant_session',
        value: response.data.token,
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 12 * 60 * 60, // 12h — matches backend merchant token expiry
        // Path must be '/' (not '/merchant') so the cookie is also sent on
        // /api/merchant/* proxy requests — the dashboard's API calls live
        // under /api, not /merchant, and a path-scoped cookie would be
        // silently omitted, causing 401s on every dashboard fetch.
        path: '/',
      });
    }

    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
}
