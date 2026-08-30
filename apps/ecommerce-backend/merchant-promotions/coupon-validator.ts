import { client } from '../data/DB';
import { DEFAULT_COUPON_RULES, CreateCouponInput } from './coupon-types';

export interface CouponValidationResult {
  isValid: boolean;
  reason?: string;
  product?: {
    productId: number;
    title: string;
    price: number;
    currentStock: number;
  };
}

/**
 * Validates promotional discount safety rules before coupon creation.
 */
export async function validateCouponCreation(input: CreateCouponInput): Promise<CouponValidationResult> {
  // 1. Discount Percentage Boundary Check
  if (input.discountPct <= 0) {
    return {
      isValid: false,
      reason: 'Discount percentage must be greater than 0%.'
    };
  }

  if (input.discountPct > DEFAULT_COUPON_RULES.maxDiscountPct) {
    return {
      isValid: false,
      reason: `Discount of ${input.discountPct}% exceeds maximum safety threshold of ${DEFAULT_COUPON_RULES.maxDiscountPct}%.`
    };
  }

  // 2. Validity Window Check
  const validity = input.validityDays || 14;
  if (validity > DEFAULT_COUPON_RULES.maxValidityDays) {
    return {
      isValid: false,
      reason: `Coupon validity of ${validity} days exceeds maximum threshold of ${DEFAULT_COUPON_RULES.maxValidityDays} days.`
    };
  }

  // 3. Product Catalog Existence & Minimum Price Check
  const prodRes = await client.query(
    `SELECT product_id, sku, title, selling_price as price, stock_quantity as stock FROM shopi_products WHERE product_id = $1`,
    [input.productId]
  );

  if (prodRes.rows.length === 0) {
    return {
      isValid: false,
      reason: `Product ID ${input.productId} was not found in catalog database.`
    };
  }

  const prod = prodRes.rows[0];
  const price = parseFloat(prod.price);
  const stock = parseInt(prod.stock, 10);

  if (price < DEFAULT_COUPON_RULES.minProductPrice) {
    return {
      isValid: false,
      reason: `Product price of ₹${price} is below minimum allowed coupon threshold of ₹${DEFAULT_COUPON_RULES.minProductPrice}.`
    };
  }

  return {
    isValid: true,
    product: {
      productId: prod.product_id,
      title: prod.title,
      price,
      currentStock: stock
    }
  };
}
