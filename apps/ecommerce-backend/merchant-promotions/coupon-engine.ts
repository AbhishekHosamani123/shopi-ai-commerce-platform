import { client } from '../data/DB';
import { validateCouponCreation } from './coupon-validator';
import { CreateCouponInput, MerchantAiCouponRecord } from './coupon-types';

function mapRowToCoupon(r: any): MerchantAiCouponRecord {
  return {
    couponId: r.coupon_id,
    merchantId: r.merchant_id,
    code: r.code,
    discountPct: parseFloat(r.discount_pct),
    productId: r.product_id ? parseInt(r.product_id, 10) : null,
    productTitle: r.product_title || null,
    actionId: r.action_id,
    status: r.status,
    minOrderAmount: parseFloat(r.min_order_amount || '0'),
    maxDiscountAmount: r.max_discount_amount ? parseFloat(r.max_discount_amount) : null,
    validFrom: r.valid_from,
    validUntil: r.valid_until,
    createdAt: r.created_at
  };
}

/**
 * Creates a validated merchant promotional coupon.
 */
export async function createCoupon(
  input: CreateCouponInput
): Promise<{ success: boolean; coupon?: MerchantAiCouponRecord; error?: string }> {
  const merchantId = input.merchantId || 'default_merchant';

  // 1. Safety validation
  const validation = await validateCouponCreation(input);
  if (!validation.isValid) {
    return { success: false, error: validation.reason };
  }

  // 2. Prevent duplicate active coupons for same product
  const dupCheck = await client.query(
    `SELECT * FROM merchant_ai_coupons 
     WHERE merchant_id = $1 AND product_id = $2 AND status = 'ACTIVE' AND valid_until > CURRENT_TIMESTAMP`,
    [merchantId, input.productId]
  );

  if (dupCheck.rows.length > 0) {
    return {
      success: false,
      error: `An active coupon (${dupCheck.rows[0].code}) already exists for "${validation.product?.title}".`
    };
  }

  // 3. Generate code & validity window
  const code = input.code
    ? input.code.toUpperCase().replace(/[^A-Z0-9_-]/g, '')
    : `SAVE${input.discountPct}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const couponId = `cpn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const validityDays = input.validityDays || 14;
  const validUntil = new Date(Date.now() + validityDays * 24 * 3600 * 1000).toISOString();

  const insertQuery = `
    INSERT INTO merchant_ai_coupons (
      coupon_id, merchant_id, code, discount_pct, product_id, action_id,
      status, min_order_amount, max_discount_amount, valid_until
    ) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, $8, $9)
    RETURNING *;
  `;

  const res = await client.query(insertQuery, [
    couponId,
    merchantId,
    code,
    input.discountPct,
    input.productId,
    input.actionId || null,
    input.minOrderAmount || 0,
    input.maxDiscountAmount || null,
    validUntil
  ]);

  const record = mapRowToCoupon(res.rows[0]);
  record.productTitle = validation.product?.title;

  return { success: true, coupon: record };
}

/**
 * Lists all coupons for a merchant.
 */
export async function listCoupons(
  merchantId: string = 'default_merchant'
): Promise<MerchantAiCouponRecord[]> {
  const query = `
    SELECT c.*, p.title as product_title 
    FROM merchant_ai_coupons c
    LEFT JOIN products p ON c.product_id = p.productid
    WHERE c.merchant_id = $1 OR $1 = 'merchant_admin'
    ORDER BY c.created_at DESC;
  `;

  const res = await client.query(query, [merchantId]);
  return res.rows.map(mapRowToCoupon);
}

/**
 * Retrieves coupon by code.
 */
export async function getCouponByCode(
  code: string,
  merchantId: string = 'default_merchant'
): Promise<MerchantAiCouponRecord | null> {
  const query = `
    SELECT c.*, p.title as product_title 
    FROM merchant_ai_coupons c
    LEFT JOIN products p ON c.product_id = p.productid
    WHERE UPPER(c.code) = UPPER($1) AND (c.merchant_id = $2 OR $2 = 'merchant_admin')
    LIMIT 1;
  `;

  const res = await client.query(query, [code, merchantId]);
  if (res.rows.length === 0) return null;
  return mapRowToCoupon(res.rows[0]);
}
