"use server"
import backendClient from '../../Helpers/backendClient';
import { cookies } from 'next/headers';

async function ordersHandler() {
  const cookie = (await cookies()).get('sessionhold');
  if(cookie){
    try {
        const response = await backendClient.post(`/api/user/orders`, {userIDToken:cookie.value});
        return {status:response.status,data:response.data}
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 500, error: 'Internal Server Error' };
    }
  }else
    return {status:250,error: 'Cookie Not Found' };
};
async function orderDetailHandler(orderID:string) {
  const cookie = (await cookies()).get('sessionhold');
  if(cookie){
    try {
        const response = await backendClient.get(`/api/user/order-detail/${cookie.value}/${orderID}`);
        return {status:response.status,data:response.data}
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 404, error: 'Internal Server Error' };
    }
  }else
    return {status:500,error: 'Cookie Not Found' };
};
export {ordersHandler,orderDetailHandler};
