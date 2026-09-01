"use server";
import { cookies } from 'next/headers';

export default async function signOutHandler() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get('sessionhold');
  if (cookie) {
    try {
      // Delete with an explicit path matching how the cookie was set
      // (signin sets path '/'), otherwise the deletion silently misses.
      cookieStore.delete({ name: 'sessionhold', path: '/' });
      return true;
    } catch (error) {
      return false;
    }
  }
  return false;
};
