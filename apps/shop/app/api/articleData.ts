"use server"
import backendClient from '../../Helpers/backendClient';

export default async function articlesDataHandler() {
  try {
    const response = await backendClient.get(`/api/articles`);
    return {status:response.status,data:response.data}
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
};
