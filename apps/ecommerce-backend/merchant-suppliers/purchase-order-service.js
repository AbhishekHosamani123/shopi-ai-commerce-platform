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
exports.purchaseOrderService = exports.PurchaseOrderService = void 0;
const DB_1 = require("../data/DB");
const manual_adapter_1 = require("./adapters/manual-adapter");
function mapRowToPO(r) {
    return {
        poId: r.po_id,
        merchantId: r.merchant_id,
        poNumber: r.po_number,
        supplierId: r.supplier_id,
        supplierName: r.supplier_name,
        status: r.status,
        items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items || [],
        subtotal: parseFloat(r.subtotal || '0'),
        taxAmount: parseFloat(r.tax_amount || '0'),
        grandTotal: parseFloat(r.grand_total || '0'),
        approvedBy: r.approved_by,
        sentAt: r.sent_at,
        receivedAt: r.received_at,
        createdAt: r.created_at
    };
}
class PurchaseOrderService {
    /**
     * Logs an immutable audit event for a PO state transition.
     */
    logAuditEvent(poId, merchantId, fromStatus, toStatus, triggeredBy, notes) {
        return __awaiter(this, void 0, void 0, function* () {
            const eventId = `po_evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            yield DB_1.client.query(`
      INSERT INTO merchant_purchase_order_events (
        event_id, po_id, merchant_id, from_status, to_status, triggered_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [eventId, poId, merchantId, fromStatus, toStatus, triggeredBy, notes || null]);
        });
    }
    /**
     * Creates a new Purchase Order in DRAFT or APPROVAL_REQUIRED status.
     */
    createPurchaseOrder(input_1) {
        return __awaiter(this, arguments, void 0, function* (input, merchantId = 'default_merchant') {
            const poId = `po_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const poNumber = `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
            // Resolve items with product details
            const items = [];
            let subtotal = 0;
            for (const item of input.items) {
                const prodRes = yield DB_1.client.query('SELECT productid, title, price FROM products WHERE productid = $1', [item.productId]);
                const prod = prodRes.rows[0];
                const title = prod ? prod.title : `Product #${item.productId}`;
                const unitCost = item.unitCost || Math.round(parseFloat((prod === null || prod === void 0 ? void 0 : prod.price) || '1000') * 0.45); // default ~45% procurement cost
                const totalCost = unitCost * item.quantity;
                subtotal += totalCost;
                items.push({
                    productId: item.productId,
                    productTitle: title,
                    sku: `SKU-${item.productId}`,
                    quantity: item.quantity,
                    unitCost,
                    totalCost
                });
            }
            const taxAmount = parseFloat((subtotal * 0.18).toFixed(2)); // 18% GST
            const grandTotal = subtotal + taxAmount;
            const query = `
      INSERT INTO merchant_purchase_orders (
        po_id, merchant_id, po_number, supplier_id, status, items,
        subtotal, tax_amount, grand_total
      ) VALUES ($1, $2, $3, $4, 'APPROVAL_REQUIRED', $5, $6, $7, $8)
      RETURNING *;
    `;
            const res = yield DB_1.client.query(query, [
                poId,
                merchantId,
                poNumber,
                input.supplierId || null,
                JSON.stringify(items),
                subtotal,
                taxAmount,
                grandTotal
            ]);
            yield this.logAuditEvent(poId, merchantId, null, 'APPROVAL_REQUIRED', 'merchant_system', input.notes || 'PO drafted from restock intelligence');
            return mapRowToPO(res.rows[0]);
        });
    }
    /**
     * Approves a purchase order.
     */
    approvePurchaseOrder(poId_1) {
        return __awaiter(this, arguments, void 0, function* (poId, approvedBy = 'merchant_admin', merchantId = 'default_merchant') {
            const po = yield this.getPurchaseOrderById(poId, merchantId);
            if (!po)
                return null;
            const res = yield DB_1.client.query(`
      UPDATE merchant_purchase_orders
      SET status = 'APPROVED', approved_by = $2
      WHERE po_id = $1 AND (merchant_id = $3 OR $3 = 'merchant_admin')
      RETURNING *;
    `, [poId, approvedBy, merchantId]);
            if (res.rows.length === 0)
                return null;
            yield this.logAuditEvent(poId, merchantId, po.status, 'APPROVED', approvedBy, 'Merchant approved purchase order');
            return mapRowToPO(res.rows[0]);
        });
    }
    /**
     * Transmits purchase order via specified protocol.
     */
    sendPurchaseOrder(poId_1) {
        return __awaiter(this, arguments, void 0, function* (poId, protocol = 'MANUAL', merchantId = 'default_merchant') {
            const po = yield this.getPurchaseOrderById(poId, merchantId);
            if (!po) {
                return { success: false, po: null, message: 'Purchase Order not found' };
            }
            const adapter = protocol === 'SFTP'
                ? new manual_adapter_1.SftpSupplierAdapter()
                : protocol === 'AS2'
                    ? new manual_adapter_1.As2SupplierAdapter()
                    : new manual_adapter_1.ManualSupplierAdapter();
            const transmission = yield adapter.sendPurchaseOrder(po);
            const res = yield DB_1.client.query(`
      UPDATE merchant_purchase_orders
      SET status = 'SENT', sent_at = CURRENT_TIMESTAMP
      WHERE po_id = $1 AND (merchant_id = $2 OR $2 = 'merchant_admin')
      RETURNING *;
    `, [poId, merchantId]);
            yield this.logAuditEvent(poId, merchantId, po.status, 'SENT', 'merchant_admin', transmission.message);
            return {
                success: true,
                po: res.rows[0] ? mapRowToPO(res.rows[0]) : po,
                message: transmission.message
            };
        });
    }
    /**
     * Receives warehouse goods against a purchase order and safely updates inventory ledger.
     */
    receivePurchaseOrder(poId_1) {
        return __awaiter(this, arguments, void 0, function* (poId, receivedBy = 'warehouse_ops', merchantId = 'default_merchant') {
            var _a;
            const po = yield this.getPurchaseOrderById(poId, merchantId);
            if (!po)
                return null;
            // Mutate catalog inventory and ledger
            for (const item of po.items) {
                const curStockRes = yield DB_1.client.query('SELECT stock FROM products WHERE productid = $1', [item.productId]);
                const stockBefore = ((_a = curStockRes.rows[0]) === null || _a === void 0 ? void 0 : _a.stock) || 0;
                const stockAfter = stockBefore + item.quantity;
                yield DB_1.client.query(`
        UPDATE products 
        SET stock = $1, updatedat = CURRENT_TIMESTAMP
        WHERE productid = $2;
      `, [stockAfter, item.productId]);
                yield DB_1.client.query(`
        INSERT INTO inventory_movements (
          productid, movement_type, quantity, stock_before, stock_after, reference_type, reference_id, notes
        ) VALUES ($1, 'RESTOCK_PO', $2, $3, $4, 'PURCHASE_ORDER', $5, $6);
      `, [item.productId, item.quantity, stockBefore, stockAfter, po.poNumber, `Received PO ${po.poNumber}`]);
            }
            const res = yield DB_1.client.query(`
      UPDATE merchant_purchase_orders
      SET status = 'RECEIVED', received_at = CURRENT_TIMESTAMP
      WHERE po_id = $1 AND (merchant_id = $2 OR $2 = 'merchant_admin')
      RETURNING *;
    `, [poId, merchantId]);
            yield this.logAuditEvent(poId, merchantId, po.status, 'RECEIVED', receivedBy, 'Goods inspected and restocked to live inventory');
            return mapRowToPO(res.rows[0]);
        });
    }
    /**
     * Cancels a purchase order.
     */
    cancelPurchaseOrder(poId_1) {
        return __awaiter(this, arguments, void 0, function* (poId, reason = 'Cancelled by merchant', merchantId = 'default_merchant') {
            const po = yield this.getPurchaseOrderById(poId, merchantId);
            if (!po)
                return null;
            const res = yield DB_1.client.query(`
      UPDATE merchant_purchase_orders
      SET status = 'CANCELLED'
      WHERE po_id = $1 AND (merchant_id = $2 OR $2 = 'merchant_admin')
      RETURNING *;
    `, [poId, merchantId]);
            yield this.logAuditEvent(poId, merchantId, po.status, 'CANCELLED', 'merchant_admin', reason);
            return mapRowToPO(res.rows[0]);
        });
    }
    /**
     * Gets a purchase order by ID with tenant isolation.
     */
    getPurchaseOrderById(poId_1) {
        return __awaiter(this, arguments, void 0, function* (poId, merchantId = 'default_merchant') {
            const query = `
      SELECT po.*, s.name as supplier_name
      FROM merchant_purchase_orders po
      LEFT JOIN merchant_suppliers s ON po.supplier_id = s.supplier_id
      WHERE po.po_id = $1 AND (po.merchant_id = $2 OR $2 = 'merchant_admin');
    `;
            const res = yield DB_1.client.query(query, [poId, merchantId]);
            if (res.rows.length === 0)
                return null;
            return mapRowToPO(res.rows[0]);
        });
    }
    /**
     * Lists purchase orders for a merchant.
     */
    listPurchaseOrders() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
            const query = `
      SELECT po.*, s.name as supplier_name
      FROM merchant_purchase_orders po
      LEFT JOIN merchant_suppliers s ON po.supplier_id = s.supplier_id
      WHERE po.merchant_id = $1 OR $1 = 'merchant_admin'
      ORDER BY po.created_at DESC;
    `;
            const res = yield DB_1.client.query(query, [merchantId]);
            return res.rows.map(mapRowToPO);
        });
    }
}
exports.PurchaseOrderService = PurchaseOrderService;
exports.purchaseOrderService = new PurchaseOrderService();
