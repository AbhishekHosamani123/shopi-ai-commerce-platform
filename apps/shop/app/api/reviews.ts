"use server"
import backendClient from '../../Helpers/backendClient';

export async function reviewCreateHandler({userID,productID,rating,title,comment}:{userID:number,productID:number,rating:number,title:string,comment:string}) {
  try {
    const response = await backendClient.post(`/api/review/create`,{userID,productID,rating,title,comment});
    return {status:response.status}
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
};
export async function reviewEditHandler({reviewID,userID,productID,rating,title,comment}:{reviewID:number,userID:number,productID:number,rating:number,title:string,comment:string}) {
    try {
      const response = await backendClient.patch(`/api/review/edit`,{reviewID,userID,productID,rating,title,comment});
      return {status:response.status}
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 500, error: 'Internal Server Error' };
    }
};
export async function reviewDeleteHandler({reviewID,userID,productID}:{reviewID:number,userID:number,productID:number}) {
    try {
      const response = await backendClient.delete(`/api/review/delete`,{
          data:{reviewID,userID,productID}
      });
      return {status:response.status}
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 500, error: 'Internal Server Error' };
    }
};
export async function reviewGetHandler({productID}:{productID:string}) {
  try {
    const response = await backendClient.get(`/api/reviews/${productID}`);
    return {status:response.status,data:response.data}
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
};
