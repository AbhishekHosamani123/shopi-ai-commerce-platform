import { client } from '../data/DB';
import { MerchantAiActionRecord } from './action-types';

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  isExpired?: boolean;
  currentProductState?: {
    stock: number;
    price: number;
    discount: number;
    title: string;
  };
}

/**
 * Validates business state, tenant ownership, and expiration before action execution
 * against canonical shopi_* tables.
 */
export async function validateActionForApproval(
  action: MerchantAiActionRecord,
  requestingMerchantId: string = 'default_merchant'
): Promise<ValidationResult> {
  // 1. Tenant Ownership Guard
  if (action.merchantId !== requestingMerchantId && requestingMerchantId !== 'merchant_admin') {
    return {
      isValid: false,
      reason: 'Unauthorized: Merchant does not own this action recommendation.'
    };
  }

  // 2. Status Guard (Must be pending approval)
  if (action.status !== 'PENDING_APPROVAL') {
    return {
      isValid: false,
      reason: `Action is not pending approval. Current status: ${action.status}`
    };
  }

  // 3. Expiration Guard
  const now = new Date();
  const expiresAt = new Date(action.expiresAt);
  if (now > expiresAt) {
    return {
      isValid: false,
      isExpired: true,
      reason: `Action recommendation expired on ${expiresAt.toLocaleTimeString()}. Please request a fresh recommendation.`
    };
  }

  // 4. Product Existence & Business State Revalidation against shopi_products
  if (action.productId) {
    const prodRes = await client.query(
      `SELECT product_id, sku, title, stock_quantity as stock, selling_price as price, selling_price as discount FROM shopi_products WHERE product_id = $1`,
      [action.productId]
    );

    if (prodRes.rows.length === 0) {
      return {
        isValid: false,
        reason: `Product ID ${action.productId} was not found in canonical Supabase catalog.`
      };
    }

    const currentProd = prodRes.rows[0];
    const currentStock = parseInt(currentProd.stock, 10);
    const currentPrice = parseFloat(currentProd.price);
    const currentDiscount = parseFloat(currentProd.discount || currentProd.price);

    const productState = {
      stock: currentStock,
      price: currentPrice,
      discount: currentDiscount,
      title: currentProd.title
    };

    // Specific Revalidation for RESTOCK actions
    if (action.actionType === 'RESTOCK') {
      const stockAtCreation = action.payload?.stockAtRecommendation;
      if (typeof stockAtCreation === 'number') {
        const stockDiff = currentStock - stockAtCreation;
        if (Math.abs(stockDiff) >= 25 || (stockAtCreation <= 30 && currentStock > 75)) {
          return {
            isValid: false,
            currentProductState: productState,
            reason: `The inventory changed since this recommendation was created. Current stock is ${currentStock} units (was ${stockAtCreation} units). The previous recommendation is no longer valid.`
          };
        }
      }
    }

    // Specific Revalidation for PROMOTION actions
    if (action.actionType === 'PROMOTION') {
      if (currentStock < 10) {
        return {
          isValid: false,
          currentProductState: productState,
          reason: `Cannot launch promotion: Inventory for "${currentProd.title}" is too low (${currentStock} units). Restock first.`
        };
      }
    }

    return {
      isValid: true,
      currentProductState: productState
    };
  }

  return { isValid: true };
}
