import { client } from '../data/DB';
import { createAction } from '../merchant-actions/action-service';
import { warehouseService } from './warehouse-service';
import { estimateShippingCost } from './warehouse-cost-engine';
import { InventoryTransferRecord } from './warehouse-types';

export interface CreateTransferInput {
  sourceWarehouseId: string;
  targetWarehouseId: string;
  productId: number;
  quantity: number;
  reason?: string;
  merchantId?: string;
}

export class WarehouseTransferService {
  /**
   * Stages a new inter-warehouse inventory transfer with Phase 3B approval requirement.
   */
  async createTransfer(input: CreateTransferInput): Promise<InventoryTransferRecord> {
    const merchantId = input.merchantId || 'default_merchant';
    const transferId = `trans_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    const [srcWh, tgtWh] = await Promise.all([
      warehouseService.getWarehouseById(input.sourceWarehouseId, merchantId),
      warehouseService.getWarehouseById(input.targetWarehouseId, merchantId)
    ]);

    const shippingEstimate = estimateShippingCost(
      srcWh?.latitude || 28.5,
      srcWh?.longitude || 77.0,
      tgtWh?.latitude || 13.0,
      tgtWh?.longitude || 77.6,
      input.quantity
    );

    // Stage Phase 3B action
    let actionId: string | null = null;
    try {
      const action = await createAction({
        merchantId,
        actionType: 'RESTOCK', // Reusing RESTOCK category under Phase 3B
        productId: input.productId,
        quantity: input.quantity,
        reason: input.reason || `Transfer ${input.quantity} units from ${srcWh?.name || input.sourceWarehouseId} to ${tgtWh?.name || input.targetWarehouseId}`,
        payload: {
          transferId,
          sourceWarehouseId: input.sourceWarehouseId,
          targetWarehouseId: input.targetWarehouseId,
          estimatedShippingCost: shippingEstimate.estimatedCost
        }
      });
      actionId = action.actionId;
    } catch (err) {}

    await client.query(`
      INSERT INTO merchant_inventory_transfers (
        transfer_id, merchant_id, source_warehouse_id, target_warehouse_id,
        product_id, quantity, status, estimated_shipping_cost, action_id, reason
      ) VALUES ($1, $2, $3, $4, $5, $6, 'APPROVAL_REQUIRED', $7, $8, $9);
    `, [
      transferId, merchantId, input.sourceWarehouseId, input.targetWarehouseId,
      input.productId, input.quantity, shippingEstimate.estimatedCost, actionId,
      input.reason || `Rebalance stock from ${srcWh?.name} to ${tgtWh?.name}`
    ]);

    const created = await this.getTransferById(transferId, merchantId);
    return created!;
  }

  /**
   * Retrieves transfer record by ID.
   */
  async getTransferById(transferId: string, merchantId: string = 'default_merchant'): Promise<InventoryTransferRecord | null> {
    const res = await client.query(`
      SELECT 
        t.transfer_id as "transferId",
        t.merchant_id as "merchantId",
        t.source_warehouse_id as "sourceWarehouseId",
        sw.name as "sourceWarehouseName",
        t.target_warehouse_id as "targetWarehouseId",
        tw.name as "targetWarehouseName",
        t.product_id as "productId",
        p.title as "productTitle",
        t.quantity,
        t.status,
        t.estimated_shipping_cost::numeric(10,2) as "estimatedShippingCost",
        t.action_id as "actionId",
        t.reason,
        t.approved_by as "approvedBy",
        t.created_at as "createdAt",
        t.completed_at as "completedAt"
      FROM merchant_inventory_transfers t
      LEFT JOIN merchant_warehouses sw ON t.source_warehouse_id = sw.warehouse_id
      LEFT JOIN merchant_warehouses tw ON t.target_warehouse_id = tw.warehouse_id
      LEFT JOIN products p ON t.product_id = p.productid
      WHERE t.transfer_id = $1 AND (t.merchant_id = $2 OR $2 = 'merchant_admin');
    `, [transferId, merchantId]);

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      ...r,
      estimatedShippingCost: parseFloat(r.estimatedShippingCost) || 0
    };
  }

  /**
   * Approves an inventory transfer.
   */
  async approveTransfer(transferId: string, approvedBy: string = 'merchant_admin', merchantId: string = 'default_merchant'): Promise<InventoryTransferRecord | null> {
    await client.query(`
      UPDATE merchant_inventory_transfers
      SET status = 'APPROVED', approved_by = $1
      WHERE transfer_id = $2 AND (merchant_id = $3 OR $3 = 'merchant_admin');
    `, [approvedBy, transferId, merchantId]);

    return this.getTransferById(transferId, merchantId);
  }

  /**
   * Dispatches transfer into IN_TRANSIT status.
   */
  async dispatchTransfer(transferId: string, merchantId: string = 'default_merchant'): Promise<InventoryTransferRecord | null> {
    const transfer = await this.getTransferById(transferId, merchantId);
    if (!transfer) return null;

    // Deduct stock from source warehouse
    await client.query(`
      UPDATE merchant_warehouse_inventory
      SET available_quantity = GREATEST(0, available_quantity - $1), updated_at = CURRENT_TIMESTAMP
      WHERE warehouse_id = $2 AND product_id = $3;
    `, [transfer.quantity, transfer.sourceWarehouseId, transfer.productId]);

    await client.query(`
      UPDATE merchant_inventory_transfers
      SET status = 'IN_TRANSIT'
      WHERE transfer_id = $1;
    `, [transferId]);

    return this.getTransferById(transferId, merchantId);
  }

  /**
   * Receives goods at destination warehouse and mutates available stock.
   */
  async receiveTransfer(transferId: string, merchantId: string = 'default_merchant'): Promise<InventoryTransferRecord | null> {
    const transfer = await this.getTransferById(transferId, merchantId);
    if (!transfer) return null;

    // If still in APPROVED or APPROVAL_REQUIRED, deduct from source first
    if (transfer.status !== 'IN_TRANSIT') {
      await client.query(`
        UPDATE merchant_warehouse_inventory
        SET available_quantity = GREATEST(0, available_quantity - $1), updated_at = CURRENT_TIMESTAMP
        WHERE warehouse_id = $2 AND product_id = $3;
      `, [transfer.quantity, transfer.sourceWarehouseId, transfer.productId]);
    }

    // Add stock to target warehouse
    await client.query(`
      INSERT INTO merchant_warehouse_inventory (
        id, warehouse_id, merchant_id, product_id, available_quantity, reserved_quantity, reorder_point, safety_stock
      ) VALUES ($1, $2, $3, $4, $5, 0, 15, 8)
      ON CONFLICT (warehouse_id, product_id) DO UPDATE
      SET available_quantity = merchant_warehouse_inventory.available_quantity + $5, updated_at = CURRENT_TIMESTAMP;
    `, [
      `whinv_${transfer.targetWarehouseId}_${transfer.productId}`,
      transfer.targetWarehouseId,
      merchantId,
      transfer.productId,
      transfer.quantity
    ]);

    await client.query(`
      UPDATE merchant_inventory_transfers
      SET status = 'RECEIVED', completed_at = CURRENT_TIMESTAMP
      WHERE transfer_id = $1;
    `, [transferId]);

    return this.getTransferById(transferId, merchantId);
  }

  /**
   * Lists inventory transfers for merchant.
   */
  async listTransfers(merchantId: string = 'default_merchant'): Promise<InventoryTransferRecord[]> {
    const res = await client.query(`
      SELECT 
        t.transfer_id as "transferId",
        t.merchant_id as "merchantId",
        t.source_warehouse_id as "sourceWarehouseId",
        sw.name as "sourceWarehouseName",
        t.target_warehouse_id as "targetWarehouseId",
        tw.name as "targetWarehouseName",
        t.product_id as "productId",
        p.title as "productTitle",
        t.quantity,
        t.status,
        t.estimated_shipping_cost::numeric(10,2) as "estimatedShippingCost",
        t.action_id as "actionId",
        t.reason,
        t.approved_by as "approvedBy",
        t.created_at as "createdAt",
        t.completed_at as "completedAt"
      FROM merchant_inventory_transfers t
      LEFT JOIN merchant_warehouses sw ON t.source_warehouse_id = sw.warehouse_id
      LEFT JOIN merchant_warehouses tw ON t.target_warehouse_id = tw.warehouse_id
      LEFT JOIN products p ON t.product_id = p.productid
      WHERE t.merchant_id = $1 OR $1 = 'merchant_admin'
      ORDER BY t.created_at DESC;
    `, [merchantId]);

    return res.rows.map(r => ({
      ...r,
      estimatedShippingCost: parseFloat(r.estimatedShippingCost) || 0
    }));
  }
}

export const warehouseTransferService = new WarehouseTransferService();
