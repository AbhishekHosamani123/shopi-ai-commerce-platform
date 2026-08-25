'use server'
import backendClient from '../../Helpers/backendClient';
import { getCachedData } from '../../Helpers/cache';

export async function bannerDataHandler() {
  return getCachedData('home:banner', async () => {
    try {
      const response = await backendClient.get(`/api/home/banner`);
      return { status: response.status, banners: response.data };
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 500, error: 'Internal Server Error' };
    }
  }, 120);
}

export async function dealDataHandler() {
  return getCachedData('home:deals', async () => {
    try {
      const response = await backendClient.get(`/api/home/deals`);
      return { status: response.status, deals: response.data };
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 500, error: 'Internal Server Error' };
    }
  }, 60);
}

export async function topDataHandler() {
  return getCachedData('home:trending', async () => {
    try {
      const response = await backendClient.get(`/api/home/trending`);
      return { status: response.status, data: response.data };
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 500, error: 'Internal Server Error' };
    }
  }, 60);
}

export async function sidebarDataHandler() {
  return getCachedData('home:best-sellers', async () => {
    try {
      const response = await backendClient.get(`/api/home/best-sellers`);
      return { status: response.status, data: response.data };
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 500, error: 'Internal Server Error' };
    }
  }, 60);
}

export async function homeProductsDataHandler() {
  return getCachedData('home:products', async () => {
    try {
      const response = await backendClient.get(`/api/home/products`);
      return { status: response.status, data: response.data };
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 500, error: 'Internal Server Error' };
    }
  }, 60);
}
