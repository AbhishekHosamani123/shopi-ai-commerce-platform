import { client } from '../data/DB';

export interface ProductCogsRecord {
  cogsId: string;
  merchantId: string;
  productId: number;
  productTitle?: string;
  sellingPrice: number;
  unitCost: number | null;
  supplierCost: number | null;
  shippingCost: number | null;
  handlingCost: number | null;
  grossMarginAmount: number | null;
  grossMarginPercentage: number | null;
  contributionMarginAmount: number | null;
  isCogsAvailable: boolean;
  updatedAt: string;
}

export interface SetCogsInput {
  productId: number;
  unitCost: number;
  supplierCost?: number;
  shippingCost?: number;
  handlingCost?: number;
  merchantId?: string;
}

export class ProductCogsService {
  /**
   * Retrieves COGS structure and margin metrics for a product.
   */
  async getProductCogs(productId: number, merchantId: string = 'default_merchant'): Promise<ProductCogsRecord | null> {
    const prodRes = await client.query('SELECT productid, title, price, discount FROM products WHERE productid = $1', [productId]);
    if (prodRes.rows.length === 0) return null;
    const prod = prodRes.rows[0];
    const sellingPrice = parseFloat(prod.discount || prod.price) || 1000;

    const cogsRes = await client.query(`
      SELECT 
        cogs_id as "cogsId",
        merchant_id as "merchantId",
        product_id as "productId",
        unit_cost::numeric(10,2) as "unitCost",
        supplier_cost::numeric(10,2) as "supplierCost",
        shipping_cost::numeric(10,2) as "shippingCost",
        handling_cost::numeric(10,2) as "handlingCost",
        updated_at as "updatedAt"
      FROM merchant_product_cogs
      WHERE product_id = $1 AND (merchant_id = $2 OR $2 = 'merchant_admin');
    `, [productId, merchantId]);

    if (cogsRes.rows.length === 0) {
      return {
        cogsId: `cogs_none_${productId}`,
        merchantId,
        productId,
        productTitle: prod.title,
        sellingPrice,
        unitCost: null,
        supplierCost: null,
        shippingCost: null,
        handlingCost: null,
        grossMarginAmount: null,
        grossMarginPercentage: null,
        contributionMarginAmount: null,
        isCogsAvailable: false,
        updatedAt: new Date().toISOString()
      };
    }

    const c = cogsRes.rows[0];
    const unitCost = parseFloat(c.unitCost) || 0;
    const supplierCost = parseFloat(c.supplierCost) || unitCost;
    const shippingCost = parseFloat(c.shippingCost) || 0;
    const handlingCost = parseFloat(c.handlingCost) || 0;

    const grossMarginAmount = Math.max(0, parseFloat((sellingPrice - unitCost).toFixed(2)));
    const grossMarginPercentage = sellingPrice > 0 ? parseFloat(((grossMarginAmount / sellingPrice) * 100).toFixed(1)) : 0;
    const totalCost = unitCost + shippingCost + handlingCost;
    const contributionMarginAmount = parseFloat((sellingPrice - totalCost).toFixed(2));

    return {
      cogsId: c.cogsId,
      merchantId,
      productId,
      productTitle: prod.title,
      sellingPrice,
      unitCost,
      supplierCost,
      shippingCost,
      handlingCost,
      grossMarginAmount,
      grossMarginPercentage,
      contributionMarginAmount,
      isCogsAvailable: true,
      updatedAt: c.updatedAt
    };
  }

  /**
   * Sets or updates COGS cost records for a product.
   */
  async setProductCogs(input: SetCogsInput): Promise<ProductCogsRecord> {
    const merchantId = input.merchantId || 'default_merchant';
    const cogsId = `cogs_${Date.now()}_${input.productId}`;

    await client.query(`
      INSERT INTO merchant_product_cogs (
        cogs_id, merchant_id, product_id, unit_cost, supplier_cost, shipping_cost, handling_cost, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (product_id) DO UPDATE
      SET unit_cost = $4, supplier_cost = $5, shipping_cost = $6, handling_cost = $7, updated_at = CURRENT_TIMESTAMP;
    `, [
      cogsId,
      merchantId,
      input.productId,
      input.unitCost,
      input.supplierCost || input.unitCost,
      input.shippingCost || 0,
      input.handlingCost || 0
    ]);

    const res = await this.getProductCogs(input.productId, merchantId);
    return res!;
  }
}

export const productCogsService = new ProductCogsService();
