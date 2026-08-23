"use server"
import { cookies } from 'next/headers';
export default async function signOutHandler() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get('sessionhold');
  if(cookie){
    try {
        cookieStore.delete('sessionhold');
        return true;
    } catch (error) {
        return false;
    }
  }else
    return false;
    
};