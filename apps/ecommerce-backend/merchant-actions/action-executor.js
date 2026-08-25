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
exports.executeAction = executeAction;
exports.rollbackAction = rollbackAction;
const DB_1 = require("../data/DB");
/**
 * Transactionally executes a merchant-approved business action.
 */
function executeAction(action_1, productState_1) {
    return __awaiter(this, arguments, void 0, function* (action, productState, approvedBy = 'merchant_admin') {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const now = new Date().toISOString();
        const dbClient = yield DB_1.client.connect();
        try {
            yield dbClient.query('BEGIN');
            let executionPayload = {};
            let confirmationMessage = '';
            switch (action.actionType) {
                case 'RESTOCK': {
                    const unitsToAdd = action.quantity || ((_a = action.payload) === null || _a === void 0 ? void 0 : _a.reorderTargetUnits) || 50;
                    const stockBefore = (_b = productState === null || productState === void 0 ? void 0 : productState.stock) !== null && _b !== void 0 ? _b : 0;
                    // 1. Update product stock in catalog
                    const updateRes = yield dbClient.query(`UPDATE products 
           SET stock = stock + $1 
           WHERE productid = $2 
           RETURNING stock, title`, [unitsToAdd, action.productId]);
                    const newStock = parseInt((_c = updateRes.rows[0]) === null || _c === void 0 ? void 0 : _c.stock, 10);
                    const prodTitle = ((_d = updateRes.rows[0]) === null || _d === void 0 ? void 0 : _d.title) || action.productName || 'Product';
                    // 2. Insert audit movement ledger entry
                    yield dbClient.query(`INSERT INTO inventory_movements (
            productid, movement_type, quantity, stock_before, stock_after, 
            reference_type, reference_id, notes, source
          ) VALUES ($1, 'restock', $2, $3, $4, 'ai_action', $5, $6, 'merchant_ai_action_engine')`, [
                        action.productId,
                        unitsToAdd,
                        stockBefore,
                        newStock,
                        action.actionId,
                        `Merchant AI Approved Restock: +${unitsToAdd} units`
                    ]);
                    executionPayload = {
                        unitsAdded: unitsToAdd,
                        stockBefore,
                        stockAfter: newStock,
                        productTitle: prodTitle,
                        executedAt: now
                    };
                    confirmationMessage = `Restock action approved: Successfully added +${unitsToAdd} units of "${prodTitle}". New inventory level: ${newStock} units.`;
                    break;
                }
                case 'DISCOUNT': {
                    const originalPrice = (_g = (_e = productState === null || productState === void 0 ? void 0 : productState.price) !== null && _e !== void 0 ? _e : (_f = action.payload) === null || _f === void 0 ? void 0 : _f.originalPrice) !== null && _g !== void 0 ? _g : 999;
                    const discountPct = (_j = (_h = action.payload) === null || _h === void 0 ? void 0 : _h.recommendedDiscountPct) !== null && _j !== void 0 ? _j : 10;
                    const suggestedPrice = (_l = (_k = action.payload) === null || _k === void 0 ? void 0 : _k.suggestedDiscountPrice) !== null && _l !== void 0 ? _l : Math.round(originalPrice * (1 - discountPct / 100));
                    // Update product discount in catalog
                    const updateRes = yield dbClient.query(`UPDATE products 
           SET discount = $1 
           WHERE productid = $2 
           RETURNING price, discount, title`, [suggestedPrice, action.productId]);
                    const prodTitle = ((_m = updateRes.rows[0]) === null || _m === void 0 ? void 0 : _m.title) || action.productName || 'Product';
                    executionPayload = {
                        originalPrice,
                        newDiscountPrice: suggestedPrice,
                        discountPercentage: discountPct,
                        productTitle: prodTitle,
                        executedAt: now
                    };
                    confirmationMessage = `Discount action approved: "${prodTitle}" discounted to ₹${suggestedPrice.toLocaleString('en-IN')} (${discountPct}% off).`;
                    break;
                }
                case 'PROMOTION': {
                    const prodTitle = (productState === null || productState === void 0 ? void 0 : productState.title) || action.productName || 'Product';
                    executionPayload = {
                        channel: ((_o = action.payload) === null || _o === void 0 ? void 0 : _o.recommendedChannel) || 'storefront_hero_spotlight',
                        status: 'staged_for_campaign',
                        productTitle: prodTitle,
                        executedAt: now
                    };
                    confirmationMessage = `Promotion action approved: "${prodTitle}" is now staged for hero banner and marketing spotlight.`;
                    break;
                }
                case 'MARK_FOR_REVIEW': {
                    const prodTitle = (productState === null || productState === void 0 ? void 0 : productState.title) || action.productName || 'Product';
                    executionPayload = {
                        reviewStatus: 'queued_for_merchant_audit',
                        productTitle: prodTitle,
                        executedAt: now
                    };
                    confirmationMessage = `Quality review action approved: "${prodTitle}" marked for sizing and return diagnostics audit.`;
                    break;
                }
                default:
                    throw new Error(`Unsupported action type for execution: ${action.actionType}`);
            }
            // 3. Update Action record to COMPLETED
            yield dbClient.query(`UPDATE merchant_ai_actions 
       SET status = 'COMPLETED',
           approved_at = CURRENT_TIMESTAMP,
           completed_at = CURRENT_TIMESTAMP,
           approved_by = $1,
           execution_result = $2
       WHERE action_id = $3`, [approvedBy, JSON.stringify(executionPayload), action.actionId]);
            yield dbClient.query('COMMIT');
            return {
                success: true,
                actionId: action.actionId,
                executionPayload,
                confirmationMessage
            };
        }
        catch (err) {
            yield dbClient.query('ROLLBACK');
            console.error(`Action execution failed for ${action.actionId}:`, err);
            // Record failure in action record
            try {
                yield DB_1.client.query(`UPDATE merchant_ai_actions 
         SET status = 'FAILED',
             failure_reason = $1 
         WHERE action_id = $2`, [err.message || 'Execution failed', action.actionId]);
            }
            catch (logErr) {
                console.error('Failed to log action failure status:', logErr);
            }
            return {
                success: false,
                actionId: action.actionId,
                executionPayload: {},
                confirmationMessage: '',
                error: err.message || 'Action execution failed'
            };
        }
        finally {
            dbClient.release();
        }
    });
}
/**
 * Transactionally rolls back an already executed merchant action.
 */
