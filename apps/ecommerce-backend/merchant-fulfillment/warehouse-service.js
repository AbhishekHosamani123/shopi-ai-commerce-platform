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
exports.warehouseService = exports.WarehouseService = void 0;
const DB_1 = require("../data/DB");
class WarehouseService {
    /**
     * Initializes synthetic regional warehouses if none exist for merchant.
     */
    ensureWarehouses() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
            const existing = yield this.listWarehouses(merchantId);
            if (existing.length >= 2)
                return existing;
            const defaults = [
                {
                    warehouseId: 'wh_north_delhi',
                    merchantId,
                    name: 'North Fulfillment Hub (Delhi NCR)',
                    city: 'Gurugram',
                    state: 'Haryana',
                    country: 'IN',
                    latitude: 28.4595,
                    longitude: 77.0266,
                    capacity: 15000,
                    status: 'ACTIVE',
                    shippingZones: ['NORTH', 'NCR', 'DELHI', 'PUNJAB', 'UP']
                },
                {
                    warehouseId: 'wh_south_bengaluru',
                    merchantId,
                    name: 'South Distribution Center (Bengaluru)',
                    city: 'Bengaluru',
                    state: 'Karnataka',
                    country: 'IN',
                    latitude: 12.9716,
                    longitude: 77.5946,
                    capacity: 20000,
                    status: 'ACTIVE',
                    shippingZones: ['SOUTH', 'KARNATAKA', 'TAMIL_NADU', 'KERALA', 'TELANGANA']
                },
                {
                    warehouseId: 'wh_west_mumbai',
                    merchantId,
                    name: 'West Express Facility (Mumbai Metro)',
                    city: 'Bhiwandi',
                    state: 'Maharashtra',
                    country: 'IN',
                    latitude: 19.2967,
                    longitude: 73.0631,
                    capacity: 12000,
                    status: 'ACTIVE',
                    shippingZones: ['WEST', 'MAHARASHTRA', 'GUJARAT', 'GOA']
                }
            ];
            for (const w of defaults) {
                yield DB_1.client.query(`
        INSERT INTO merchant_warehouses (
          warehouse_id, merchant_id, name, city, state, country,
          latitude, longitude, capacity, status, shipping_zones
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (warehouse_id) DO NOTHING;
      `, [
                    w.warehouseId, w.merchantId, w.name, w.city, w.state, w.country,
                    w.latitude, w.longitude, w.capacity, w.status, JSON.stringify(w.shippingZones)
                ]);
            }
            return this.listWarehouses(merchantId);
        });
    }
    /**
     * Lists all regional warehouses for a merchant.
     */
    listWarehouses() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
            const res = yield DB_1.client.query(`
      SELECT 
        warehouse_id as "warehouseId",
        merchant_id as "merchantId",
        name,
        city,
        state,
        country,
        latitude::numeric(9,6) as latitude,
        longitude::numeric(9,6) as longitude,
        capacity,
        status,
        shipping_zones as "shippingZones",
        created_at as "createdAt"
      FROM merchant_warehouses
      WHERE merchant_id = $1 OR $1 = 'merchant_admin'
      ORDER BY name ASC;
    `, [merchantId]);
            return res.rows.map(r => (Object.assign(Object.assign({}, r), { latitude: parseFloat(r.latitude) || 0, longitude: parseFloat(r.longitude) || 0, shippingZones: Array.isArray(r.shippingZones) ? r.shippingZones : [] })));
        });
    }
    /**
     * Retrieves single warehouse by ID.
     */
    getWarehouseById(warehouseId_1) {
        return __awaiter(this, arguments, void 0, function* (warehouseId, merchantId = 'default_merchant') {
            const res = yield DB_1.client.query(`
      SELECT 
        warehouse_id as "warehouseId",
        merchant_id as "merchantId",
        name,
        city,
        state,
        country,
        latitude::numeric(9,6) as latitude,
        longitude::numeric(9,6) as longitude,
        capacity,
        status,
        shipping_zones as "shippingZones",
        created_at as "createdAt"
      FROM merchant_warehouses
      WHERE warehouse_id = $1 AND (merchant_id = $2 OR $2 = 'merchant_admin');
    `, [warehouseId, merchantId]);
            if (res.rows.length === 0)
                return null;
            const r = res.rows[0];
            return Object.assign(Object.assign({}, r), { latitude: parseFloat(r.latitude) || 0, longitude: parseFloat(r.longitude) || 0, shippingZones: Array.isArray(r.shippingZones) ? r.shippingZones : [] });
        });
    }
    /**
     * Creates a new custom warehouse record.
     */
    createWarehouse(input_1) {
        return __awaiter(this, arguments, void 0, function* (input, merchantId = 'default_merchant') {
            const warehouseId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
            yield DB_1.client.query(`
      INSERT INTO merchant_warehouses (
        warehouse_id, merchant_id, name, city, state, country,
        latitude, longitude, capacity, status, shipping_zones
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
    `, [
                warehouseId, merchantId, input.name, input.city, input.state, input.country || 'IN',
                input.latitude || 0, input.longitude || 0, input.capacity || 10000, input.status || 'ACTIVE',
                JSON.stringify(input.shippingZones || [])
            ]);
            const created = yield this.getWarehouseById(warehouseId, merchantId);
            return created;
        });
    }
}
exports.WarehouseService = WarehouseService;
exports.warehouseService = new WarehouseService();
