import { client } from '../data/DB';
import { supplierService } from './supplier-service';
import {
  PurchaseOrderRecord,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  CreatePurchaseOrderInput,
  PurchaseOrderAuditEvent
} from './supplier-types';
import { ManualSupplierAdapter, SftpSupplierAdapter, As2SupplierAdapter } from './adapters/manual-adapter';

function mapRowToPO(r: any): PurchaseOrderRecord {
  return {
    poId: r.po_id,
    merchantId: r.merchant_id,
    poNumber: r.po_number,
    supplierId: r.supplier_id,
    supplierName: r.supplier_name,
    status: r.status as PurchaseOrderStatus,
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

export class PurchaseOrderService {
  /**
   * Logs an immutable audit event for a PO state transition.
   */
  private async logAuditEvent(
    poId: string,
    merchantId: string,
    fromStatus: PurchaseOrderStatus | null,
    toStatus: PurchaseOrderStatus,
    triggeredBy: string,
    notes?: string
  ): Promise<void> {
    const eventId = `po_evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await client.query(`
      INSERT INTO merchant_purchase_order_events (
        event_id, po_id, merchant_id, from_status, to_status, triggered_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [eventId, poId, merchantId, fromStatus, toStatus, triggeredBy, notes || null]);
  }

  /**
   * Creates a new Purchase Order in DRAFT or APPROVAL_REQUIRED status.
   */
  async createPurchaseOrder(
    input: CreatePurchaseOrderInput,
    merchantId: string = 'default_merchant'
  ): Promise<PurchaseOrderRecord> {
    const poId = `po_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const poNumber = `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    // Resolve items with product details
    const items: PurchaseOrderItem[] = [];
    let subtotal = 0;

    for (const item of input.items) {
      const prodRes = await client.query(`
        SELECT p.product_id, p.sku, p.title, p.selling_price as price, cg.total_unit_cost
        FROM shopi_products p
        LEFT JOIN shopi_product_cogs cg ON p.product_id = cg.product_id
        WHERE p.product_id = $1
      `, [item.productId]);
      const prod = prodRes.rows[0];
      const title = prod ? prod.title : `Product #${item.productId}`;
      const sku = prod ? prod.sku : `SKU-${item.productId}`;
      const unitCost = item.unitCost || (prod?.total_unit_cost ? parseFloat(prod.total_unit_cost) : Math.round(parseFloat(prod?.price || '1000') * 0.45));
      const totalCost = unitCost * item.quantity;
      subtotal += totalCost;

      items.push({
        productId: item.productId,
        productTitle: title,
        sku,
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

    const res = await client.query(query, [
      poId,
      merchantId,
      poNumber,
      input.supplierId,
      JSON.stringify(items),
      subtotal,
      taxAmount,
      grandTotal
    ]);

    const row = res.rows[0];
    return {
      poId: row.po_id,
      merchantId: row.merchant_id,
      poNumber: row.po_number,
      supplierId: row.supplier_id,
      supplierName: (input as any).supplierName,
      status: row.status,
      items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
      subtotal: parseFloat(row.subtotal),
      taxAmount: parseFloat(row.tax_amount),
      grandTotal: parseFloat(row.grand_total),
      currency: row.currency,
      expectedDeliveryDate: row.expected_delivery_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as PurchaseOrderRecord;
  }

  /**
   * Approves a pending Purchase Order and transitions to ISSUED.
   */
  async approvePurchaseOrder(
    poId: string,
    approvedBy: string = 'merchant_admin',
    merchantId: string = 'default_merchant'
  ): Promise<PurchaseOrderRecord | null> {
    const res = await client.query(`
      UPDATE merchant_purchase_orders
      SET status = 'ISSUED', approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE po_id = $1 AND (merchant_id = $2 OR $2 = 'merchant_admin')
      RETURNING *;
    `, [poId, merchantId]);

    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      poId: row.po_id,
      merchantId: row.merchant_id,
      poNumber: row.po_number,
      supplierId: row.supplier_id,
      status: row.status,
      items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
      subtotal: parseFloat(row.subtotal),
      taxAmount: parseFloat(row.tax_amount),
      grandTotal: parseFloat(row.grand_total),
      currency: row.currency,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as PurchaseOrderRecord;
  }

  /**
   * Rejects a pending Purchase Order.
   */
  async rejectPurchaseOrder(
    poId: string,
    reason: string,
    merchantId: string = 'default_merchant'
  ): Promise<PurchaseOrderRecord | null> {
    const res = await client.query(`
      UPDATE merchant_purchase_orders
      SET status = 'REJECTED', notes = $3, updated_at = CURRENT_TIMESTAMP
      WHERE po_id = $1 AND (merchant_id = $2 OR $2 = 'merchant_admin')
      RETURNING *;
    `, [poId, merchantId, reason]);

    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      poId: row.po_id,
      merchantId: row.merchant_id,
      poNumber: row.po_number,
      supplierId: row.supplier_id,
      status: row.status,
      items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
      subtotal: parseFloat(row.subtotal),
      taxAmount: parseFloat(row.tax_amount),
      grandTotal: parseFloat(row.grand_total),
      currency: row.currency,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as PurchaseOrderRecord;
  }

  /**
   * Transmits purchase order via specified protocol.
   */
  async sendPurchaseOrder(
    poId: string,
    protocol: 'MANUAL' | 'SFTP' | 'AS2' = 'MANUAL',
    merchantId: string = 'default_merchant'
  ): Promise<{ success: boolean; po: PurchaseOrderRecord | null; message: string }> {
    const po = await this.getPurchaseOrderById(poId, merchantId);
    if (!po) {
      return { success: false, po: null, message: 'Purchase Order not found' };
    }

    const adapter = protocol === 'SFTP'
      ? new SftpSupplierAdapter()
      : protocol === 'AS2'
      ? new As2SupplierAdapter()
      : new ManualSupplierAdapter();

    const transmission = await adapter.sendPurchaseOrder(po);

    const res = await client.query(`
      UPDATE merchant_purchase_orders
      SET status = 'SENT', sent_at = CURRENT_TIMESTAMP
      WHERE po_id = $1 AND (merchant_id = $2 OR $2 = 'merchant_admin')
      RETURNING *;
    `, [poId, merchantId]);

    await this.logAuditEvent(poId, merchantId, po.status, 'SENT', 'merchant_admin', transmission.message);

    return {
      success: true,
      po: res.rows[0] ? mapRowToPO(res.rows[0]) : po,
      message: transmission.message
    };
  }

  /**
   * Receives warehouse goods against a purchase order and safely updates inventory ledger.
   */
  async receivePurchaseOrder(
    poId: string,
    receivedBy: string = 'warehouse_ops',
    merchantId: string = 'default_merchant'
  ): Promise<PurchaseOrderRecord | null> {
    const po = await this.getPurchaseOrderById(poId, merchantId);
    if (!po) return null;

    // Mutate catalog inventory and ledger
    for (const item of po.items) {
      const curStockRes = await client.query('SELECT stock_quantity FROM shopi_products WHERE product_id = $1', [item.productId]);
      const stockBefore = curStockRes.rows[0]?.stock_quantity || 0;
      const stockAfter = stockBefore + item.quantity;

      await client.query(`
        UPDATE shopi_products 
        SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP
        WHERE product_id = $2;
      `, [stockAfter, item.productId]);

      await client.query(`
        INSERT INTO shopi_inventory_movements (
          product_id, movement_type, quantity, stock_before, stock_after, reference_type, reference_id, notes
        ) VALUES ($1, 'RESTOCK_PO', $2, $3, $4, 'PURCHASE_ORDER', $5, $6);
      `, [item.productId, item.quantity, stockBefore, stockAfter, po.poNumber, `Received PO ${po.poNumber}`]);
    }

    const res = await client.query(`
      UPDATE merchant_purchase_orders
      SET status = 'RECEIVED', received_at = CURRENT_TIMESTAMP
      WHERE po_id = $1 AND (merchant_id = $2 OR $2 = 'merchant_admin')
      RETURNING *;
    `, [poId, merchantId]);

    await this.logAuditEvent(poId, merchantId, po.status, 'RECEIVED', receivedBy, 'Goods inspected and restocked to live inventory');

    return mapRowToPO(res.rows[0]);
  }

  /**
   * Cancels a purchase order.
   */
  async cancelPurchaseOrder(
    poId: string,
    reason: string = 'Cancelled by merchant',
    merchantId: string = 'default_merchant'
  ): Promise<PurchaseOrderRecord | null> {
    const po = await this.getPurchaseOrderById(poId, merchantId);
    if (!po) return null;

    const res = await client.query(`
      UPDATE merchant_purchase_orders
      SET status = 'CANCELLED'
      WHERE po_id = $1 AND (merchant_id = $2 OR $2 = 'merchant_admin')
      RETURNING *;
    `, [poId, merchantId]);

    await this.logAuditEvent(poId, merchantId, po.status, 'CANCELLED', 'merchant_admin', reason);

    return mapRowToPO(res.rows[0]);
  }

  /**
   * Gets a purchase order by ID with tenant isolation.
   */
  async getPurchaseOrderById(poId: string, merchantId: string = 'default_merchant'): Promise<PurchaseOrderRecord | null> {
    const query = `
      SELECT po.*, s.name as supplier_name
      FROM merchant_purchase_orders po
      LEFT JOIN merchant_suppliers s ON po.supplier_id = s.supplier_id
      WHERE po.po_id = $1 AND (po.merchant_id = $2 OR $2 = 'merchant_admin');
    `;
    const res = await client.query(query, [poId, merchantId]);
    if (res.rows.length === 0) return null;
    return mapRowToPO(res.rows[0]);
  }

  /**
   * Lists purchase orders for a merchant.
   */
  async listPurchaseOrders(merchantId: string = 'default_merchant'): Promise<PurchaseOrderRecord[]> {
    const query = `
      SELECT po.*, s.name as supplier_name
      FROM merchant_purchase_orders po
      LEFT JOIN merchant_suppliers s ON po.supplier_id = s.supplier_id
      WHERE po.merchant_id = $1 OR $1 = 'merchant_admin'
      ORDER BY po.created_at DESC;
    `;
    const res = await client.query(query, [merchantId]);
    return res.rows.map(mapRowToPO);
  }
}

export const purchaseOrderService = new PurchaseOrderService();
