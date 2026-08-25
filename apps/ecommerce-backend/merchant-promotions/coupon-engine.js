"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCoupon = createCoupon;
exports.listCoupons = listCoupons;
exports.getCouponByCode = getCouponByCode;
const DB_1 = require("../data/DB");
const coupon_validator_1 = require("./coupon-validator");
function mapRowToCoupon(r) {
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
function createCoupon(input) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const merchantId = input.merchantId || 'default_merchant';
        // 1. Safety validation
        const validation = yield (0, coupon_validator_1.validateCouponCreation)(input);
        if (!validation.isValid) {
            return { success: false, error: validation.reason };
        }
        // 2. Prevent duplicate active coupons for same product
        const dupCheck = yield DB_1.client.query(`SELECT * FROM merchant_ai_coupons 
     WHERE merchant_id = $1 AND product_id = $2 AND status = 'ACTIVE' AND valid_until > CURRENT_TIMESTAMP`, [merchantId, input.productId]);
        if (dupCheck.rows.length > 0) {
            return {
                success: false,
                error: `An active coupon (${dupCheck.rows[0].code}) already exists for "${(_a = validation.product) === null || _a === void 0 ? void 0 : _a.title}".`
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
        const res = yield DB_1.client.query(insertQuery, [
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
        record.productTitle = (_b = validation.product) === null || _b === void 0 ? void 0 : _b.title;
        return { success: true, coupon: record };
    });
}
/**
 * Lists all coupons for a merchant.
 */
function listCoupons() {
    return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
        const query = `
    SELECT c.*, p.title as product_title 
    FROM merchant_ai_coupons c
    LEFT JOIN products p ON c.product_id = p.productid
    WHERE c.merchant_id = $1 OR $1 = 'merchant_admin'
    ORDER BY c.created_at DESC;
  `;
        const res = yield DB_1.client.query(query, [merchantId]);
        return res.rows.map(mapRowToCoupon);
    });
}
/**
 * Retrieves coupon by code.
 */
function getCouponByCode(code_1) {
    return __awaiter(this, arguments, void 0, function* (code, merchantId = 'default_merchant') {
        const query = `
    SELECT c.*, p.title as product_title 
    FROM merchant_ai_coupons c
    LEFT JOIN products p ON c.product_id = p.productid
    WHERE UPPER(c.code) = UPPER($1) AND (c.merchant_id = $2 OR $2 = 'merchant_admin')
    LIMIT 1;
  `;
        const res = yield DB_1.client.query(query, [code, merchantId]);
        if (res.rows.length === 0)
            return null;
        return mapRowToCoupon(res.rows[0]);
    });
}
