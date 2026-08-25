import { client } from '../data/DB';
import { warehouseService } from './warehouse-service';
import { WarehouseInventoryRecord, WarehouseSKUAllocation } from './warehouse-types';

export class WarehouseInventoryEngine {
  /**
   * Initializes warehouse inventory balances across products if empty.
   */
  async ensureWarehouseInventory(merchantId: string = 'default_merchant'): Promise<void> {
    const warehouses = await warehouseService.ensureWarehouses(merchantId);
    if (warehouses.length === 0) return;

    const prodRes = await client.query('SELECT productid, stock FROM products LIMIT 50');
    for (const p of prodRes.rows) {
      const totalStock = parseInt(p.stock, 10) || 0;
      // Distribute catalog stock across 3 nodes (50% North, 30% South, 20% West)
      const allocations = [
        { whId: warehouses[0]?.warehouseId, qty: Math.round(totalStock * 0.5) },
        { whId: warehouses[1]?.warehouseId, qty: Math.round(totalStock * 0.3) },
        { whId: warehouses[2]?.warehouseId, qty: Math.max(0, totalStock - Math.round(totalStock * 0.5) - Math.round(totalStock * 0.3)) }
      ];

      for (const alloc of allocations) {
        if (!alloc.whId) continue;
        const id = `whinv_${alloc.whId}_${p.productid}`;
        await client.query(`
          INSERT INTO merchant_warehouse_inventory (
            id, warehouse_id, merchant_id, product_id, available_quantity, reserved_quantity, reorder_point, safety_stock
          ) VALUES ($1, $2, $3, $4, $5, 0, 15, 8)
          ON CONFLICT (warehouse_id, product_id) DO NOTHING;
        `, [id, alloc.whId, merchantId, p.productid, alloc.qty]);
      }
    }
  }

  /**
   * Lists inventory records for a specific warehouse.
   */
  async getWarehouseInventory(warehouseId: string, merchantId: string = 'default_merchant'): Promise<WarehouseInventoryRecord[]> {
    await this.ensureWarehouseInventory(merchantId);

    const res = await client.query(`
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
  }

  /**
   * Analyzes multi-node inventory allocation for all SKUs and generates rebalancing recommendations.
   */
  async analyzeWarehouseAllocations(merchantId: string = 'default_merchant'): Promise<WarehouseSKUAllocation[]> {
    await this.ensureWarehouseInventory(merchantId);

    const warehouses = await warehouseService.listWarehouses(merchantId);
    if (warehouses.length < 2) return [];

    const res = await client.query(`
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

    const byProduct: Record<number, any[]> = {};
    for (const r of res.rows) {
      if (!byProduct[r.product_id]) byProduct[r.product_id] = [];
      byProduct[r.product_id].push(r);
    }

    const recommendations: WarehouseSKUAllocation[] = [];

    for (const [prodIdStr, nodes] of Object.entries(byProduct)) {
      const prodId = parseInt(prodIdStr, 10);
      const title = nodes[0]?.product_title || `SKU #${prodId}`;

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
        } else if (daysOfCover <= 7) {
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
        } else if (daysOfCover > 60) {
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
        } else {
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
  }
}

export const warehouseInventoryEngine = new WarehouseInventoryEngine();
