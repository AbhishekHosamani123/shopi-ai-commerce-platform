import { client } from './DB';

/**
 * ⚡ MERCHANT SUPABASE DATA ACCESS LAYER (Phase 11C)
 * 
 * Canonical Data Access Service for Merchant AI operations grounded in the
 * new Supabase commerce dataset (shopi_* tables).
 * 
 * Strict Architecture Rules:
 * 1. Data Access Only - Zero AI reasoning / prompt generation here.
 * 2. Canonical Product Identifiers only (shopi_products.product_id, sku, variant_id).
 * 3. Explicit Simple vs Variant Product support:
 *    - Simple products (e.g. FORMAL-SHOE-006, SPORTS-SHOE-004) have productType = 'SIMPLE_PRODUCT' and variants = [].
 *    - Variant products have productType = 'HAS_VARIANTS' and variants = [...].
 * 4. Grounded Financial Safety: 15% minimum margin floor enforced on discount calculations.
 */

export type ProductType = 'SIMPLE_PRODUCT' | 'HAS_VARIANTS';

export interface CanonicalProduct {
  product_id: number;
  sku: string;
  title: string;
  brand: string | null;
  department: string;
  category: string;
  subcategory: string | null;
  gender: string | null;
  short_description: string | null;
  description: string | null;
  mrp: number;
  selling_price: number;
  discount_percentage: number;
  currency: string;
  stock_quantity: number;
  is_available: boolean;
  product_type: ProductType;
  variants_count: number;
}

export interface CanonicalVariant {
  variant_id: number;
  product_id: number;
  color: string | null;
  size: string | null;
  variant_sku: string;
  stock_quantity: number;
  is_available: boolean;
  additional_options: Record<string, any>;
}

export interface ProductInventorySummary {
  product_id: number;
  sku: string;
  title: string;
  product_type: ProductType;
  total_stock: number;
  is_in_stock: boolean;
  variants: Array<{
    variant_id: number;
    color: string | null;
    size: string | null;
    variant_sku: string;
    stock: number;
    is_available: boolean;
  }>;
}

export interface CanonicalOrder {
  order_id: string;
  order_number: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  order_status: string;
  payment_status: string;
  payment_method: string;
  currency: string;
  subtotal_amount: number;
  discount_amount: number;
  shipping_amount: number;
  tax_amount: number;
  total_amount: number;
  coupon_code: string | null;
  campaign_id: string | null;
  order_placed_at: string;
  items_count?: number;
}

export interface CanonicalOrderItem {
  order_item_id: string;
  order_id: string;
  product_id: number;
  variant_id: number | null;
  sku: string;
  variant_sku: string | null;
  product_title: string;
  selected_color: string | null;
  selected_size: string | null;
  unit_price: number;
  quantity: number;
  discount_amount: number;
  line_total: number;
  unit_cogs: number;
  contribution_margin: number;
}

export interface CanonicalCustomer {
  customer_id: string;
  merchant_id: string;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string;
  created_at: string;
  total_orders?: number;
  total_spend?: number;
}

export interface ProductCogsRecord {
  cogs_id: string;
  product_id: number;
  sku: string;
  unit_manufacturing_cost: number;
  unit_packaging_cost: number;
  unit_shipping_cost: number;
  unit_payment_processing_fee: number;
  total_unit_cost: number;
  reference_selling_price: number;
  baseline_gross_margin: number;
  baseline_gross_margin_pct: number;
  minimum_margin_floor_pct: number;
  maximum_safe_discount_amount: number;
  maximum_safe_discount_pct: number;
  is_synthetic: boolean;
}

export class MerchantSupabaseService {
  // Known simple products in canonical catalog with zero variants
  private static SIMPLE_PRODUCT_IDS = new Set<number>([43, 88]); // FORMAL-SHOE-006, SPORTS-SHOE-004
  private static SIMPLE_PRODUCT_SKUS = new Set<string>(['FORMAL-SHOE-006', 'SPORTS-SHOE-004']);

  // ============================================================================
  // PRODUCTS DOMAIN
  // ============================================================================

