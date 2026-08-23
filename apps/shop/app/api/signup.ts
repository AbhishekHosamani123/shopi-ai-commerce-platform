"use server"
import backendClient from '../../Helpers/backendClient';
import { cookies } from 'next/headers';

interface propForm{
  userName: string;
  email: string;
  password: string;
  mobile_number: number;
  dob: string;
}

export default async function signUpHandler({ userName, email, password, mobile_number, dob }:propForm,promotional:boolean) {
  try {
    const response = await backendClient.post(`/api/user/signup/${promotional}`, { userName, email, password, mobile_number, dob });
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
