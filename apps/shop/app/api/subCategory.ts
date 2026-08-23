"use server"
import backendClient from '../../Helpers/backendClient';

export default async function subCategoryDataHandler(mainCategory:string | string[],subCategory:string | string[]) {
  try {
    const response = await backendClient.get(`/api/sub-category/${mainCategory}/${subCategory}`);
    return {status:response.status,data:response.data}
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
};
export async function subCategoryFilteredHandler({categoryID,minPrice,maxPrice,rating}:{categoryID:number,minPrice:number,maxPrice:number,rating:number}) {
    try {
      const response = await backendClient.get(`/api/sub-category/filtered-product/${categoryID}/${minPrice}/${maxPrice}/${rating}`);
      return {status:response.status,data:response.data}
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 500, error: 'Internal Server Error' };
    }
};