  /**
   * Retrieves all canonical products with variant classification.
   */
  static async getProducts(filters?: { category?: string; department?: string; inStockOnly?: boolean }): Promise<CanonicalProduct[]> {
    let query = `
      SELECT 
        p.product_id, p.sku, p.title, p.brand, p.department, p.category, p.subcategory,
        p.gender, p.short_description, p.description, p.mrp::numeric(10,2) as mrp,
        p.selling_price::numeric(10,2) as selling_price,
        p.discount_percentage::numeric(5,2) as discount_percentage,
        p.currency, p.stock_quantity, p.is_available,
        COUNT(v.variant_id)::int as variants_count
      FROM shopi_products p
      LEFT JOIN shopi_product_variants v ON p.product_id = v.product_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.category) {
      params.push(filters.category);
      query += ` AND p.category = $${params.length}`;
    }
    if (filters?.department) {
      params.push(filters.department);
      query += ` AND p.department = $${params.length}`;
    }
    if (filters?.inStockOnly) {
      query += ` AND p.stock_quantity > 0 AND p.is_available = TRUE`;
    }

    query += `
      GROUP BY p.product_id
      ORDER BY p.product_id ASC
    `;

    const res = await client.query(query, params);

    return res.rows.map((r: any) => ({
      product_id: r.product_id,
      sku: r.sku,
      title: r.title,
      brand: r.brand,
      department: r.department,
      category: r.category,
      subcategory: r.subcategory,
      gender: r.gender,
      short_description: r.short_description,
      description: r.description,
      mrp: parseFloat(r.mrp),
      selling_price: parseFloat(r.selling_price),
      discount_percentage: parseFloat(r.discount_percentage),
      currency: r.currency,
      stock_quantity: r.stock_quantity,
      is_available: r.is_available,
      product_type: (r.variants_count === 0 || this.SIMPLE_PRODUCT_IDS.has(r.product_id)) ? 'SIMPLE_PRODUCT' : 'HAS_VARIANTS',
      variants_count: r.variants_count
    }));
  }

  /**
   * Retrieves single product by product_id.
   */
  static async getProduct(productId: number | string): Promise<CanonicalProduct | null> {
    const id = typeof productId === 'string' ? parseInt(productId, 10) : productId;
    if (isNaN(id)) return null;

    const query = `
      SELECT 
        p.product_id, p.sku, p.title, p.brand, p.department, p.category, p.subcategory,
        p.gender, p.short_description, p.description, p.mrp::numeric(10,2) as mrp,
        p.selling_price::numeric(10,2) as selling_price,
        p.discount_percentage::numeric(5,2) as discount_percentage,
        p.currency, p.stock_quantity, p.is_available,
        COUNT(v.variant_id)::int as variants_count
      FROM shopi_products p
      LEFT JOIN shopi_product_variants v ON p.product_id = v.product_id
      WHERE p.product_id = $1
      GROUP BY p.product_id;
    `;
    const res = await client.query(query, [id]);
    if (res.rows.length === 0) return null;

    const r = res.rows[0];
    return {
      product_id: r.product_id,
      sku: r.sku,
      title: r.title,
      brand: r.brand,
      department: r.department,
      category: r.category,
      subcategory: r.subcategory,
      gender: r.gender,
      short_description: r.short_description,
      description: r.description,
      mrp: parseFloat(r.mrp),
      selling_price: parseFloat(r.selling_price),
      discount_percentage: parseFloat(r.discount_percentage),
      currency: r.currency,
      stock_quantity: r.stock_quantity,
      is_available: r.is_available,
      product_type: (r.variants_count === 0 || this.SIMPLE_PRODUCT_IDS.has(r.product_id)) ? 'SIMPLE_PRODUCT' : 'HAS_VARIANTS',
      variants_count: r.variants_count
    };
  }

  /**
   * Retrieves single product by SKU.
   */
  static async getProductBySku(sku: string): Promise<CanonicalProduct | null> {
    const query = `
      SELECT 
        p.product_id, p.sku, p.title, p.brand, p.department, p.category, p.subcategory,
        p.gender, p.short_description, p.description, p.mrp::numeric(10,2) as mrp,
        p.selling_price::numeric(10,2) as selling_price,
        p.discount_percentage::numeric(5,2) as discount_percentage,
        p.currency, p.stock_quantity, p.is_available,
        COUNT(v.variant_id)::int as variants_count
      FROM shopi_products p
      LEFT JOIN shopi_product_variants v ON p.product_id = v.product_id
      WHERE p.sku = $1
      GROUP BY p.product_id;
    `;
    const res = await client.query(query, [sku.trim()]);
    if (res.rows.length === 0) return null;

    const r = res.rows[0];
    return {
      product_id: r.product_id,
      sku: r.sku,
      title: r.title,
      brand: r.brand,
      department: r.department,
      category: r.category,
      subcategory: r.subcategory,
      gender: r.gender,
      short_description: r.short_description,
      description: r.description,
      mrp: parseFloat(r.mrp),
      selling_price: parseFloat(r.selling_price),
      discount_percentage: parseFloat(r.discount_percentage),
      currency: r.currency,
      stock_quantity: r.stock_quantity,
      is_available: r.is_available,
      product_type: (r.variants_count === 0 || this.SIMPLE_PRODUCT_SKUS.has(r.sku)) ? 'SIMPLE_PRODUCT' : 'HAS_VARIANTS',
      variants_count: r.variants_count
    };
  }

  /**
   * Retrieves authentic variants for a product. Returns [] for simple products.
   */
  static async getProductVariants(productId: number): Promise<CanonicalVariant[]> {
    if (this.SIMPLE_PRODUCT_IDS.has(productId)) {
      return [];
    }

    const query = `
      SELECT variant_id, product_id, color, size, variant_sku, stock_quantity, is_available, additional_options
      FROM shopi_product_variants
      WHERE product_id = $1
      ORDER BY variant_id ASC;
    `;
    const res = await client.query(query, [productId]);
    return res.rows.map((r: any) => ({
      variant_id: r.variant_id,
      product_id: r.product_id,
      color: r.color,
      size: r.size,
      variant_sku: r.variant_sku,
      stock_quantity: r.stock_quantity,
      is_available: r.is_available,
      additional_options: r.additional_options || {}
    }));
  }

  /**
   * Retrieves stock overview and variant-level breakdown if available.
   */
  static async getProductInventory(productId: number): Promise<ProductInventorySummary | null> {
    const prod = await this.getProduct(productId);
    if (!prod) return null;

    const variants = await this.getProductVariants(productId);

    return {
      product_id: prod.product_id,
      sku: prod.sku,
      title: prod.title,
      product_type: prod.product_type,
      total_stock: prod.stock_quantity,
      is_in_stock: prod.stock_quantity > 0 && prod.is_available,
      variants: variants.map(v => ({
        variant_id: v.variant_id,
        color: v.color,
        size: v.size,
        variant_sku: v.variant_sku,
        stock: v.stock_quantity,
        is_available: v.is_available
      }))
    };
  }

  // ============================================================================
  // ORDERS & SALES DOMAIN
  // ============================================================================

  /**
   * Retrieves order transactions.
   */
  static async getOrders(limit: number = 50, offset: number = 0): Promise<CanonicalOrder[]> {
    const query = `
      SELECT 
        o.order_id, o.order_number, o.customer_id, o.order_status, o.payment_status,
        o.payment_method, o.currency, o.subtotal_amount::numeric(12,2),
        o.discount_amount::numeric(12,2), o.shipping_amount::numeric(12,2),
        o.tax_amount::numeric(12,2), o.total_amount::numeric(12,2),
        o.coupon_code, o.campaign_id, o.order_placed_at,
        c.first_name || ' ' || c.last_name as customer_name,
        c.email as customer_email,
        COUNT(oi.order_item_id)::int as items_count
      FROM shopi_orders o
      JOIN shopi_customers c ON o.customer_id = c.customer_id
      LEFT JOIN shopi_order_items oi ON o.order_id = oi.order_id
      GROUP BY o.order_id, c.customer_id
      ORDER BY o.order_placed_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const res = await client.query(query, [limit, offset]);
    return res.rows.map((r: any) => ({
      order_id: r.order_id,
      order_number: r.order_number,
      customer_id: r.customer_id,
      customer_name: r.customer_name,
      customer_email: r.customer_email,
      order_status: r.order_status,
      payment_status: r.payment_status,
      payment_method: r.payment_method,
      currency: r.currency,
      subtotal_amount: parseFloat(r.subtotal_amount),
      discount_amount: parseFloat(r.discount_amount),
      shipping_amount: parseFloat(r.shipping_amount),
      tax_amount: parseFloat(r.tax_amount),
      total_amount: parseFloat(r.total_amount),
      coupon_code: r.coupon_code,
      campaign_id: r.campaign_id,
      order_placed_at: r.order_placed_at,
      items_count: r.items_count
    }));
  }

