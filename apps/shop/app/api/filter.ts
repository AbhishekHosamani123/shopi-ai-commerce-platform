"use server"
import backendClient from '../../Helpers/backendClient';
import { getCachedData } from '../../Helpers/cache';

export async function categoryFilterHandler({
  minPrice,
  maxPrice,
  categoryID,
  minRating,
  categoryName,
  subCategory
}: {
  minPrice: number;
  maxPrice: number;
  categoryID: number;
  minRating: number;
  categoryName: string | string[];
  subCategory?: string;
}) {
  const cat = Array.isArray(categoryName) ? categoryName.join('-') : categoryName;
  const subQuery = subCategory && subCategory !== 'All' && subCategory !== 'all' ? `?sub=${encodeURIComponent(subCategory)}` : '';
  const cacheKey = `filter:cat:${cat}:${subCategory || 'all'}:${minPrice}:${maxPrice}:${minRating}:${categoryID}`;

  return getCachedData(cacheKey, async () => {
    try {
      const response = await backendClient.get(`/api/filter/category/${minPrice}/${maxPrice}/${categoryID}/${minRating}/${cat}${subQuery}`);
      return { status: response.status, data: response.data };
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 500, error: 'Internal Server Error' };
    }
  }, 120);
}

export async function categoryOnlyFilterHandler({
  categoryID,
  categoryName,
  subCategory
}: {
  categoryID: number;
  categoryName: string | string[];
  subCategory?: string;
}) {
  const cat = Array.isArray(categoryName) ? categoryName.join('-') : categoryName;
  const subQuery = subCategory && subCategory !== 'All' && subCategory !== 'all' ? `?sub=${encodeURIComponent(subCategory)}` : '';
  const cacheKey = `filter:catonly:${cat}:${subCategory || 'all'}:${categoryID}`;

  return getCachedData(cacheKey, async () => {
    try {
      const response = await backendClient.get(`/api/filter/category-only/${categoryID}/${cat}${subQuery}`);
      return { status: response.status, data: response.data };
    } catch (error: any) {
      if (error.response) {
        return { status: error.response.status, data: error.response.data };
      }
      return { status: 500, error: 'Internal Server Error' };
    }
  }, 120);
}
