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
exports.validateCouponCreation = validateCouponCreation;
const DB_1 = require("../data/DB");
const coupon_types_1 = require("./coupon-types");
/**
 * Validates promotional discount safety rules before coupon creation.
 */
function validateCouponCreation(input) {
    return __awaiter(this, void 0, void 0, function* () {
        // 1. Discount Percentage Boundary Check
        if (input.discountPct <= 0) {
            return {
                isValid: false,
                reason: 'Discount percentage must be greater than 0%.'
            };
        }
        if (input.discountPct > coupon_types_1.DEFAULT_COUPON_RULES.maxDiscountPct) {
            return {
                isValid: false,
                reason: `Discount of ${input.discountPct}% exceeds maximum safety threshold of ${coupon_types_1.DEFAULT_COUPON_RULES.maxDiscountPct}%.`
            };
        }
        // 2. Validity Window Check
        const validity = input.validityDays || 14;
        if (validity > coupon_types_1.DEFAULT_COUPON_RULES.maxValidityDays) {
            return {
                isValid: false,
                reason: `Coupon validity of ${validity} days exceeds maximum threshold of ${coupon_types_1.DEFAULT_COUPON_RULES.maxValidityDays} days.`
            };
        }
        // 3. Product Catalog Existence & Minimum Price Check
        const prodRes = yield DB_1.client.query(`SELECT productid, title, price, stock FROM products WHERE productid = $1`, [input.productId]);
        if (prodRes.rows.length === 0) {
            return {
                isValid: false,
                reason: `Product ID ${input.productId} was not found in catalog database.`
            };
        }
        const prod = prodRes.rows[0];
        const price = parseFloat(prod.price);
        const stock = parseInt(prod.stock, 10);
        if (price < coupon_types_1.DEFAULT_COUPON_RULES.minProductPrice) {
            return {
                isValid: false,
                reason: `Product price of ₹${price} is below minimum allowed coupon threshold of ₹${coupon_types_1.DEFAULT_COUPON_RULES.minProductPrice}.`
            };
        }
        return {
            isValid: true,
            product: {
                productId: prod.productid,
                title: prod.title,
                price,
                currentStock: stock
            }
        };
    });
}
