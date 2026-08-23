"use server"
import backendClient from '../../Helpers/backendClient';

export async function categoryFilterHandler({minPrice,maxPrice,categoryID,minRating,categoryName}:{minPrice:number,maxPrice:number,categoryID:number,minRating:number,categoryName:string|string[]}) {
  try {
    const response = await backendClient.get(`/api/filter/category/${minPrice}/${maxPrice}/${categoryID}/${minRating}/${categoryName}`);
    return {status:response.status,data:response.data}
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
};
export async function categoryOnlyFilterHandler({categoryID,categoryName}:{categoryID:number,categoryName:string|string[]}) {
    try {
      const response = await backendClient.get(`/api/filter/category-only/${categoryID}/${categoryName}`);
      return {status:response.status,data:response.data}
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 500, error: 'Internal Server Error' };
    }
};