  /**
   * Retrieves single order by ID.
   */
  static async getOrder(orderId: string): Promise<CanonicalOrder | null> {
    const query = `
      SELECT 
        o.order_id, o.order_number, o.customer_id, o.order_status, o.payment_status,
        o.payment_method, o.currency, o.subtotal_amount::numeric(12,2),
        o.discount_amount::numeric(12,2), o.shipping_amount::numeric(12,2),
        o.tax_amount::numeric(12,2), o.total_amount::numeric(12,2),
        o.coupon_code, o.campaign_id, o.order_placed_at,
        c.first_name || ' ' || c.last_name as customer_name,
        c.email as customer_email
      FROM shopi_orders o
      JOIN shopi_customers c ON o.customer_id = c.customer_id
      WHERE o.order_id = $1;
    `;
    const res = await client.query(query, [orderId]);
    if (res.rows.length === 0) return null;

    const r = res.rows[0];
    return {
      order_id: r.order_id,
      order_number: r.order_number,
      customer_id: r.customer_id,
      customer_name: r.customer_name,
      customer_email: r.customer_email,
      order_status: r.order_status,
      payment_status: r.payment_status,
      payment_method: r.payment_method,
      currency: r.currency,
      subtotal_amount: parseFloat(r.subtotal_amount),
      discount_amount: parseFloat(r.discount_amount),
      shipping_amount: parseFloat(r.shipping_amount),
      tax_amount: parseFloat(r.tax_amount),
      total_amount: parseFloat(r.total_amount),
      coupon_code: r.coupon_code,
      campaign_id: r.campaign_id,
      order_placed_at: r.order_placed_at
    };
  }

