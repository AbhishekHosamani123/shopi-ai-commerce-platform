'use server'
import backendClient from '../../Helpers/backendClient';

export async function bannerDataHandler() {
  try {
    const response = await backendClient.get(`/api/home/banner`);
    return {status:response.status,banners:response.data};
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
};
export async function dealDataHandler() {
  try {
    const response = await backendClient.get(`/api/home/deals`);
    return {status:response.status,deals:response.data};
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
};
export async function topDataHandler() {
  try {
    const response = await backendClient.get(`/api/home/trending`);
    return {status:response.status,data:response.data};
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
};
export async function sidebarDataHandler() {
  try {
    const response = await backendClient.get(`/api/home/best-sellers`);
    return {status:response.status,data:response.data};
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
};
export async function homeProductsDataHandler() {
  try {
    const response = await backendClient.get(`/api/home/products`);
    return {status:response.status,data:response.data};
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
};
