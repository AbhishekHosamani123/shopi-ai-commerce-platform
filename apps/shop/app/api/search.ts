"use server"
import backendClient from '../../Helpers/backendClient';

export default async function searchProductHandler({productName}:{productName:string|string[]}) {
  try {
    const response = await backendClient.get(`/api/search/product/${productName}`);
    return {status:response.status,data:response.data}
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
};
export async function searchFilteredHandler({productName,minPrice,maxPrice,rating}:{productName:string|string[],minPrice:number,maxPrice:number,rating:number}) {
    try {
      const response = await backendClient.get(`/api/search/filtered-product/${productName}/${minPrice}/${maxPrice}/${rating}`);
      return {status:response.status,data:response.data}
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 500, error: 'Internal Server Error' };
    }
};