  /**
   * Retrieves line items for an order.
   */
  static async getOrderItems(orderId: string): Promise<CanonicalOrderItem[]> {
    const query = `
      SELECT 
        order_item_id, order_id, product_id, variant_id, sku, variant_sku,
        product_title, selected_color, selected_size,
        unit_price::numeric(10,2), quantity, discount_amount::numeric(10,2),
        line_total::numeric(12,2), unit_cogs::numeric(10,2),
        contribution_margin::numeric(10,2)
      FROM shopi_order_items
      WHERE order_id = $1
      ORDER BY order_item_id ASC;
    `;
    const res = await client.query(query, [orderId]);
    return res.rows.map((r: any) => ({
      order_item_id: r.order_item_id,
      order_id: r.order_id,
      product_id: r.product_id,
      variant_id: r.variant_id,
      sku: r.sku,
      variant_sku: r.variant_sku,
      product_title: r.product_title,
      selected_color: r.selected_color,
      selected_size: r.selected_size,
      unit_price: parseFloat(r.unit_price),
      quantity: r.quantity,
      discount_amount: parseFloat(r.discount_amount),
      line_total: parseFloat(r.line_total),
      unit_cogs: parseFloat(r.unit_cogs),
      contribution_margin: parseFloat(r.contribution_margin)
    }));
  }

  /**
   * Retrieves aggregate sales metrics for a product.
   */
  static async getProductSales(productId: number): Promise<{ product_id: number; units_sold: number; gross_revenue: number; orders_count: number; total_margin: number }> {
    const query = `
      SELECT 
        product_id,
        COALESCE(SUM(quantity), 0)::int as units_sold,
        COALESCE(SUM(line_total), 0)::numeric(12,2) as gross_revenue,
        COUNT(DISTINCT order_id)::int as orders_count,
        COALESCE(SUM(contribution_margin), 0)::numeric(12,2) as total_margin
      FROM shopi_order_items
      WHERE product_id = $1
      GROUP BY product_id;
    `;
    const res = await client.query(query, [productId]);
    if (res.rows.length === 0) {
      return { product_id: productId, units_sold: 0, gross_revenue: 0, orders_count: 0, total_margin: 0 };
    }
    const r = res.rows[0];
    return {
      product_id: r.product_id,
      units_sold: r.units_sold,
      gross_revenue: parseFloat(r.gross_revenue),
      orders_count: r.orders_count,
      total_margin: parseFloat(r.total_margin)
    };
  }

  /**
   * Retrieves daily sales breakdown.
   */
  static async getDailySales(days: number = 30): Promise<Array<{ date: string; orders: number; revenue: number; aov: number }>> {
    const query = `
      SELECT 
        DATE(order_placed_at) as sales_date,
        COUNT(order_id)::int as orders_count,
        SUM(total_amount)::numeric(12,2) as total_revenue,
        AVG(total_amount)::numeric(12,2) as aov
      FROM shopi_orders
      WHERE order_placed_at >= NOW() - ($1 || ' days')::interval
      GROUP BY DATE(order_placed_at)
      ORDER BY sales_date ASC;
    `;
    const res = await client.query(query, [days]);
    return res.rows.map((r: any) => ({
      date: r.sales_date,
      orders: r.orders_count,
      revenue: parseFloat(r.total_revenue),
      aov: parseFloat(r.aov)
    }));
  }

  // ============================================================================
  // CUSTOMERS DOMAIN
  // ============================================================================

  /**
   * Retrieves customers list with spend summary.
   */
  static async getCustomers(limit: number = 50): Promise<CanonicalCustomer[]> {
    const query = `
      SELECT 
        c.customer_id, c.merchant_id, c.email, c.phone, c.first_name, c.last_name,
        c.city, c.state, c.pincode, c.country, c.created_at,
        COUNT(o.order_id)::int as total_orders,
        COALESCE(SUM(o.total_amount), 0)::numeric(12,2) as total_spend
      FROM shopi_customers c
      LEFT JOIN shopi_orders o ON c.customer_id = o.customer_id
      GROUP BY c.customer_id
      ORDER BY total_spend DESC
      LIMIT $1;
    `;
    const res = await client.query(query, [limit]);
    return res.rows.map((r: any) => ({
      customer_id: r.customer_id,
      merchant_id: r.merchant_id,
      email: r.email,
      phone: r.phone,
      first_name: r.first_name,
      last_name: r.last_name,
      city: r.city,
      state: r.state,
      pincode: r.pincode,
      country: r.country,
      created_at: r.created_at,
      total_orders: r.total_orders,
      total_spend: parseFloat(r.total_spend)
    }));
  }

