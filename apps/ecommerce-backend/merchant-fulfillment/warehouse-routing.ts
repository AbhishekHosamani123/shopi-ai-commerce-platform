import { client } from '../data/DB';
import { warehouseService } from './warehouse-service';
import { warehouseInventoryEngine } from './warehouse-inventory';
import { estimateShippingCost } from './warehouse-cost-engine';
import { GeospatialRoutingResult } from './warehouse-types';

export interface RouteFulfillmentInput {
  productId: number;
  quantity: number;
  customerLat?: number;
  customerLon?: number;
  customerZone?: string;
  merchantId?: string;
}

export class GeospatialFulfillmentRoutingEngine {
  /**
   * Deterministically finds the optimal warehouse to fulfill an order.
   */
  async routeFulfillment(input: RouteFulfillmentInput): Promise<GeospatialRoutingResult | null> {
    const merchantId = input.merchantId || 'default_merchant';
    await warehouseInventoryEngine.ensureWarehouseInventory(merchantId);

    const warehouses = await warehouseService.listWarehouses(merchantId);
    if (warehouses.length === 0) return null;

    // Get inventory across warehouses for this product
    const invRes = await client.query(`
      SELECT 
        wi.warehouse_id,
        w.name as warehouse_name,
        w.latitude,
        w.longitude,
        w.shipping_zones,
        wi.available_quantity
      FROM merchant_warehouse_inventory wi
      JOIN merchant_warehouses w ON wi.warehouse_id = w.warehouse_id
      WHERE wi.product_id = $1 AND (wi.merchant_id = $2 OR $2 = 'merchant_admin')
      ORDER BY wi.available_quantity DESC;
    `, [input.productId, merchantId]);

    const candidates = invRes.rows.map(r => {
      const shippingEstimate = estimateShippingCost(
        parseFloat(r.latitude) || 28.5,
        parseFloat(r.longitude) || 77.0,
        input.customerLat || 13.0,
        input.customerLon || 77.6,
        input.quantity
      );

      const hasStock = r.available_quantity >= input.quantity;
      const zoneMatch = input.customerZone && Array.isArray(r.shipping_zones)
        ? r.shipping_zones.includes(input.customerZone.toUpperCase())
        : false;

      // Scoring: prioritize stock availability (1000 pts), zone proximity (200 pts), low shipping cost (up to 100 pts)
      let score = 0;
      if (hasStock) score += 1000;
      if (zoneMatch) score += 200;
      score += Math.max(0, 100 - shippingEstimate.estimatedCost);

      return {
        warehouseId: r.warehouse_id,
        warehouseName: r.warehouse_name,
        availableStock: r.available_quantity,
        hasStock,
        estimatedShippingCost: shippingEstimate.estimatedCost,
        estimatedTransitDays: shippingEstimate.transitDaysEstimate,
        score,
        zoneMatch
      };
    });

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best) return null;

    return {
      bestWarehouseId: best.warehouseId,
      bestWarehouseName: best.warehouseName,
      productId: input.productId,
      requestedQuantity: input.quantity,
      canFulfill: best.hasStock,
      availableStock: best.availableStock,
      estimatedShippingCost: best.estimatedShippingCost,
      estimatedTransitDays: best.estimatedTransitDays,
      shippingZone: input.customerZone || 'REGIONAL',
      routingReason: best.hasStock
        ? `Routed to ${best.warehouseName} (Score: ${best.score}). Sufficient stock (${best.availableStock} units) with lowest estimated delivery transit (${best.estimatedTransitDays}d).`
        : `Warning: Insufficient localized stock at ${best.warehouseName} (${best.availableStock} vs ${input.quantity} requested). Secondary routing or restock required.`
    };
  }
}

export const geospatialRoutingEngine = new GeospatialFulfillmentRoutingEngine();
