"use server"
import backendClient from '../../Helpers/backendClient';

export default async function resetPassHandler({email,password,otp}:{email:string,password:string,otp:string}) {
  try {
    const response = await backendClient.post(`/api/user/reset-password`, {email,password,otp});
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
};