  /**
   * Retrieves single customer by customer_id.
   */
  static async getCustomer(customerId: string): Promise<CanonicalCustomer | null> {
    const query = `
      SELECT 
        c.customer_id, c.merchant_id, c.email, c.phone, c.first_name, c.last_name,
        c.city, c.state, c.pincode, c.country, c.created_at,
        COUNT(o.order_id)::int as total_orders,
        COALESCE(SUM(o.total_amount), 0)::numeric(12,2) as total_spend
      FROM shopi_customers c
      LEFT JOIN shopi_orders o ON c.customer_id = o.customer_id
      WHERE c.customer_id = $1
      GROUP BY c.customer_id;
    `;
    const res = await client.query(query, [customerId]);
    if (res.rows.length === 0) return null;

    const r = res.rows[0];
    return {
      customer_id: r.customer_id,
      merchant_id: r.merchant_id,
      email: r.email,
      phone: r.phone,
      first_name: r.first_name,
      last_name: r.last_name,
      city: r.city,
      state: r.state,
      pincode: r.pincode,
      country: r.country,
      created_at: r.created_at,
      total_orders: r.total_orders,
      total_spend: parseFloat(r.total_spend)
    };
  }

  /**
   * Retrieves orders for a specific customer.
   */
  static async getCustomerOrders(customerId: string): Promise<CanonicalOrder[]> {
    const query = `
      SELECT 
        order_id, order_number, customer_id, order_status, payment_status,
        payment_method, currency, subtotal_amount::numeric(12,2),
        discount_amount::numeric(12,2), shipping_amount::numeric(12,2),
        tax_amount::numeric(12,2), total_amount::numeric(12,2),
        coupon_code, campaign_id, order_placed_at
      FROM shopi_orders
      WHERE customer_id = $1
      ORDER BY order_placed_at DESC;
    `;
    const res = await client.query(query, [customerId]);
    return res.rows.map((r: any) => ({
      order_id: r.order_id,
      order_number: r.order_number,
      customer_id: r.customer_id,
      order_status: r.order_status,
      payment_status: r.payment_status,
      payment_method: r.payment_method,
      currency: r.currency,
      subtotal_amount: parseFloat(r.subtotal_amount),
      discount_amount: parseFloat(r.discount_amount),
      shipping_amount: parseFloat(r.shipping_amount),
      tax_amount: parseFloat(r.tax_amount),
      total_amount: parseFloat(r.total_amount),
      coupon_code: r.coupon_code,
      campaign_id: r.campaign_id,
      order_placed_at: r.order_placed_at
    }));
  }

  /**
   * Calculates Customer Lifetime Value (LTV) and purchasing cadence.
   */
  static async getCustomerLifetimeValue(customerId: string): Promise<{ customer_id: string; total_orders: number; total_spend: number; aov: number; first_purchase: string | null; last_purchase: string | null; lifespan_days: number }> {
    const query = `
      SELECT 
        customer_id,
        COUNT(order_id)::int as total_orders,
        COALESCE(SUM(total_amount), 0)::numeric(12,2) as total_spend,
        COALESCE(AVG(total_amount), 0)::numeric(12,2) as aov,
        MIN(order_placed_at) as first_purchase,
        MAX(order_placed_at) as last_purchase
      FROM shopi_orders
      WHERE customer_id = $1
      GROUP BY customer_id;
    `;
    const res = await client.query(query, [customerId]);
    if (res.rows.length === 0) {
      return { customer_id: customerId, total_orders: 0, total_spend: 0, aov: 0, first_purchase: null, last_purchase: null, lifespan_days: 0 };
    }
    const r = res.rows[0];
    const first = r.first_purchase ? new Date(r.first_purchase).getTime() : Date.now();
    const last = r.last_purchase ? new Date(r.last_purchase).getTime() : Date.now();
    const lifespan = Math.max(1, Math.round((last - first) / 86400000));

    return {
      customer_id: r.customer_id,
      total_orders: r.total_orders,
      total_spend: parseFloat(r.total_spend),
      aov: parseFloat(r.aov),
      first_purchase: r.first_purchase,
      last_purchase: r.last_purchase,
      lifespan_days: lifespan
    };
  }

  // ============================================================================
  // EVENTS & BEHAVIORAL INTELLIGENCE DOMAIN
  // ============================================================================

  /**
   * Retrieves events for a specific customer.
   */
  static async getCustomerEvents(customerId: string): Promise<any[]> {
    const query = `
      SELECT event_id, customer_id, session_id, event_type, product_id, variant_id, sku, variant_sku, search_query, cart_quantity, cart_value, event_timestamp
      FROM shopi_customer_events
      WHERE customer_id = $1
      ORDER BY event_timestamp DESC;
    `;
    const res = await client.query(query, [customerId]);
    return res.rows;
  }

  /**
   * Retrieves events for a specific product.
   */
  static async getProductEvents(productId: number): Promise<any[]> {
    const query = `
      SELECT event_id, customer_id, session_id, event_type, product_id, variant_id, sku, variant_sku, event_timestamp
      FROM shopi_customer_events
      WHERE product_id = $1
      ORDER BY event_timestamp DESC;
    `;
    const res = await client.query(query, [productId]);
    return res.rows;
  }

