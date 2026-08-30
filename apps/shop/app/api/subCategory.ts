"use server"
import backendClient from '../../Helpers/backendClient';
import { getCachedData } from '../../Helpers/cache';

export default async function subCategoryDataHandler(
  mainCategory: string | string[],
  subCategory?: string | string[]
) {
  const main = Array.isArray(mainCategory) ? mainCategory.join('-') : (mainCategory || 'all');
  const sub = Array.isArray(subCategory) ? subCategory.join('-') : (subCategory || '');
  const key = `subcat:${main}:${sub || 'all'}`;

  return getCachedData(key, async () => {
    try {
      const endpoint = (sub && sub !== 'all')
        ? `/api/sub-category/${main}/${sub}`
        : `/api/sub-category/${main}`;
      const response = await backendClient.get(endpoint);
      return { status: response.status, data: response.data };
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 500, error: 'Internal Server Error' };
    }
  }, 120);
}

export async function subCategoryFilteredHandler({
  categoryID,
  minPrice,
  maxPrice,
  rating,
  mainCategory,
  subCategory,
}: {
  categoryID: number;
  minPrice: number;
  maxPrice: number;
  rating: number;
  mainCategory?: string | string[];
  subCategory?: string | string[];
}) {
  const main = Array.isArray(mainCategory) ? mainCategory.join('-') : (mainCategory || '');
  const sub = Array.isArray(subCategory) ? subCategory.join('-') : (subCategory || '');
  const key = `filter:${categoryID}:${minPrice}:${maxPrice}:${rating}:${main}:${sub}`;
  return getCachedData(key, async () => {
    try {
      const q = (main || sub) ? `?mainCategory=${encodeURIComponent(main)}&subCategory=${encodeURIComponent(sub)}` : '';
      const response = await backendClient.get(
        `/api/sub-category/filtered-product/${categoryID}/${minPrice}/${maxPrice}/${rating}${q}`
      );
      return { status: response.status, data: response.data };
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 500, error: 'Internal Server Error' };
    }
  }, 60);
}