function rollbackAction(action_1) {
    return __awaiter(this, arguments, void 0, function* (action, rolledBackBy = 'merchant_admin', reason = 'Rolled back by merchant') {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const now = new Date().toISOString();
        const dbClient = yield DB_1.client.connect();
        try {
            yield dbClient.query('BEGIN');
            let rollbackPayload = {};
            let confirmationMessage = '';
            switch (action.actionType) {
                case 'RESTOCK': {
                    const unitsAdded = ((_a = action.executionResult) === null || _a === void 0 ? void 0 : _a.unitsAdded) || action.quantity || ((_b = action.payload) === null || _b === void 0 ? void 0 : _b.reorderTargetUnits) || 50;
                    // 1. Fetch current stock
                    const currentRes = yield dbClient.query('SELECT stock, title FROM products WHERE productid = $1', [action.productId]);
                    const stockBeforeRollback = parseInt(((_c = currentRes.rows[0]) === null || _c === void 0 ? void 0 : _c.stock) || '0', 10);
                    const newStock = Math.max(0, stockBeforeRollback - unitsAdded);
                    const prodTitle = ((_d = currentRes.rows[0]) === null || _d === void 0 ? void 0 : _d.title) || action.productName || 'Product';
                    // 2. Decrement stock
                    yield dbClient.query(`UPDATE products 
           SET stock = $1 
           WHERE productid = $2`, [newStock, action.productId]);
                    // 3. Insert compensating audit movement
                    yield dbClient.query(`INSERT INTO inventory_movements (
            productid, movement_type, quantity, stock_before, stock_after, 
            reference_type, reference_id, notes, source
          ) VALUES ($1, 'rollback', $2, $3, $4, 'ai_action_rollback', $5, $6, 'merchant_ai_action_engine')`, [
                        action.productId,
                        -unitsAdded,
                        stockBeforeRollback,
                        newStock,
                        action.actionId,
                        `Compensating Rollback: -${unitsAdded} units (${reason})`
                    ]);
                    rollbackPayload = {
                        unitsDeducted: unitsAdded,
                        stockBeforeRollback,
                        stockAfterRollback: newStock,
                        productTitle: prodTitle,
                        rolledBackAt: now,
                        rolledBackBy,
                        reason
                    };
                    confirmationMessage = `Rollback completed: Deducted ${unitsAdded} units of "${prodTitle}". Current inventory level: ${newStock} units.`;
                    break;
                }
                case 'DISCOUNT': {
                    const originalPrice = (_h = (_f = (_e = action.executionResult) === null || _e === void 0 ? void 0 : _e.originalPrice) !== null && _f !== void 0 ? _f : (_g = action.payload) === null || _g === void 0 ? void 0 : _g.originalPrice) !== null && _h !== void 0 ? _h : 999;
                    // Restore product discount to original price (regular undiscounted)
                    const updateRes = yield dbClient.query(`UPDATE products 
           SET discount = $1 
           WHERE productid = $2 
           RETURNING price, discount, title`, [originalPrice, action.productId]);
                    const prodTitle = ((_j = updateRes.rows[0]) === null || _j === void 0 ? void 0 : _j.title) || action.productName || 'Product';
                    rollbackPayload = {
                        restoredPrice: originalPrice,
                        productTitle: prodTitle,
                        rolledBackAt: now,
                        rolledBackBy,
                        reason
                    };
                    confirmationMessage = `Rollback completed: "${prodTitle}" price restored to standard ₹${originalPrice.toLocaleString('en-IN')}.`;
                    break;
                }
                case 'PROMOTION': {
                    const prodTitle = action.productName || 'Product';
                    rollbackPayload = {
                        channel: ((_k = action.payload) === null || _k === void 0 ? void 0 : _k.recommendedChannel) || 'storefront_hero_spotlight',
                        status: 'campaign_cancelled_by_rollback',
                        productTitle: prodTitle,
                        rolledBackAt: now,
                        rolledBackBy,
                        reason
                    };
                    confirmationMessage = `Rollback completed: Marketing promotion for "${prodTitle}" was cancelled and removed from spotlight.`;
                    break;
                }
                case 'MARK_FOR_REVIEW': {
                    const prodTitle = action.productName || 'Product';
                    rollbackPayload = {
                        reviewStatus: 'review_audit_dismissed',
                        productTitle: prodTitle,
                        rolledBackAt: now,
                        rolledBackBy,
                        reason
                    };
                    confirmationMessage = `Rollback completed: Quality review flag for "${prodTitle}" was dismissed.`;
                    break;
                }
                default:
                    throw new Error(`Rollback not supported for action type: ${action.actionType}`);
            }
            // Update Action status to ROLLED_BACK
            yield dbClient.query(`UPDATE merchant_ai_actions 
       SET status = 'ROLLED_BACK',
           failure_reason = $1,
           execution_result = jsonb_set(
             COALESCE(execution_result, '{}'::jsonb),
             '{rollback}',
             $2::jsonb
           )
       WHERE action_id = $3`, [`Rolled back by ${rolledBackBy}: ${reason}`, JSON.stringify(rollbackPayload), action.actionId]);
            // Update impact ledger if linked
            yield dbClient.query(`UPDATE merchant_business_impact_ledger
       SET final_outcome = 'ROLLED_BACK',
           outcome_status = 'ROLLED_BACK'
       WHERE action_id = $1`, [action.actionId]);
            yield dbClient.query('COMMIT');
            return {
                success: true,
                actionId: action.actionId,
                rollbackPayload,
                confirmationMessage
            };
        }
        catch (err) {
            yield dbClient.query('ROLLBACK');
            console.error(`Rollback execution failed for ${action.actionId}:`, err);
            return {
                success: false,
                actionId: action.actionId,
                rollbackPayload: {},
                confirmationMessage: '',
                error: err.message || 'Rollback execution failed'
            };
        }
        finally {
            dbClient.release();
        }
    });
}
