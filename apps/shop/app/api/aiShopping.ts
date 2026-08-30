"use server";
import backendClient from '../../Helpers/backendClient';
import { cookies } from 'next/headers';

export interface ShopiAIContext {
  pageType: string;
  currentProduct?: {
    productId?: string | number;
    sku?: string;
    title?: string;
    price?: number;
    mrp?: number;
    category?: string;
    selectedColor?: string;
    selectedSize?: string;
    selectedVariantImage?: string;
  };
  selectedVariant?: {
    color?: string;
    size?: string;
    imageUrl?: string;
  };
  activeFilters?: {
    category?: string;
    subcategory?: string;
    minPrice?: number;
    maxPrice?: number;
    rating?: number;
    gender?: string;
  };
  cart?: Array<{
    productId: string;
    sku?: string;
    name: string;
    price: number;
    quantity: number;
    color?: string;
    size?: string;
  }>;
  recentlyViewed?: Array<{
    productId: string;
    sku: string;
    title: string;
  }>;
  searchQuery?: string;
}

export interface AiChatMessagePayload {
  message: string;
  userId?: number;
  conversationId?: string;
  context?: ShopiAIContext;
}

export interface RealCartItemData {
  cartItemId: number;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  currency: string;
  imageUrl: string;
  category?: string;
  color?: string;
  size?: string;
  itemTotal: number;
}

export interface RealCartStateData {
  items: RealCartItemData[];
  itemCount: number;
  total: number;
  currency: string;
}

export interface AiProductCardData {
  id?: string;
  productId: string;
  sku?: string;
  title?: string;
  name: string;
  price: number;
  mrp?: number;
  discountPercentage?: number;
  currency: string;
  imageUrl: string;
  category?: string;
  description?: string;
  color?: string;
  size?: string;
  inStock?: boolean;
  stars?: number;
  rating?: number;
  reviewCount?: number;
}

export interface CheckoutActionData {
  available: boolean;
  url: string;
  isCartEmpty?: boolean;
  itemCount?: number;
  total?: number;
}

export interface UserAddressData {
  addressID: number;
  userID: number;
  addressType: string;
  userName: string;
  contactNumber: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  is_default: boolean;
}

export interface AiChatResponse {
  success: boolean;
  intent?: string;
  message?: string;
  products?: AiProductCardData[];
  cart?: RealCartStateData;
  checkout?: CheckoutActionData;
  addresses?: UserAddressData[];
  selectedAddress?: UserAddressData;
  model?: string;
  userId?: number;
  conversationId?: string;
  error?: string;
}

/**
 * Server Action: Send user prompt to backend AI shopping route (POST /api/ai/chat)
 * Securely forwards session cookie & backend secret token server-side.
 */
export async function sendAiShoppingMessage(payload: AiChatMessagePayload): Promise<{ status: number; data: AiChatResponse }> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sessionhold')?.value;

    const headers: Record<string, string> = {};
    if (token) {
      headers['x-user-token'] = token;
      headers['authorization'] = `Bearer ${token}`;
    }

    const res = await backendClient.post<AiChatResponse>('/api/ai/chat', payload, { headers });
    return {
      status: res.status,
      data: res.data,
    };
  } catch (error: any) {
    if (error.response) {
      return {
        status: error.response.status,
        data: error.response.data || { success: false, error: 'AI server responded with an error.' },
      };
    }
    return {
      status: 500,
      data: {
        success: false,
        error: error.message || 'Unable to connect to AI shopping service. Please ensure the backend is running.',
      },
    };
  }
}
