import { client } from '../data/DB';
import { SupplierRecord, SupplierReliabilityScore } from './supplier-types';

function mapRowToSupplier(r: any): SupplierRecord {
  return {
    supplierId: r.supplier_id,
    merchantId: r.merchant_id,
    name: r.name,
    leadTimeDays: parseInt(r.lead_time_days || '7', 10),
    minimumOrderQuantity: parseInt(r.minimum_order_quantity || '25', 10),
    unitCost: r.unit_cost ? parseFloat(r.unit_cost) : null,
    reliabilityScore: r.reliability_score as SupplierReliabilityScore,
    contact: typeof r.contact === 'string' ? JSON.parse(r.contact) : r.contact || {},
    supportedProducts: typeof r.supported_products === 'string' ? JSON.parse(r.supported_products) : r.supported_products || [],
    status: r.status,
    isSynthetic: r.is_synthetic ?? true,
    createdAt: r.created_at
  };
}

export class SupplierService {
  /**
   * Initializes default synthetic suppliers if table is empty.
   */
  async ensureDefaultSuppliers(merchantId: string = 'default_merchant'): Promise<void> {
    const res = await client.query('SELECT COUNT(*)::int as count FROM merchant_suppliers WHERE merchant_id = $1', [merchantId]);
    if (res.rows[0].count === 0) {
      const prods = await client.query('SELECT productid FROM products LIMIT 5');
      const pids = prods.rows.map(r => r.productid);

      const defaults = [
        {
          id: 'supp_acme_footwear',
          name: 'Acme Footwear Supplies (Synthetic Demo)',
          leadTime: 5,
          moq: 30,
          unitCost: 850,
          reliability: 'HIGH',
          contact: { email: 'orders@acmefootwear.local', phone: '+91 98765 43210' },
          products: pids.slice(0, 3)
        },
        {
          id: 'supp_apex_apparel',
          name: 'Apex Apparel & Textiles (Synthetic Demo)',
          leadTime: 8,
          moq: 50,
          unitCost: 450,
          reliability: 'MEDIUM',
          contact: { email: 'supply@apexapparel.local' },
          products: pids.slice(2, 5)
        }
      ];

      for (const d of defaults) {
        await client.query(`
          INSERT INTO merchant_suppliers (
            supplier_id, merchant_id, name, lead_time_days, minimum_order_quantity,
            unit_cost, reliability_score, contact, supported_products, status, is_synthetic
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', true)
          ON CONFLICT (supplier_id) DO NOTHING;
        `, [
          d.id,
          merchantId,
          d.name,
          d.leadTime,
          d.moq,
          d.unitCost,
          d.reliability,
          JSON.stringify(d.contact),
          JSON.stringify(d.products)
        ]);

        await client.query(`
          INSERT INTO merchant_supplier_performance (
            perf_id, supplier_id, merchant_id, on_time_pct, avg_lead_time_days,
            fill_rate_pct, total_orders_count, reliability_score
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (perf_id) DO NOTHING;
        `, [
          `perf_${d.id}`,
          d.id,
          merchantId,
          d.reliability === 'HIGH' ? 96.5 : 82.0,
          d.leadTime,
          d.reliability === 'HIGH' ? 99.0 : 88.5,
          12,
          d.reliability
        ]);
      }
    }
  }

  /**
   * Creates a new supplier.
   */
  async createSupplier(
    input: Partial<SupplierRecord>,
    merchantId: string = 'default_merchant'
  ): Promise<SupplierRecord> {
    const supplierId = input.supplierId || `supp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const query = `
      INSERT INTO merchant_suppliers (
        supplier_id, merchant_id, name, lead_time_days, minimum_order_quantity,
        unit_cost, reliability_score, contact, supported_products, status, is_synthetic
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', $10)
      RETURNING *;
    `;

    const res = await client.query(query, [
      supplierId,
      merchantId,
      input.name || 'New Supplier',
      input.leadTimeDays || 7,
      input.minimumOrderQuantity || 25,
      input.unitCost || null,
      input.reliabilityScore || 'MEDIUM',
      JSON.stringify(input.contact || {}),
      JSON.stringify(input.supportedProducts || []),
      input.isSynthetic ?? false
    ]);

    return mapRowToSupplier(res.rows[0]);
  }

  /**
   * Lists all suppliers for a merchant.
   */
  async listSuppliers(merchantId: string = 'default_merchant'): Promise<SupplierRecord[]> {
    await this.ensureDefaultSuppliers(merchantId);
    const res = await client.query(
      `SELECT * FROM merchant_suppliers WHERE merchant_id = $1 OR $1 = 'merchant_admin' ORDER BY created_at ASC`,
      [merchantId]
    );
    return res.rows.map(mapRowToSupplier);
  }

  /**
   * Gets a supplier by ID with tenant isolation.
   */
  async getSupplierById(supplierId: string, merchantId: string = 'default_merchant'): Promise<SupplierRecord | null> {
    const res = await client.query(
      `SELECT * FROM merchant_suppliers WHERE supplier_id = $1 AND (merchant_id = $2 OR $2 = 'merchant_admin')`,
      [supplierId, merchantId]
    );
    if (res.rows.length === 0) return null;
    return mapRowToSupplier(res.rows[0]);
  }
}

export const supplierService = new SupplierService();
