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
exports.validateActionForApproval = validateActionForApproval;
const DB_1 = require("../data/DB");
/**
 * Validates business state, tenant ownership, and expiration before action execution.
 */
function validateActionForApproval(action_1) {
    return __awaiter(this, arguments, void 0, function* (action, requestingMerchantId = 'default_merchant') {
        var _a;
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
        // 4. Product Existence & Business State Revalidation
        if (action.productId) {
            const prodRes = yield DB_1.client.query(`SELECT productid, title, stock, price, discount FROM products WHERE productid = $1`, [action.productId]);
            if (prodRes.rows.length === 0) {
                return {
                    isValid: false,
                    reason: `Product ID ${action.productId} was not found in catalog database.`
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
                const stockAtCreation = (_a = action.payload) === null || _a === void 0 ? void 0 : _a.stockAtRecommendation;
                if (typeof stockAtCreation === 'number') {
                    const stockDiff = currentStock - stockAtCreation;
                    // If stock changed significantly (>= 25 units in either direction or moved far from snapshot)
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
        else if (action.actionType === 'RESTOCK' || action.actionType === 'DISCOUNT' || action.actionType === 'PROMOTION') {
            return {
                isValid: false,
                reason: `Valid product reference is required for ${action.actionType} action.`
            };
        }
        return { isValid: true };
    });
}
