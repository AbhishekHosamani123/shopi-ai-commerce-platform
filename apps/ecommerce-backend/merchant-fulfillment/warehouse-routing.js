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
exports.geospatialRoutingEngine = exports.GeospatialFulfillmentRoutingEngine = void 0;
const DB_1 = require("../data/DB");
const warehouse_service_1 = require("./warehouse-service");
const warehouse_inventory_1 = require("./warehouse-inventory");
const warehouse_cost_engine_1 = require("./warehouse-cost-engine");
class GeospatialFulfillmentRoutingEngine {
    /**
     * Deterministically finds the optimal warehouse to fulfill an order.
     */
    routeFulfillment(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const merchantId = input.merchantId || 'default_merchant';
            yield warehouse_inventory_1.warehouseInventoryEngine.ensureWarehouseInventory(merchantId);
            const warehouses = yield warehouse_service_1.warehouseService.listWarehouses(merchantId);
            if (warehouses.length === 0)
                return null;
            // Get inventory across warehouses for this product
            const invRes = yield DB_1.client.query(`
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
                const shippingEstimate = (0, warehouse_cost_engine_1.estimateShippingCost)(parseFloat(r.latitude) || 28.5, parseFloat(r.longitude) || 77.0, input.customerLat || 13.0, input.customerLon || 77.6, input.quantity);
                const hasStock = r.available_quantity >= input.quantity;
                const zoneMatch = input.customerZone && Array.isArray(r.shipping_zones)
                    ? r.shipping_zones.includes(input.customerZone.toUpperCase())
                    : false;
                // Scoring: prioritize stock availability (1000 pts), zone proximity (200 pts), low shipping cost (up to 100 pts)
                let score = 0;
                if (hasStock)
                    score += 1000;
                if (zoneMatch)
                    score += 200;
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
            if (!best)
                return null;
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
        });
    }
}
exports.GeospatialFulfillmentRoutingEngine = GeospatialFulfillmentRoutingEngine;
exports.geospatialRoutingEngine = new GeospatialFulfillmentRoutingEngine();