  /**
   * Retrieves high-intent customers (3+ view/cart events with strong activity).
   */
  static async getHighIntentCustomers(): Promise<Array<{ customer_id: string; email: string; first_name: string; intent_signals: number; last_active: string }>> {
    const query = `
      SELECT 
        e.customer_id, c.email, c.first_name,
        COUNT(e.event_id)::int as intent_signals,
        MAX(e.event_timestamp) as last_active
      FROM shopi_customer_events e
      JOIN shopi_customers c ON e.customer_id = c.customer_id
      WHERE e.event_type IN ('PRODUCT_VIEW', 'ADD_TO_CART', 'CHECKOUT_STARTED')
      GROUP BY e.customer_id, c.email, c.first_name
      HAVING COUNT(e.event_id) >= 3
      ORDER BY intent_signals DESC;
    `;
    const res = await client.query(query);
    return res.rows;
  }

  /**
   * Retrieves cart abandoners (Added to cart but have not placed an order).
   */
  static async getCartAbandoners(): Promise<Array<{ customer_id: string; email: string; first_name: string; product_id: number; sku: string; cart_value: number; event_timestamp: string }>> {
    const query = `
      SELECT 
        e.customer_id, c.email, c.first_name, e.product_id, e.sku,
        COALESCE(e.cart_value, 0)::numeric(10,2) as cart_value,
        MAX(e.event_timestamp) as event_timestamp
      FROM shopi_customer_events e
      JOIN shopi_customers c ON e.customer_id = c.customer_id
      WHERE e.event_type = 'ADD_TO_CART'
        AND e.customer_id NOT IN (
          SELECT DISTINCT customer_id FROM shopi_orders
        )
      GROUP BY e.customer_id, c.email, c.first_name, e.product_id, e.sku, e.cart_value
      ORDER BY event_timestamp DESC;
    `;
    const res = await client.query(query);
    return res.rows.map((r: any) => ({
      customer_id: r.customer_id,
      email: r.email,
      first_name: r.first_name,
      product_id: r.product_id,
      sku: r.sku,
      cart_value: parseFloat(r.cart_value),
      event_timestamp: r.event_timestamp
    }));
  }

  /**
   * Retrieves checkout abandoners (Started checkout but did not complete order).
   */
  static async getCheckoutAbandoners(): Promise<Array<{ customer_id: string; email: string; first_name: string; session_id: string; cart_value: number; checkout_started_at: string }>> {
    const query = `
      SELECT 
        e.customer_id, c.email, c.first_name, e.session_id,
        COALESCE(e.cart_value, 0)::numeric(10,2) as cart_value,
        MAX(e.event_timestamp) as checkout_started_at
      FROM shopi_customer_events e
      JOIN shopi_customers c ON e.customer_id = c.customer_id
      WHERE e.event_type = 'CHECKOUT_STARTED'
        AND e.customer_id NOT IN (
          SELECT DISTINCT customer_id FROM shopi_orders
        )
      GROUP BY e.customer_id, c.email, c.first_name, e.session_id, e.cart_value
      ORDER BY checkout_started_at DESC;
    `;
    const res = await client.query(query);
    return res.rows.map((r: any) => ({
      customer_id: r.customer_id,
      email: r.email,
      first_name: r.first_name,
      session_id: r.session_id,
      cart_value: parseFloat(r.cart_value),
      checkout_started_at: r.checkout_started_at
    }));
  }

  /**
   * Retrieves dormant customers (Last order > 60 days ago).
   */
  static async getDormantCustomers(daysThreshold: number = 60): Promise<Array<{ customer_id: string; email: string; first_name: string; total_orders: number; total_spend: number; last_order_date: string; days_dormant: number }>> {
    const query = `
      SELECT 
        o.customer_id, c.email, c.first_name,
        COUNT(o.order_id)::int as total_orders,
        SUM(o.total_amount)::numeric(12,2) as total_spend,
        MAX(o.order_placed_at) as last_order_date,
        EXTRACT(DAY FROM (NOW() - MAX(o.order_placed_at)))::int as days_dormant
      FROM shopi_orders o
      JOIN shopi_customers c ON o.customer_id = c.customer_id
      GROUP BY o.customer_id, c.email, c.first_name
      HAVING MAX(o.order_placed_at) < (NOW() - ($1 || ' days')::interval)
      ORDER BY days_dormant DESC;
    `;
    const res = await client.query(query, [daysThreshold]);
    return res.rows.map((r: any) => ({
      customer_id: r.customer_id,
      email: r.email,
      first_name: r.first_name,
      total_orders: r.total_orders,
      total_spend: parseFloat(r.total_spend),
      last_order_date: r.last_order_date,
      days_dormant: r.days_dormant
    }));
  }

  // ============================================================================
  // PROFITABILITY & UNIT ECONOMICS DOMAIN
  // ============================================================================

