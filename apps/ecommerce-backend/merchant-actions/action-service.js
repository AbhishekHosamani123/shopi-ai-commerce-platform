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
exports.formatActionPreview = formatActionPreview;
exports.createAction = createAction;
exports.approveAction = approveAction;
exports.rejectAction = rejectAction;
exports.rollbackApprovedAction = rollbackApprovedAction;
const DB_1 = require("../data/DB");
const action_validator_1 = require("./action-validator");
const action_executor_1 = require("./action-executor");
const action_audit_1 = require("./action-audit");
/**
 * Creates a human-friendly ActionPreview from a database action record.
 */
function formatActionPreview(action) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    let recommendedChange = '';
    let impact = '';
    switch (action.actionType) {
        case 'RESTOCK': {
            const units = action.quantity || ((_a = action.payload) === null || _a === void 0 ? void 0 : _a.reorderTargetUnits) || 50;
            recommendedChange = `+${units} units replenishment`;
            impact = `Restores safety buffer to ~45 days based on ${((_b = action.payload) === null || _b === void 0 ? void 0 : _b.dailyVelocity7d) || 2.5} units/day velocity.`;
            break;
        }
        case 'DISCOUNT': {
            const disc = ((_c = action.payload) === null || _c === void 0 ? void 0 : _c.recommendedDiscountPct) || 10;
            const newPrice = ((_d = action.payload) === null || _d === void 0 ? void 0 : _d.suggestedDiscountPrice) || Math.round((((_e = action.payload) === null || _e === void 0 ? void 0 : _e.originalPrice) || 999) * (1 - disc / 100));
            recommendedChange = `${disc}% discount (₹${newPrice.toLocaleString('en-IN')})`;
            impact = `Revives sell-through on slow-moving inventory tied up in storage.`;
            break;
        }
        case 'PROMOTION': {
            recommendedChange = 'Feature in Hero Banner & Category Spotlight';
            impact = `Capitalizes on strong ${((_f = action.payload) === null || _f === void 0 ? void 0 : _f.revenueGrowthPct) ? `+${action.payload.revenueGrowthPct}%` : 'high'} sales momentum.`;
            break;
        }
        case 'MARK_FOR_REVIEW': {
            recommendedChange = 'Initiate Returns & Quality Audit';
            impact = `Investigates high return rate anomaly to reduce store refund losses.`;
            break;
        }
    }
    return {
        actionId: action.actionId,
        type: action.actionType,
        status: action.status,
        productId: action.productId,
        productName: action.productName,
        quantity: action.quantity,
        currentStock: (_g = action.payload) === null || _g === void 0 ? void 0 : _g.stockAtRecommendation,
        recommendedChange,
        estimatedCoverage: ((_h = action.payload) === null || _h === void 0 ? void 0 : _h.estimatedCoverageDays) ? `~${action.payload.estimatedCoverageDays} days remaining` : undefined,
        reason: action.reason,
        impact,
        expiresAt: action.expiresAt,
        requiresApproval: true,
        payload: action.payload
    };
}
/**
 * Creates a new PENDING_APPROVAL action recommendation.
 */
function createAction(input) {
    return __awaiter(this, void 0, void 0, function* () {
        const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const merchantId = input.merchantId || 'default_merchant';
        const expiresIn = input.expiresInMinutes || 60; // 60 minutes default expiration
        const expiresAt = new Date(Date.now() + expiresIn * 60 * 1000).toISOString();
        // If product name is missing, query it
        let productName = input.productName;
        if (!productName && input.productId) {
            const prodRes = yield DB_1.client.query('SELECT title FROM products WHERE productid = $1', [input.productId]);
            if (prodRes.rows[0]) {
                productName = prodRes.rows[0].title;
            }
        }
        const query = `
    INSERT INTO merchant_ai_actions (
      action_id, merchant_id, action_type, status, product_id, product_name,
      quantity, payload, reason, expires_at, idempotency_key
    ) VALUES ($1, $2, $3, 'PENDING_APPROVAL', $4, $5, $6, $7, $8, $9, $10)
    RETURNING *;
  `;
        const res = yield DB_1.client.query(query, [
            actionId,
            merchantId,
            input.actionType,
            input.productId || null,
            productName || null,
            input.quantity || null,
            JSON.stringify(input.payload || {}),
            input.reason,
            expiresAt,
            input.idempotencyKey || null
        ]);
        const row = res.rows[0];
        return {
            actionId: row.action_id,
            merchantId: row.merchant_id,
            actionType: row.action_type,
            status: row.status,
            productId: row.product_id ? parseInt(row.product_id, 10) : null,
            productName: row.product_name,
            quantity: row.quantity !== null && row.quantity !== undefined ? parseInt(row.quantity, 10) : null,
            payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
            reason: row.reason,
            createdAt: row.created_at,
            expiresAt: row.expires_at,
            requiresApproval: true
        };
    });
}
/**
 * Handles explicit merchant approval with revalidation and safe execution.
 */
