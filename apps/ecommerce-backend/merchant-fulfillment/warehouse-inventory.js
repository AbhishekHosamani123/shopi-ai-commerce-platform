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
exports.warehouseInventoryEngine = exports.WarehouseInventoryEngine = void 0;
const DB_1 = require("../data/DB");
const warehouse_service_1 = require("./warehouse-service");
class WarehouseInventoryEngine {
    /**
     * Initializes warehouse inventory balances across products if empty.
     */
    ensureWarehouseInventory() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
            var _a, _b, _c;
            const warehouses = yield warehouse_service_1.warehouseService.ensureWarehouses(merchantId);
            if (warehouses.length === 0)
                return;
            const prodRes = yield DB_1.client.query('SELECT productid, stock FROM products LIMIT 50');
            for (const p of prodRes.rows) {
                const totalStock = parseInt(p.stock, 10) || 0;
                // Distribute catalog stock across 3 nodes (50% North, 30% South, 20% West)
                const allocations = [
                    { whId: (_a = warehouses[0]) === null || _a === void 0 ? void 0 : _a.warehouseId, qty: Math.round(totalStock * 0.5) },
                    { whId: (_b = warehouses[1]) === null || _b === void 0 ? void 0 : _b.warehouseId, qty: Math.round(totalStock * 0.3) },
                    { whId: (_c = warehouses[2]) === null || _c === void 0 ? void 0 : _c.warehouseId, qty: Math.max(0, totalStock - Math.round(totalStock * 0.5) - Math.round(totalStock * 0.3)) }
                ];
                for (const alloc of allocations) {
                    if (!alloc.whId)
                        continue;
                    const id = `whinv_${alloc.whId}_${p.productid}`;
                    yield DB_1.client.query(`
          INSERT INTO merchant_warehouse_inventory (
            id, warehouse_id, merchant_id, product_id, available_quantity, reserved_quantity, reorder_point, safety_stock
          ) VALUES ($1, $2, $3, $4, $5, 0, 15, 8)
          ON CONFLICT (warehouse_id, product_id) DO NOTHING;
        `, [id, alloc.whId, merchantId, p.productid, alloc.qty]);
                }
            }
        });
    }
    /**
     * Lists inventory records for a specific warehouse.
     */
    getWarehouseInventory(warehouseId_1) {
        return __awaiter(this, arguments, void 0, function* (warehouseId, merchantId = 'default_merchant') {
            yield this.ensureWarehouseInventory(merchantId);
            const res = yield DB_1.client.query(`
      SELECT 
        wi.id,
        wi.warehouse_id as "warehouseId",
        w.name as "warehouseName",
        wi.merchant_id as "merchantId",
        wi.product_id as "productId",
        p.title as "productTitle",
        wi.available_quantity as "availableQuantity",
        wi.reserved_quantity as "reservedQuantity",
        wi.reorder_point as "reorderPoint",
        wi.safety_stock as "safetyStock",
        wi.updated_at as "updatedAt"
      FROM merchant_warehouse_inventory wi
      JOIN merchant_warehouses w ON wi.warehouse_id = w.warehouse_id
      JOIN products p ON wi.product_id = p.productid
      WHERE wi.warehouse_id = $1 AND (wi.merchant_id = $2 OR $2 = 'merchant_admin')
      ORDER BY p.title ASC;
    `, [warehouseId, merchantId]);
            return res.rows;
        });
    }
    /**
     * Analyzes multi-node inventory allocation for all SKUs and generates rebalancing recommendations.
     */
    analyzeWarehouseAllocations() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
            var _a;
            yield this.ensureWarehouseInventory(merchantId);
            const warehouses = yield warehouse_service_1.warehouseService.listWarehouses(merchantId);
            if (warehouses.length < 2)
                return [];
            const res = yield DB_1.client.query(`
      SELECT 
        wi.product_id,
        p.title as product_title,
        wi.warehouse_id,
        w.name as warehouse_name,
        wi.available_quantity,
        COALESCE(
          (SELECT COUNT(oi.orderitemid)::numeric / 30.0 
           FROM orderitems oi 
           JOIN orders o ON oi.orderid = o.orderid 
           WHERE oi.productid = wi.product_id AND o.createdat >= CURRENT_TIMESTAMP - INTERVAL '30 days'), 0.5
        ) as daily_demand
      FROM merchant_warehouse_inventory wi
      JOIN merchant_warehouses w ON wi.warehouse_id = w.warehouse_id
      JOIN products p ON wi.product_id = p.productid
      WHERE wi.merchant_id = $1 OR $1 = 'merchant_admin'
      ORDER BY wi.product_id ASC, wi.warehouse_id ASC;
    `, [merchantId]);
            const byProduct = {};
            for (const r of res.rows) {
                if (!byProduct[r.product_id])
                    byProduct[r.product_id] = [];
                byProduct[r.product_id].push(r);
            }
            const recommendations = [];
            for (const [prodIdStr, nodes] of Object.entries(byProduct)) {
                const prodId = parseInt(prodIdStr, 10);
                const title = ((_a = nodes[0]) === null || _a === void 0 ? void 0 : _a.product_title) || `SKU #${prodId}`;
                // Sort nodes by available quantity descending
                nodes.sort((a, b) => b.available_quantity - a.available_quantity);
                const highestNode = nodes[0];
                const lowestNode = nodes[nodes.length - 1];
                for (const node of nodes) {
                    const regionalDemand = Math.max(0.2, parseFloat(node.daily_demand) * (node.warehouse_id.includes('north') ? 0.5 : node.warehouse_id.includes('south') ? 0.3 : 0.2));
                    const daysOfCover = Math.round(node.available_quantity / regionalDemand);
                    if (node.available_quantity <= 5 && highestNode.available_quantity > 20) {
                        recommendations.push({
                            productId: prodId,
                            productTitle: title,
                            warehouseId: node.warehouse_id,
                            warehouseName: node.warehouse_name,
                            currentAvailable: node.available_quantity,
                            regionalDemandDaily: parseFloat(regionalDemand.toFixed(1)),
                            daysOfCover,
                            recommendedStrategy: 'TRANSFER',
                            recommendedTransferQuantity: Math.min(25, Math.floor(highestNode.available_quantity * 0.4)),
                            targetWarehouseId: node.warehouse_id,
                            reason: `${node.warehouse_name} has only ${daysOfCover} days coverage (${node.available_quantity} units). Transfer from ${highestNode.warehouse_name} (${highestNode.available_quantity} units) to avoid stockout.`,
                            confidence: 'HIGH'
                        });
                    }
                    else if (daysOfCover <= 7) {
                        recommendations.push({
                            productId: prodId,
                            productTitle: title,
                            warehouseId: node.warehouse_id,
                            warehouseName: node.warehouse_name,
                            currentAvailable: node.available_quantity,
                            regionalDemandDaily: parseFloat(regionalDemand.toFixed(1)),
                            daysOfCover,
                            recommendedStrategy: 'RESTOCK',
                            reason: `Regional inventory low (${daysOfCover} days cover). Replenish warehouse node.`,
                            confidence: 'HIGH'
                        });
                    }
                    else if (daysOfCover > 60) {
                        recommendations.push({
                            productId: prodId,
                            productTitle: title,
                            warehouseId: node.warehouse_id,
                            warehouseName: node.warehouse_name,
                            currentAvailable: node.available_quantity,
                            regionalDemandDaily: parseFloat(regionalDemand.toFixed(1)),
                            daysOfCover,
                            recommendedStrategy: 'REDUCE',
                            reason: `Surplus stock (~${daysOfCover} days cover). Consider redistribution or localized promotion.`,
                            confidence: 'MEDIUM'
                        });
                    }
                    else {
                        recommendations.push({
                            productId: prodId,
                            productTitle: title,
                            warehouseId: node.warehouse_id,
                            warehouseName: node.warehouse_name,
                            currentAvailable: node.available_quantity,
                            regionalDemandDaily: parseFloat(regionalDemand.toFixed(1)),
                            daysOfCover,
                            recommendedStrategy: 'KEEP',
                            reason: `Optimal regional stock coverage (${daysOfCover} days buffer).`,
                            confidence: 'HIGH'
                        });
                    }
                }
            }
            return recommendations;
        });
    }
}
exports.WarehouseInventoryEngine = WarehouseInventoryEngine;
exports.warehouseInventoryEngine = new WarehouseInventoryEngine();