  /**
   * Retrieves unit cost breakdown for a product.
   */
  static async getProductCogs(productId: number): Promise<ProductCogsRecord | null> {
    const query = `
      SELECT 
        cogs_id, product_id, sku,
        unit_manufacturing_cost::numeric(10,2),
        unit_packaging_cost::numeric(10,2),
        unit_shipping_cost::numeric(10,2),
        unit_payment_processing_fee::numeric(10,2),
        total_unit_cost::numeric(10,2),
        reference_selling_price::numeric(10,2),
        baseline_gross_margin::numeric(10,2),
        baseline_gross_margin_pct::numeric(5,2),
        minimum_margin_floor_pct::numeric(5,2),
        maximum_safe_discount_amount::numeric(10,2),
        maximum_safe_discount_pct::numeric(5,2),
        is_synthetic
      FROM shopi_product_cogs
      WHERE product_id = $1;
    `;
    const res = await client.query(query, [productId]);
    if (res.rows.length === 0) return null;

    const r = res.rows[0];
    return {
      cogs_id: r.cogs_id,
      product_id: r.product_id,
      sku: r.sku,
      unit_manufacturing_cost: parseFloat(r.unit_manufacturing_cost),
      unit_packaging_cost: parseFloat(r.unit_packaging_cost),
      unit_shipping_cost: parseFloat(r.unit_shipping_cost),
      unit_payment_processing_fee: parseFloat(r.unit_payment_processing_fee),
      total_unit_cost: parseFloat(r.total_unit_cost),
      reference_selling_price: parseFloat(r.reference_selling_price),
      baseline_gross_margin: parseFloat(r.baseline_gross_margin),
      baseline_gross_margin_pct: parseFloat(r.baseline_gross_margin_pct),
      minimum_margin_floor_pct: parseFloat(r.minimum_margin_floor_pct),
      maximum_safe_discount_amount: parseFloat(r.maximum_safe_discount_amount),
      maximum_safe_discount_pct: parseFloat(r.maximum_safe_discount_pct),
      is_synthetic: r.is_synthetic
    };
  }

  /**
   * Retrieves consolidated product economics.
   */
  static async getProductEconomics(productId: number): Promise<{ product_id: number; sku: string; selling_price: number; total_cogs: number; gross_margin: number; gross_margin_pct: number; max_safe_discount: number; min_floor_pct: number } | null> {
    const prod = await this.getProduct(productId);
    const cogs = await this.getProductCogs(productId);
    if (!prod || !cogs) return null;

    return {
      product_id: prod.product_id,
      sku: prod.sku,
      selling_price: prod.selling_price,
      total_cogs: cogs.total_unit_cost,
      gross_margin: prod.selling_price - cogs.total_unit_cost,
      gross_margin_pct: parseFloat((((prod.selling_price - cogs.total_unit_cost) / prod.selling_price) * 100).toFixed(2)),
      max_safe_discount: cogs.maximum_safe_discount_amount,
      min_floor_pct: cogs.minimum_margin_floor_pct
    };
  }

  /**
   * Calculates contribution margin and evaluates discount safety against the 15% floor.
   */
  static async calculateContributionMargin(productId: number, sellingPrice: number, discountAmount: number): Promise<{ is_safe: boolean; net_price: number; total_cogs: number; contribution_margin: number; contribution_margin_pct: number; minimum_margin_floor_pct: number; rejection_reason?: string }> {
    const cogs = await this.getProductCogs(productId);
    const totalCogs = cogs ? cogs.total_unit_cost : Math.round(sellingPrice * 0.50);
    const minFloorPct = cogs ? cogs.minimum_margin_floor_pct : 15.00;

    const netPrice = Math.max(0, sellingPrice - discountAmount);
    const contributionMargin = netPrice - totalCogs;
    const contributionMarginPct = parseFloat(((contributionMargin / sellingPrice) * 100).toFixed(2));
    const isSafe = contributionMarginPct >= minFloorPct;

    return {
      is_safe: isSafe,
      net_price: netPrice,
      total_cogs: totalCogs,
      contribution_margin: contributionMargin,
      contribution_margin_pct: contributionMarginPct,
      minimum_margin_floor_pct: minFloorPct,
      rejection_reason: isSafe ? undefined : `Discount of ₹${discountAmount} leaves contribution margin at ${contributionMarginPct}%, which violates the ${minFloorPct}% profit floor.`
    };
  }

  // ============================================================================
  // CAMPAIGNS DOMAIN
  // ============================================================================

  /**
   * Retrieves active marketing campaigns.
   */
  static async getCampaigns(): Promise<any[]> {
    const query = `
      SELECT campaign_id, campaign_name, campaign_type, target_segment, status, channel, discount_type, discount_value, coupon_code, audience_size, sent_count, converted_orders_count, attributed_revenue::numeric(12,2)
      FROM shopi_campaigns
      ORDER BY created_at DESC;
    `;
    const res = await client.query(query);
    return res.rows;
  }

