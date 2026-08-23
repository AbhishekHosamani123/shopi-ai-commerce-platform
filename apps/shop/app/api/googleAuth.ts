"use server"
import backendClient from '../../Helpers/backendClient';
import { cookies } from 'next/headers';

export default async function authDataHandler(code:string) {
  try {
    const response = await backendClient.post(`/api/auth/google`,{code});
    (await cookies()).set({
      name: 'sessionhold',
      value: response.data.token,
      httpOnly: true,
      secure:true,
      maxAge:24 * 60 * 60 * 1000 * 7
    })
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
}
