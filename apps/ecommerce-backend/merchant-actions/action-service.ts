import { client } from '../data/DB';
import {
  MerchantAiActionRecord,
  ActionPreview,
  CreateActionInput,
  ActionResult,
  MerchantActionType
} from './action-types';
import { validateActionForApproval } from './action-validator';
import { executeAction, rollbackAction } from './action-executor';
import { getActionById, listActions, getActionSummaryKpis } from './action-audit';
import { businessOutcomeEngine } from '../merchant-learning';

/**
 * Creates a human-friendly ActionPreview from a database action record.
 */
export function formatActionPreview(action: MerchantAiActionRecord): ActionPreview {
  let recommendedChange = '';
  let impact = '';

  switch (action.actionType) {
    case 'RESTOCK': {
      const units = action.quantity || action.payload?.reorderTargetUnits || 50;
      recommendedChange = `+${units} units replenishment`;
      impact = `Restores safety buffer to ~45 days based on ${action.payload?.dailyVelocity7d || 2.5} units/day velocity.`;
      break;
    }
    case 'DISCOUNT': {
      const disc = action.payload?.recommendedDiscountPct || 10;
      const newPrice = action.payload?.suggestedDiscountPrice || Math.round((action.payload?.originalPrice || 999) * (1 - disc / 100));
      recommendedChange = `${disc}% discount (₹${newPrice.toLocaleString('en-IN')})`;
      impact = `Revives sell-through on slow-moving inventory tied up in storage.`;
      break;
    }
    case 'PROMOTION': {
      recommendedChange = 'Feature in Hero Banner & Category Spotlight';
      impact = `Capitalizes on strong ${action.payload?.revenueGrowthPct ? `+${action.payload.revenueGrowthPct}%` : 'high'} sales momentum.`;
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
    currentStock: action.payload?.stockAtRecommendation,
    recommendedChange,
    estimatedCoverage: action.payload?.estimatedCoverageDays ? `~${action.payload.estimatedCoverageDays} days remaining` : undefined,
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
export async function createAction(input: CreateActionInput): Promise<MerchantAiActionRecord> {
  const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const merchantId = input.merchantId || 'default_merchant';
  const expiresIn = input.expiresInMinutes || 60; // 60 minutes default expiration
  const expiresAt = new Date(Date.now() + expiresIn * 60 * 1000).toISOString();

  // If product name is missing, query it
  let productName = input.productName;
  if (!productName && input.productId) {
    const prodRes = await client.query('SELECT title FROM shopi_products WHERE product_id = $1', [input.productId]);
    if (prodRes.rows[0]) {
      productName = prodRes.rows[0].title;
    }
  }

  // Deduplication check: Prevent duplicate active pending recommendation for same entity & action type
  const existingPending = await client.query(`
    SELECT * FROM merchant_ai_actions
    WHERE merchant_id = $1 
      AND action_type = $2
      AND (product_id = $3 OR ($3 IS NULL AND product_id IS NULL))
      AND status = 'PENDING_APPROVAL'
      AND (expires_at > CURRENT_TIMESTAMP OR expires_at IS NULL)
    LIMIT 1;
  `, [merchantId, input.actionType, input.productId || null]);

  if (existingPending.rows.length > 0) {
    const existing = existingPending.rows[0];
    return {
      actionId: existing.action_id,
      merchantId: existing.merchant_id,
      actionType: existing.action_type,
      status: existing.status,
      productId: existing.product_id ? parseInt(existing.product_id, 10) : null,
      productName: existing.product_name,
      quantity: existing.quantity !== null && existing.quantity !== undefined ? parseInt(existing.quantity, 10) : null,
      payload: typeof existing.payload === 'string' ? JSON.parse(existing.payload) : existing.payload || {},
      reason: existing.reason,
      createdAt: existing.created_at,
      expiresAt: existing.expires_at,
      approvedAt: existing.approved_at,
      completedAt: existing.completed_at,
      rejectedAt: existing.rejected_at,
      requiresApproval: true,
      canRollback: false,
      isReversible: false
    };
  }

  const query = `
    INSERT INTO merchant_ai_actions (
      action_id, merchant_id, action_type, status, product_id, product_name,
      quantity, payload, reason, expires_at, idempotency_key
    ) VALUES ($1, $2, $3, 'PENDING_APPROVAL', $4, $5, $6, $7, $8, $9, $10)
    RETURNING *;
  `;

  const res = await client.query(query, [
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
}

/**
 * Handles explicit merchant approval with revalidation and safe execution.
 */
export async function approveAction(
  actionId: string,
  approvedBy: string = 'merchant_admin',
  requestingMerchantId: string = 'default_merchant',
  idempotencyKey?: string
): Promise<ActionResult> {
  const action = await getActionById(actionId, requestingMerchantId);
  if (!action) {
    return {
      success: false,
      action: null as any,
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
  const validation = await validateActionForApproval(action, requestingMerchantId);
  if (!validation.isValid) {
    if (validation.isExpired) {
      await client.query(`UPDATE merchant_ai_actions SET status = 'EXPIRED' WHERE action_id = $1`, [actionId]);
    }
    return {
      success: false,
      action: { ...action, status: validation.isExpired ? 'EXPIRED' : action.status },
      message: validation.reason || 'Action validation failed.',
      error: validation.reason
    };
  }

  // 2. Execute transactional state change
  const execResult = await executeAction(action, validation.currentProductState, approvedBy);
  if (!execResult.success) {
    return {
      success: false,
      action: { ...action, status: 'FAILED', failureReason: execResult.error },
      message: `Execution failed: ${execResult.error}`,
      error: execResult.error
    };
  }

  // 3. Fetch latest completed record
  const updatedAction = (await getActionById(actionId, requestingMerchantId)) || action;

  return {
    success: true,
    action: updatedAction,
    message: execResult.confirmationMessage
  };
}

/**
 * Handles merchant rejection of a pending action.
 */
export async function rejectAction(
  actionId: string,
  rejectedBy: string = 'merchant_admin',
  requestingMerchantId: string = 'default_merchant',
  reason: string = 'Rejected by merchant'
): Promise<ActionResult> {
  const action = await getActionById(actionId, requestingMerchantId);
  if (!action) {
    return {
      success: false,
      action: null as any,
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

  await client.query(
    `UPDATE merchant_ai_actions 
     SET status = 'REJECTED',
         rejected_at = CURRENT_TIMESTAMP,
         failure_reason = $1 
     WHERE action_id = $2`,
    [reason, actionId]
  );

  const updated = (await getActionById(actionId, requestingMerchantId)) || action;
  return {
    success: true,
    action: updated,
    message: `Action "${actionId}" was rejected.`
  };
}

/**
 * Handles explicit merchant rollback of a previously completed action.
 */
export async function rollbackApprovedAction(
  actionId: string,
  rolledBackBy: string = 'merchant_admin',
  requestingMerchantId: string = 'default_merchant',
  reason: string = 'Rolled back by merchant'
): Promise<ActionResult> {
  const action = await getActionById(actionId, requestingMerchantId);
  if (!action) {
    return {
      success: false,
      action: null as any,
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

  const result = await rollbackAction(action, rolledBackBy, reason);
  if (!result.success) {
    return {
      success: false,
      action,
      message: result.error || 'Rollback failed.',
      error: result.error
    };
  }

  const updated = (await getActionById(actionId, requestingMerchantId)) || action;
  return {
    success: true,
    action: updated,
    message: result.confirmationMessage
  };
}

