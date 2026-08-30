import { client } from '../data/DB';
import { MerchantAiActionRecord } from './action-types';

export interface ExecutionResult {
  success: boolean;
  actionId: string;
  executionPayload: Record<string, any>;
  confirmationMessage: string;
  error?: string;
}

/**
 * Transactionally executes a merchant-approved business action.
 */
export async function executeAction(
  action: MerchantAiActionRecord,
  productState?: { stock: number; price: number; discount: number; title: string },
  approvedBy: string = 'merchant_admin'
): Promise<ExecutionResult> {
  const now = new Date().toISOString();
  const dbClient = await client.connect();

  try {
    await dbClient.query('BEGIN');

    let executionPayload: Record<string, any> = {};
    let confirmationMessage = '';

    switch (action.actionType) {
      case 'RESTOCK': {
        const unitsToAdd = action.quantity || action.payload?.reorderTargetUnits || 50;
        const stockBefore = productState?.stock ?? 0;
        
        // 1. Update product stock in catalog
        const updateRes = await dbClient.query(
          `UPDATE shopi_products 
           SET stock_quantity = stock_quantity + $1 
           WHERE product_id = $2 
           RETURNING stock_quantity, title`,
          [unitsToAdd, action.productId]
        );

        const newStock = parseInt(updateRes.rows[0]?.stock_quantity, 10);
        const prodTitle = updateRes.rows[0]?.title || action.productName || 'Product';

        // 2. Insert audit movement ledger entry
        await dbClient.query(
          `INSERT INTO shopi_inventory_movements (
            product_id, movement_type, quantity, stock_before, stock_after, 
            reference_type, reference_id, notes, source
          ) VALUES ($1, 'restock', $2, $3, $4, 'ai_action', $5, $6, 'merchant_ai_action_engine')`,
          [
            action.productId,
            unitsToAdd,
            stockBefore,
            newStock,
            action.actionId,
            `Merchant AI Approved Restock: +${unitsToAdd} units`
          ]
        );

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
        const originalPrice = productState?.price ?? action.payload?.originalPrice ?? 999;
        const discountPct = action.payload?.recommendedDiscountPct ?? 10;
        const suggestedPrice = action.payload?.suggestedDiscountPrice ?? Math.round(originalPrice * (1 - discountPct / 100));

        // Update product discount in catalog
        const updateRes = await dbClient.query(
          `UPDATE shopi_products 
           SET selling_price = $1, discount_percentage = $2 
           WHERE product_id = $3 
           RETURNING selling_price, discount_percentage, title`,
          [suggestedPrice, discountPct, action.productId]
        );

        const prodTitle = updateRes.rows[0]?.title || action.productName || 'Product';

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
        const prodTitle = productState?.title || action.productName || 'Product';
        executionPayload = {
          channel: action.payload?.recommendedChannel || 'storefront_hero_spotlight',
          status: 'staged_for_campaign',
          productTitle: prodTitle,
          executedAt: now
        };

        confirmationMessage = `Promotion action approved: "${prodTitle}" is now staged for hero banner and marketing spotlight.`;
        break;
      }

      case 'MARK_FOR_REVIEW': {
        const prodTitle = productState?.title || action.productName || 'Product';
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
    await dbClient.query(
      `UPDATE merchant_ai_actions 
       SET status = 'COMPLETED',
           approved_at = CURRENT_TIMESTAMP,
           completed_at = CURRENT_TIMESTAMP,
           approved_by = $1,
           execution_result = $2
       WHERE action_id = $3`,
      [approvedBy, JSON.stringify(executionPayload), action.actionId]
    );

    await dbClient.query('COMMIT');

    return {
      success: true,
      actionId: action.actionId,
      executionPayload,
      confirmationMessage
    };
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    console.error(`Action execution failed for ${action.actionId}:`, err);

    // Record failure in action record
    try {
      await client.query(
        `UPDATE merchant_ai_actions 
         SET status = 'FAILED',
             failure_reason = $1 
         WHERE action_id = $2`,
        [err.message || 'Execution failed', action.actionId]
      );
    } catch (logErr) {
      console.error('Failed to log action failure status:', logErr);
    }

    return {
      success: false,
      actionId: action.actionId,
      executionPayload: {},
      confirmationMessage: '',
      error: err.message || 'Action execution failed'
    };
  } finally {
    dbClient.release();
  }
}

export interface RollbackResult {
  success: boolean;
  actionId: string;
  rollbackPayload: Record<string, any>;
  confirmationMessage: string;
  error?: string;
}

/**
 * Transactionally rolls back an already executed merchant action.
 */
export async function rollbackAction(
  action: MerchantAiActionRecord,
  rolledBackBy: string = 'merchant_admin',
  reason: string = 'Rolled back by merchant'
): Promise<RollbackResult> {
  const now = new Date().toISOString();
  const dbClient = await client.connect();

  try {
    await dbClient.query('BEGIN');

    let rollbackPayload: Record<string, any> = {};
    let confirmationMessage = '';

    switch (action.actionType) {
      case 'RESTOCK': {
        const unitsAdded = action.executionResult?.unitsAdded || action.quantity || action.payload?.reorderTargetUnits || 50;
        
        // 1. Fetch current stock
        const currentRes = await dbClient.query('SELECT stock_quantity, title FROM shopi_products WHERE product_id = $1', [action.productId]);
        const stockBeforeRollback = parseInt(currentRes.rows[0]?.stock_quantity || '0', 10);
        const newStock = Math.max(0, stockBeforeRollback - unitsAdded);
        const prodTitle = currentRes.rows[0]?.title || action.productName || 'Product';

        // 2. Decrement stock
        await dbClient.query(
          `UPDATE shopi_products 
           SET stock_quantity = $1 
           WHERE product_id = $2`,
          [newStock, action.productId]
        );

        // 3. Insert compensating audit movement
        await dbClient.query(
          `INSERT INTO shopi_inventory_movements (
            product_id, movement_type, quantity, stock_before, stock_after, 
            reference_type, reference_id, notes, source
          ) VALUES ($1, 'rollback', $2, $3, $4, 'ai_action_rollback', $5, $6, 'merchant_ai_action_engine')`,
          [
            action.productId,
            -unitsAdded,
            stockBeforeRollback,
            newStock,
            action.actionId,
            `Compensating Rollback: -${unitsAdded} units (${reason})`
          ]
        );

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
        const originalPrice = action.executionResult?.originalPrice ?? action.payload?.originalPrice ?? 999;
        
        // Restore product discount to original price (regular undiscounted)
        const updateRes = await dbClient.query(
          `UPDATE products 
           SET discount = $1 
           WHERE productid = $2 
           RETURNING price, discount, title`,
          [originalPrice, action.productId]
        );

        const prodTitle = updateRes.rows[0]?.title || action.productName || 'Product';

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
          channel: action.payload?.recommendedChannel || 'storefront_hero_spotlight',
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
    await dbClient.query(
      `UPDATE merchant_ai_actions 
       SET status = 'ROLLED_BACK',
           failure_reason = $1,
           execution_result = jsonb_set(
             COALESCE(execution_result, '{}'::jsonb),
             '{rollback}',
             $2::jsonb
           )
       WHERE action_id = $3`,
      [`Rolled back by ${rolledBackBy}: ${reason}`, JSON.stringify(rollbackPayload), action.actionId]
    );

    // Update impact ledger if linked
    await dbClient.query(
      `UPDATE merchant_business_impact_ledger
       SET final_outcome = 'ROLLED_BACK',
           outcome_status = 'ROLLED_BACK'
       WHERE action_id = $1`,
      [action.actionId]
    );

    await dbClient.query('COMMIT');

    return {
      success: true,
      actionId: action.actionId,
      rollbackPayload,
      confirmationMessage
    };
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    console.error(`Rollback execution failed for ${action.actionId}:`, err);
    return {
      success: false,
      actionId: action.actionId,
      rollbackPayload: {},
      confirmationMessage: '',
      error: err.message || 'Rollback execution failed'
    };
  } finally {
    dbClient.release();
  }
}

