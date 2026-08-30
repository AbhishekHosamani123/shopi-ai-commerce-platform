"use server"
import backendClient from '../../Helpers/backendClient';
import { cookies } from 'next/headers';

async function getAuthHeaders() {
  const cookie = (await cookies()).get('sessionhold');
  const headers: Record<string, string> = {};
  if (cookie?.value) {
    headers['authorization'] = `Bearer ${cookie.value}`;
    headers['x-user-token'] = cookie.value;
  }
  return headers;
}

interface propForm{
    userID:number;
  userName: string |boolean;
  email: string |boolean;
  mobile_number: number |boolean;
  dob: string|boolean;
  password:string|boolean;
}
interface Address {
    addressType:string;
    contactNumber:number;
    addressLine1:string
    addressLine2:string
    city:string;
    state:string;
    country:string;
    postalCode:string;
    userName:string;
}

export async function userUpdateHandler({ userID,userName, email, mobile_number, dob,password }:propForm) {
  try {
    const headers = await getAuthHeaders();
    const response = await backendClient.put(`/api/update/user`, { userID, userName, email, mobile_number, dob,password }, { headers });
    return {status:response.status}
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
};
export async function userAddressUpdateHandler({ addressType,contactNumber,addressLine1,addressLine2,city,state,country,postalCode,userName }:Address,userID:number,addressID:number) {
    try {
      const headers = await getAuthHeaders();
      const response = await backendClient.put(`/api/update/user/update/address`, { userID,addressID,addressType,contactNumber,addressLine1,addressLine2,city,state,country,postalCode,userName }, { headers });
      return {status:response.status}
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 500, error: 'Internal Server Error' };
    }
};
export async function userAddressAddHandler({ addressType,contactNumber,addressLine1,addressLine2,city,state,country,postalCode,userName }:Address,userID:number) {
  try {
    const headers = await getAuthHeaders();
    const response = await backendClient.post(`/api/update/user/insert/address`, { addressType,userID,contactNumber,addressLine1,addressLine2,city,state,country,postalCode,userName }, { headers });
    return {status:response.status,addressID:response.data.addressid}
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
};
export async function userAddressDeleteHandler(addressID:number,userID:number) {
  try {
    const headers = await getAuthHeaders();
    const response = await backendClient.delete(`/api/update/user/delete/address`, {
      headers,
      data:{ addressID, userID }
    });
    return {status:response.status}
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
};
export async function userAddressDefaultHandler(addressID:number,userID:number) {
  try {
    const headers = await getAuthHeaders();
    const response = await backendClient.post(`/api/update/user/set-default-address`,{ addressID, userID }, { headers });
    return {status:response.status}
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
};
export async function cartQuantityHandler(cartItemID:number,productID:number | string,userID:number,action:string) {
  try {
    const headers = await getAuthHeaders();
    const response = await backendClient.post(`/api/update/user/cart-quantity`,{ cartItemID,productID,userID,action }, { headers });
    return {status:response.status}
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
};
