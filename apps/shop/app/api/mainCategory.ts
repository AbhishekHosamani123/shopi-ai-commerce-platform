"use server"
import backendClient from '../../Helpers/backendClient';
import { getCachedData } from '../../Helpers/cache';

export default async function categoryDataHandler(mainCategory: string | string[]) {
  const catKey = Array.isArray(mainCategory) ? mainCategory.join('-') : mainCategory;
  return getCachedData(`category:${catKey}`, async () => {
    try {
      const response = await backendClient.get(`/api/category/${catKey}`);
      return { status: response.status, data: response.data };
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 500, error: 'Internal Server Error' };
    }
  }, 120);
}
