"use server"
import backendClient from '../../Helpers/backendClient';

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
    // Do NOT store the token — the spec requires the user to see
    // "Account created successfully. You can now sign in." and then navigate
    // to the sign-in page manually.
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
}
