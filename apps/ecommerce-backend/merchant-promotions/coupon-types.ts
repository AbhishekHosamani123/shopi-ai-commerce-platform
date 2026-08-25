/**
 * ⚡ Merchant AI Smart Coupon & Promotion Engine Types (Phase 3C)
 */

export interface CouponRuleConfig {
  maxDiscountPct: number; // 20% default max
  minProductPrice: number; // ₹100 min
  maxValidityDays: number; // 30 days max
  requireMerchantApproval: boolean;
}

export const DEFAULT_COUPON_RULES: CouponRuleConfig = {
  maxDiscountPct: 20,
  minProductPrice: 100,
  maxValidityDays: 30,
  requireMerchantApproval: true
};

export interface MerchantAiCouponRecord {
  couponId: string;
  merchantId: string;
  code: string;
  discountPct: number;
  productId?: number | null;
  productTitle?: string | null;
  actionId?: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'DISABLED';
  minOrderAmount: number;
  maxDiscountAmount?: number | null;
  validFrom: string;
  validUntil: string;
  createdAt: string;
}

export interface CreateCouponInput {
  productId: number;
  discountPct: number;
  code?: string;
  actionId?: string;
  validityDays?: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  merchantId?: string;
}
