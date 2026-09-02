"use server"
import backendClient from '../../Helpers/backendClient';
import { cookies } from 'next/headers';

export default async function signInHandler({email,password,remember}:{email:string,password:string,remember:boolean}) {
  try {
    const response = await backendClient.post(`/api/user/signin/${remember}`, { email, password });
    const cookieStore = await cookies();
    // maxAge is in SECONDS. The previous values used milliseconds
    // (604,800,000s ≈ 19 years) which exceeds Vercel's 1-year cookie cap and
    // made the Set-Cookie silently invalid — the session never persisted, so
    // checkout redirected every logged-in user back to /sign-in.
    const sessionMaxAge = remember ? 7 * 24 * 60 * 60 : 24 * 60 * 60;
    cookieStore.set({
      name: 'sessionhold',
      value: response.data.token,
      httpOnly: true,
      secure: true,
      maxAge: sessionMaxAge,
      path: '/',
      sameSite: 'lax'
    });
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
};
