"use server"
import backendClient from '../../Helpers/backendClient';
import { cookies } from 'next/headers';

export default async function sessionHandler() {
  const cookie = (await cookies()).get('sessionhold');
  if(cookie){
    try {
        const response = await backendClient.post(`/api/user/session-check`, {token:cookie.value});
        return {status:response.status,data:response.data}
    } catch (error) {
        return {status:500,error: 'Internal Server Error' }
    }
  }else
    return {status:500,error: 'Cookie Not Found' };
};
