"use server"
import { cookies } from 'next/headers';

export default async function merchantLogoutHandler() {
  const cookieStore = await cookies();
  cookieStore.delete('merchant_session');
  return { success: true };
}