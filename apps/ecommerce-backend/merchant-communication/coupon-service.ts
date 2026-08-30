import { CouponSpecification } from '../merchant-campaigns/campaign-types';
import { validateCouponCreation } from '../merchant-promotions/coupon-validator';
import { client } from '../data/DB';

export class CouponService {
  /**
   * Builds and validates a structured coupon specification from campaign offer details.
   * PRODUCTION ACTIVATION REMAINS STRICTLY DISABLED IN PHASE 8A.
   */
  async buildCouponSpecification(params: {
    campaignId: string;
    merchantId: string;
    discountType: 'PERCENTAGE' | 'FIXED';
    discountValue: number;
    targetProductIds: number[];
    eligibleCustomerIds: number[];
    minOrderValue?: number;
    maxDiscountAmount?: number | null;
    validityDays?: number;
  }): Promise<{ isValid: boolean; couponSpec?: CouponSpecification; reason?: string }> {
    // 1. Validate discount boundaries
    if (params.discountValue <= 0) {
      return { isValid: false, reason: 'Coupon discount must be greater than 0.' };
    }

    if (params.discountType === 'PERCENTAGE' && params.discountValue > 40) {
      return { isValid: false, reason: `Discount of ${params.discountValue}% exceeds safety ceiling of 40%.` };
    }

    // 2. Validate product catalog existence & stock
    if (params.targetProductIds.length > 0) {
      const prodCheck = await client.query(`
        SELECT productid, title, price, stock FROM products WHERE productid = ANY($1::int[])
      `, [params.targetProductIds]);

      if (prodCheck.rows.length === 0) {
        return { isValid: false, reason: 'Target product not found in catalog.' };
      }
    }

    const validity = params.validityDays || 7;
    const now = new Date();
    const validUntil = new Date(now.getTime() + validity * 24 * 3600 * 1000).toISOString();

    const prefix = params.discountType === 'PERCENTAGE' ? `SAVE${params.discountValue}` : `OFF${params.discountValue}`;
    const uniqueSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `${prefix}_${uniqueSuffix}`;

    const spec: CouponSpecification = {
      couponCode: code,
      discountType: params.discountType,
      discountValue: params.discountValue,
      minOrderValue: params.minOrderValue || 0,
      maxDiscountAmount: params.maxDiscountAmount || null,
      eligibleProducts: params.targetProductIds,
      eligibleCustomerIds: params.eligibleCustomerIds,
      validFrom: now.toISOString(),
      validUntil,
      usageLimit: params.eligibleCustomerIds.length > 0 ? params.eligibleCustomerIds.length : 100,
      perCustomerLimit: 1
    };

    return {
      isValid: true,
      couponSpec: spec
    };
  }

  /**
   * Validates whether a coupon specification is safe to activate.
   * Note: In Phase 8A, actual production activation is blocked.
   */
  async validateCouponForActivation(couponSpec: CouponSpecification, merchantId: string): Promise<{
    canActivate: boolean;
    isProductionBlocked: boolean;
    reason: string;
  }> {
    // 1. Expiry check
    if (new Date(couponSpec.validUntil).getTime() < Date.now()) {
      return {
        canActivate: false,
        isProductionBlocked: true,
        reason: 'Coupon specification has expired.'
      };
    }

    // 2. Product stock verification
    if (couponSpec.eligibleProducts.length > 0) {
      const stockRes = await client.query(`
        SELECT stock FROM products WHERE productid = ANY($1::int[])
      `, [couponSpec.eligibleProducts]);

      const isOutOfStock = stockRes.rows.some(r => parseInt(r.stock, 10) <= 0);
      if (isOutOfStock) {
        return {
          canActivate: false,
          isProductionBlocked: true,
          reason: 'Target product is out of stock. Promotional coupon cannot be activated.'
        };
      }
    }

    // 3. Phase 8A Guard: Production coupon activation disabled
    return {
      canActivate: false,
      isProductionBlocked: true,
      reason: 'Production coupon activation is disabled by default in Phase 8A.'
    };
  }
}

export const couponService = new CouponService();
