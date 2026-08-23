"use server"
import backendClient from '../../Helpers/backendClient';
import { cookies } from 'next/headers';

export default async function signInHandler({email,password,remember}:{email:string,password:string,remember:boolean}) {
  try {
    const response = await backendClient.post(`/api/user/signin/${remember}`, { email, password });
    const cookieStore = await cookies();
    if(remember){
      cookieStore.set({
        name: 'sessionhold',
        value: response.data.token,
        httpOnly: true,
        secure:true,
        maxAge:24 * 60 * 60 * 1000 * 7
      })
    }else{
      cookieStore.set({
        name: 'sessionhold',
        value: response.data.token,
        httpOnly: true,
        secure:true,
        maxAge:24 * 60 * 60 * 1000
      })
    }
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
};
