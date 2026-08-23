"use server"
import backendClient from '../../Helpers/backendClient';

interface cart{
    cartItemID:number,
    userID:number,
    productID:number,
    productPrice:number,
    colorID:number,
    sizeID:number,
    quantity: number,
}
interface wishlist{
    wishlistItemID:number,
    userID:number,
    productID:number,
}

async function cartAddHandler({cartItemID,userID,productID,productPrice,colorID,sizeID,quantity}:cart) {
  try {
    const response = await backendClient.post(`/api/user/insert/cartitem`, {cartItemID,userID,productID,productPrice,colorID,sizeID,quantity});
    return {status:response.status,message:'Successful'}
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
};

async function wishlistAddHandler({wishlistItemID,userID,productID}:wishlist) {
    try {
      const response = await backendClient.post(`/api/user/insert/wishlistitem`, {wishlistItemID,userID,productID});
      return {status:response.status,message:'Successful'}
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 500, error: 'Internal Server Error' };
    }
};
async function wishlistDeleteHandler({wishlistItemID,userID}:{wishlistItemID:number,userID:number}) {
    try {
      const response = await backendClient.delete(`/api/user/delete/wishlistitem`, {
        data:{wishlistItemID,userID}
      });
      return {status:response.status,message:'Successful'}
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 500, error: 'Internal Server Error' };
    }
};
async function cartDeleteHandler({userID,cartItemID}:{userID:number,cartItemID:number}) {
    try {
      const response = await backendClient.delete(`/api/user/delete/cartitem`, {
        data:{userID,cartItemID}
      });
      return {status:response.status,message:'Successful'}
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 500, error: 'Internal Server Error' };
    }
};
export {cartAddHandler,wishlistAddHandler,wishlistDeleteHandler,cartDeleteHandler}