  /**
   * Retrieves campaign attribution records.
   */
  static async getCampaignAttributions(campaignId?: string): Promise<any[]> {
    let query = `
      SELECT 
        a.attribution_id, a.campaign_id, c.campaign_name, a.customer_id, a.order_id,
        a.coupon_code, a.attribution_model,
        a.attributed_revenue::numeric(12,2) as attributed_revenue,
        a.attributed_cogs::numeric(12,2) as attributed_cogs,
        a.attributed_gross_profit::numeric(12,2) as attributed_gross_profit,
        a.conversion_timestamp
      FROM shopi_campaign_attributions a
      JOIN shopi_campaigns c ON a.campaign_id = c.campaign_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (campaignId) {
      params.push(campaignId);
      query += ` AND a.campaign_id = $1`;
    }
    query += ` ORDER BY a.conversion_timestamp DESC;`;

    const res = await client.query(query, params);
    return res.rows;
  }

  /**
   * Retrieves coupon usage and redemptions.
   */
  static async getCouponUsage(couponCode?: string): Promise<any[]> {
    let query = `
      SELECT coupon_id, coupon_code, campaign_id, discount_type, discount_value::numeric(10,2), minimum_order_value::numeric(10,2), max_redemptions, current_redemptions, is_active
      FROM shopi_coupons
      WHERE 1=1
    `;
    const params: any[] = [];
    if (couponCode) {
      params.push(couponCode);
      query += ` AND coupon_code = $1`;
    }
    query += ` ORDER BY created_at DESC;`;

    const res = await client.query(query, params);
    return res.rows;
  }

  // ============================================================================
  // INVENTORY DOMAIN
  // ============================================================================

  /**
   * Retrieves inventory movements ledger.
   */
  static async getInventoryMovements(productId?: number): Promise<any[]> {
    let query = `
      SELECT movement_id, product_id, variant_id, sku, variant_sku, movement_type, quantity_delta, previous_stock, new_stock, reference_order_id, notes, created_at
      FROM shopi_inventory_movements
      WHERE 1=1
    `;
    const params: any[] = [];
    if (productId) {
      params.push(productId);
      query += ` AND product_id = $1`;
    }
    query += ` ORDER BY created_at DESC LIMIT 100;`;

    const res = await client.query(query, params);
    return res.rows;
  }

  /**
   * Calculates stock runway (days of inventory coverage) based on recent sales velocity.
   * Enforces safe zero/near-zero velocity policy (returns NOT_MEASURABLE rather than absurd numbers).
   */
  static async getStockRunway(productId: number): Promise<{
    product_id: number;
    sku: string;
    title: string;
    current_stock: number;
    daily_sales_velocity: number;
    days_of_coverage: number | null;
    runway_status: 'MEASURABLE' | 'NOT_MEASURABLE';
    stockout_risk: 'CRITICAL' | 'WARNING' | 'HEALTHY';
    explanation: string;
  }> {
    const prod = await this.getProduct(productId);
    if (!prod) {
      throw new Error(`Product ID ${productId} not found`);
    }

    // Compute sales in past 30 days
    const salesRes = await client.query(`
      SELECT COALESCE(SUM(quantity), 0)::int as total_sold
      FROM shopi_order_items oi
      JOIN shopi_orders o ON oi.order_id = o.order_id
      WHERE oi.product_id = $1 AND o.order_placed_at >= NOW() - INTERVAL '30 days';
    `, [productId]);

    const totalSold = salesRes.rows[0].total_sold;
    const dailyVel = parseFloat((totalSold / 30).toFixed(2));
    const VELOCITY_EPSILON = 0.05; // Minimum ~1.5 units/month threshold

    let daysRemaining: number | null = null;
    let runwayStatus: 'MEASURABLE' | 'NOT_MEASURABLE' = 'MEASURABLE';
    let explanation = '';

    if (dailyVel <= VELOCITY_EPSILON) {
      daysRemaining = null;
      runwayStatus = 'NOT_MEASURABLE';
      explanation = 'No meaningful recent sales velocity exists (sales velocity is near zero). Finite runway cannot be fabricated.';
    } else {
      daysRemaining = Math.round(prod.stock_quantity / dailyVel);
      explanation = `Estimated coverage of ${daysRemaining} days based on recent velocity of ${dailyVel} units/day.`;
    }

    let risk: 'CRITICAL' | 'WARNING' | 'HEALTHY' = 'HEALTHY';
    if (daysRemaining !== null && daysRemaining <= 7) risk = 'CRITICAL';
    else if (daysRemaining !== null && daysRemaining <= 21) risk = 'WARNING';

    return {
      product_id: prod.product_id,
      sku: prod.sku,
      title: prod.title,
      current_stock: prod.stock_quantity,
      daily_sales_velocity: dailyVel,
      days_of_coverage: daysRemaining,
      runway_status: runwayStatus,
      stockout_risk: risk,
      explanation
    };
  }
}

export default MerchantSupabaseService;
