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
exports.warehouseTransferService = exports.WarehouseTransferService = void 0;
const DB_1 = require("../data/DB");
const action_service_1 = require("../merchant-actions/action-service");
const warehouse_service_1 = require("./warehouse-service");
const warehouse_cost_engine_1 = require("./warehouse-cost-engine");
class WarehouseTransferService {
    /**
     * Stages a new inter-warehouse inventory transfer with Phase 3B approval requirement.
     */
    createTransfer(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const merchantId = input.merchantId || 'default_merchant';
            const transferId = `trans_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
            const [srcWh, tgtWh] = yield Promise.all([
                warehouse_service_1.warehouseService.getWarehouseById(input.sourceWarehouseId, merchantId),
                warehouse_service_1.warehouseService.getWarehouseById(input.targetWarehouseId, merchantId)
            ]);
            const shippingEstimate = (0, warehouse_cost_engine_1.estimateShippingCost)((srcWh === null || srcWh === void 0 ? void 0 : srcWh.latitude) || 28.5, (srcWh === null || srcWh === void 0 ? void 0 : srcWh.longitude) || 77.0, (tgtWh === null || tgtWh === void 0 ? void 0 : tgtWh.latitude) || 13.0, (tgtWh === null || tgtWh === void 0 ? void 0 : tgtWh.longitude) || 77.6, input.quantity);
            // Stage Phase 3B action
            let actionId = null;
            try {
                const action = yield (0, action_service_1.createAction)({
                    merchantId,
                    actionType: 'RESTOCK', // Reusing RESTOCK category under Phase 3B
                    productId: input.productId,
                    quantity: input.quantity,
                    reason: input.reason || `Transfer ${input.quantity} units from ${(srcWh === null || srcWh === void 0 ? void 0 : srcWh.name) || input.sourceWarehouseId} to ${(tgtWh === null || tgtWh === void 0 ? void 0 : tgtWh.name) || input.targetWarehouseId}`,
                    payload: {
                        transferId,
                        sourceWarehouseId: input.sourceWarehouseId,
                        targetWarehouseId: input.targetWarehouseId,
                        estimatedShippingCost: shippingEstimate.estimatedCost
                    }
                });
                actionId = action.actionId;
            }
            catch (err) { }
            yield DB_1.client.query(`
      INSERT INTO merchant_inventory_transfers (
        transfer_id, merchant_id, source_warehouse_id, target_warehouse_id,
        product_id, quantity, status, estimated_shipping_cost, action_id, reason
      ) VALUES ($1, $2, $3, $4, $5, $6, 'APPROVAL_REQUIRED', $7, $8, $9);
    `, [
                transferId, merchantId, input.sourceWarehouseId, input.targetWarehouseId,
                input.productId, input.quantity, shippingEstimate.estimatedCost, actionId,
                input.reason || `Rebalance stock from ${srcWh === null || srcWh === void 0 ? void 0 : srcWh.name} to ${tgtWh === null || tgtWh === void 0 ? void 0 : tgtWh.name}`
            ]);
            const created = yield this.getTransferById(transferId, merchantId);
            return created;
        });
    }
    /**
     * Retrieves transfer record by ID.
     */
    getTransferById(transferId_1) {
        return __awaiter(this, arguments, void 0, function* (transferId, merchantId = 'default_merchant') {
            const res = yield DB_1.client.query(`
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
            if (res.rows.length === 0)
                return null;
            const r = res.rows[0];
            return Object.assign(Object.assign({}, r), { estimatedShippingCost: parseFloat(r.estimatedShippingCost) || 0 });
        });
    }
    /**
     * Approves an inventory transfer.
     */
    approveTransfer(transferId_1) {
        return __awaiter(this, arguments, void 0, function* (transferId, approvedBy = 'merchant_admin', merchantId = 'default_merchant') {
            yield DB_1.client.query(`
      UPDATE merchant_inventory_transfers
      SET status = 'APPROVED', approved_by = $1
      WHERE transfer_id = $2 AND (merchant_id = $3 OR $3 = 'merchant_admin');
    `, [approvedBy, transferId, merchantId]);
            return this.getTransferById(transferId, merchantId);
        });
    }
    /**
     * Dispatches transfer into IN_TRANSIT status.
     */
    dispatchTransfer(transferId_1) {
        return __awaiter(this, arguments, void 0, function* (transferId, merchantId = 'default_merchant') {
            const transfer = yield this.getTransferById(transferId, merchantId);
            if (!transfer)
                return null;
            // Deduct stock from source warehouse
            yield DB_1.client.query(`
      UPDATE merchant_warehouse_inventory
      SET available_quantity = GREATEST(0, available_quantity - $1), updated_at = CURRENT_TIMESTAMP
      WHERE warehouse_id = $2 AND product_id = $3;
    `, [transfer.quantity, transfer.sourceWarehouseId, transfer.productId]);
            yield DB_1.client.query(`
      UPDATE merchant_inventory_transfers
      SET status = 'IN_TRANSIT'
      WHERE transfer_id = $1;
    `, [transferId]);
            return this.getTransferById(transferId, merchantId);
        });
    }
    /**
     * Receives goods at destination warehouse and mutates available stock.
     */
    receiveTransfer(transferId_1) {
        return __awaiter(this, arguments, void 0, function* (transferId, merchantId = 'default_merchant') {
            const transfer = yield this.getTransferById(transferId, merchantId);
            if (!transfer)
                return null;
            // If still in APPROVED or APPROVAL_REQUIRED, deduct from source first
            if (transfer.status !== 'IN_TRANSIT') {
                yield DB_1.client.query(`
        UPDATE merchant_warehouse_inventory
        SET available_quantity = GREATEST(0, available_quantity - $1), updated_at = CURRENT_TIMESTAMP
        WHERE warehouse_id = $2 AND product_id = $3;
      `, [transfer.quantity, transfer.sourceWarehouseId, transfer.productId]);
            }
            // Add stock to target warehouse
            yield DB_1.client.query(`
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
            yield DB_1.client.query(`
      UPDATE merchant_inventory_transfers
      SET status = 'RECEIVED', completed_at = CURRENT_TIMESTAMP
      WHERE transfer_id = $1;
    `, [transferId]);
            return this.getTransferById(transferId, merchantId);
        });
    }
    /**
     * Lists inventory transfers for merchant.
     */
    listTransfers() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
            const res = yield DB_1.client.query(`
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
            return res.rows.map(r => (Object.assign(Object.assign({}, r), { estimatedShippingCost: parseFloat(r.estimatedShippingCost) || 0 })));
        });
    }
}
exports.WarehouseTransferService = WarehouseTransferService;
exports.warehouseTransferService = new WarehouseTransferService();
