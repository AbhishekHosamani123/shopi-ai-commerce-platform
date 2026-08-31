"use server"
import { cookies } from 'next/headers';

export default async function merchantLogoutHandler() {
  const cookieStore = await cookies();
  // The merchant_session cookie is stored with path '/' (see merchantlogin.ts)
  // — a delete without an explicit path would target the request path instead
  // and silently fail to remove the cookie, leaving the session active.
  cookieStore.delete({ name: 'merchant_session', path: '/' });
  return { success: true };
}
