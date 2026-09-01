"use server"
import backendClient from '../../Helpers/backendClient';
import { cookies } from 'next/headers';

export default async function authDataHandler(code:string) {
  try {
    const response = await backendClient.post(`/api/auth/google`,{code});
    // maxAge in SECONDS (previous ms value exceeded Vercel's 1-year cap and
    // silently invalidated the session cookie).
    (await cookies()).set({
      name: 'sessionhold',
      value: response.data.token,
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60,  // 7 days
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
}