function approveAction(actionId_1) {
    return __awaiter(this, arguments, void 0, function* (actionId, approvedBy = 'merchant_admin', requestingMerchantId = 'default_merchant', idempotencyKey) {
        const action = yield (0, action_audit_1.getActionById)(actionId, requestingMerchantId);
        if (!action) {
            return {
                success: false,
                action: null,
                message: `Action recommendation "${actionId}" was not found.`,
                error: 'Action not found'
            };
        }
        // Idempotency check: If already completed, return existing completed record
        if (action.status === 'COMPLETED') {
            return {
                success: true,
                action,
                message: `Action "${actionId}" has already been approved and executed.`
            };
        }
        // 1. Validate action & revalidate business state
        const validation = yield (0, action_validator_1.validateActionForApproval)(action, requestingMerchantId);
        if (!validation.isValid) {
            if (validation.isExpired) {
                yield DB_1.client.query(`UPDATE merchant_ai_actions SET status = 'EXPIRED' WHERE action_id = $1`, [actionId]);
            }
            return {
                success: false,
                action: Object.assign(Object.assign({}, action), { status: validation.isExpired ? 'EXPIRED' : action.status }),
                message: validation.reason || 'Action validation failed.',
                error: validation.reason
            };
        }
        // 2. Execute transactional state change
        const execResult = yield (0, action_executor_1.executeAction)(action, validation.currentProductState, approvedBy);
        if (!execResult.success) {
            return {
                success: false,
                action: Object.assign(Object.assign({}, action), { status: 'FAILED', failureReason: execResult.error }),
                message: `Execution failed: ${execResult.error}`,
                error: execResult.error
            };
        }
        // 3. Fetch latest completed record
        const updatedAction = (yield (0, action_audit_1.getActionById)(actionId, requestingMerchantId)) || action;
        return {
            success: true,
            action: updatedAction,
            message: execResult.confirmationMessage
        };
    });
}
/**
 * Handles merchant rejection of a pending action.
 */
function rejectAction(actionId_1) {
    return __awaiter(this, arguments, void 0, function* (actionId, rejectedBy = 'merchant_admin', requestingMerchantId = 'default_merchant', reason = 'Rejected by merchant') {
        const action = yield (0, action_audit_1.getActionById)(actionId, requestingMerchantId);
        if (!action) {
            return {
                success: false,
                action: null,
                message: `Action recommendation "${actionId}" was not found.`,
                error: 'Action not found'
            };
        }
        if (action.status !== 'PENDING_APPROVAL') {
            return {
                success: false,
                action,
                message: `Cannot reject action in "${action.status}" status.`
            };
        }
        yield DB_1.client.query(`UPDATE merchant_ai_actions 
     SET status = 'REJECTED',
         rejected_at = CURRENT_TIMESTAMP,
         failure_reason = $1 
     WHERE action_id = $2`, [reason, actionId]);
        const updated = (yield (0, action_audit_1.getActionById)(actionId, requestingMerchantId)) || action;
        return {
            success: true,
            action: updated,
            message: `Action "${actionId}" was rejected.`
        };
    });
}
/**
 * Handles explicit merchant rollback of a previously completed action.
 */
function rollbackApprovedAction(actionId_1) {
    return __awaiter(this, arguments, void 0, function* (actionId, rolledBackBy = 'merchant_admin', requestingMerchantId = 'default_merchant', reason = 'Rolled back by merchant') {
        const action = yield (0, action_audit_1.getActionById)(actionId, requestingMerchantId);
        if (!action) {
            return {
                success: false,
                action: null,
                message: `Action "${actionId}" was not found.`,
                error: 'Action not found'
            };
        }
        if (action.status !== 'COMPLETED') {
            return {
                success: false,
                action,
                message: `Cannot rollback action in "${action.status}" status. Only COMPLETED actions can be rolled back.`,
                error: 'Invalid action status for rollback'
            };
        }
        const result = yield (0, action_executor_1.rollbackAction)(action, rolledBackBy, reason);
        if (!result.success) {
            return {
                success: false,
                action,
                message: result.error || 'Rollback failed.',
                error: result.error
            };
        }
        const updated = (yield (0, action_audit_1.getActionById)(actionId, requestingMerchantId)) || action;
        return {
            success: true,
            action: updated,
            message: result.confirmationMessage
        };
    });
}
