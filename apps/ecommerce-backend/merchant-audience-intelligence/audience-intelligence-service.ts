import { client } from '../data/DB';

/**
 * Audience Intelligence Service.
 *
 * Answers "how many such people are there" for the classic e-commerce
 * opportunity segments, directly from the canonical event ledger
 * (shopi_customer_events + shopi_orders):
 *
 *   1. Cart abandoners  — added to cart, never purchased
 *   2. Checkout abandoners — started checkout, never purchased
 *   3. Repeat viewers   — viewed products repeatedly (2+ views), never
 *                          added to cart and never purchased
 *
 * OBSERVED data only — counts come straight from SQL, never estimated.
 */

export interface AudienceCustomer {
  customerId: string;
  customerName: string;
  email: string | null;
  phone: string | null;
  /** Total views/carts/checkouts this customer generated in the segment window. */
  eventCount: number;
  lastActivityAt: string;
  /** Most-viewed / most-carted product title. */
  topProductTitle: string | null;
  topProductPrice: number | null;
}

export interface AudienceSegmentSummary {
  segment: 'CART_ABANDONERS' | 'CHECKOUT_ABANDONERS' | 'REPEAT_VIEWERS';
  label: string;
  description: string;
  count: number;
  /** Distinct products involved in this segment. */
  productCount: number;
  customers: AudienceCustomer[];
}

export interface AudienceIntelligenceSummary {
  cartAbandoners: { count: number; productCount: number };
  checkoutAbandoners: { count: number; productCount: number };
  repeatViewers: { count: number; productCount: number };
  totalTrackedCustomers: number;
  generatedAt: string;
}

export class AudienceIntelligenceService {
  /**
   * Customers who added to cart but never purchased (any product).
   * "Added to cart but didn't purchase it."
   */
  async getCartAbandoners(merchantId: string = 'default_merchant', limit = 50): Promise<AudienceSegmentSummary> {
    const res = await client.query(`
      WITH cart_customers AS (
        SELECT DISTINCT e.customer_id
        FROM shopi_customer_events e
        WHERE e.event_type = 'ADD_TO_CART'
          AND e.merchant_id = $1
          AND e.customer_id NOT IN (SELECT DISTINCT customer_id FROM shopi_orders)
      )
      SELECT
        c.customer_id,
        TRIM(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')) AS customer_name,
        c.email, c.phone,
        ev.event_count, ev.last_activity, ev.top_product_id
      FROM cart_customers cc
      JOIN shopi_customers c ON c.customer_id = cc.customer_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS event_count,
          MAX(e.event_timestamp) AS last_activity,
          (SELECT e2.product_id FROM shopi_customer_events e2
            WHERE e2.customer_id = cc.customer_id AND e2.event_type = 'ADD_TO_CART'
            GROUP BY e2.product_id ORDER BY COUNT(*) DESC LIMIT 1) AS top_product_id
        FROM shopi_customer_events e
        WHERE e.customer_id = cc.customer_id AND e.event_type = 'ADD_TO_CART'
      ) ev ON TRUE
      ORDER BY ev.last_activity DESC NULLS LAST
      LIMIT $2;
    `, [merchantId, limit]);

    const customers = await this.attachProductTitles(res.rows, 'top_product_id');

    return {
      segment: 'CART_ABANDONERS',
      label: 'Cart Abandoners',
      description: 'Customers who added products to cart but never completed a purchase.',
      count: customers.length,
      productCount: new Set(customers.map(c => c.topProductTitle).filter(Boolean)).size,
      customers
    };
  }

  /**
   * Customers who started checkout but never purchased.
   */
  async getCheckoutAbandoners(merchantId: string = 'default_merchant', limit = 50): Promise<AudienceSegmentSummary> {
    const res = await client.query(`
      WITH chk_customers AS (
        SELECT DISTINCT e.customer_id
        FROM shopi_customer_events e
        WHERE e.event_type = 'CHECKOUT_STARTED'
          AND e.merchant_id = $1
          AND e.customer_id NOT IN (SELECT DISTINCT customer_id FROM shopi_orders)
      )
      SELECT
        c.customer_id,
        TRIM(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')) AS customer_name,
        c.email, c.phone,
        ev.event_count, ev.last_activity, ev.top_product_id
      FROM chk_customers cc
      JOIN shopi_customers c ON c.customer_id = cc.customer_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS event_count,
          MAX(e.event_timestamp) AS last_activity,
          (SELECT e2.product_id FROM shopi_customer_events e2
            WHERE e2.customer_id = cc.customer_id AND e2.event_type = 'CHECKOUT_STARTED'
            GROUP BY e2.product_id ORDER BY COUNT(*) DESC LIMIT 1) AS top_product_id
        FROM shopi_customer_events e
        WHERE e.customer_id = cc.customer_id AND e.event_type = 'CHECKOUT_STARTED'
      ) ev ON TRUE
      ORDER BY ev.last_activity DESC NULLS LAST
      LIMIT $2;
    `, [merchantId, limit]);

    const customers = await this.attachProductTitles(res.rows, 'top_product_id');

    return {
      segment: 'CHECKOUT_ABANDONERS',
      label: 'Checkout Abandoners',
      description: 'Customers who started checkout but never completed the order.',
      count: customers.length,
      productCount: new Set(customers.map(c => c.topProductTitle).filter(Boolean)).size,
      customers
    };
  }

  /**
   * Customers who viewed products repeatedly (2+ views) but never added to
   * cart and never purchased. "Viewed again and again but didn't add to
   * cart and didn't purchase."
   */
  async getRepeatViewers(merchantId: string = 'default_merchant', minViews = 2, limit = 50): Promise<AudienceSegmentSummary> {
    const res = await client.query(`
      WITH view_customers AS (
        SELECT v.customer_id
        FROM shopi_customer_events v
        WHERE v.event_type = 'PRODUCT_VIEW' AND v.merchant_id = $1
          AND v.customer_id NOT IN (SELECT DISTINCT customer_id FROM shopi_customer_events WHERE event_type = 'ADD_TO_CART')
          AND v.customer_id NOT IN (SELECT DISTINCT customer_id FROM shopi_orders)
        GROUP BY v.customer_id
        HAVING COUNT(*) >= $2::int
      )
      SELECT
        c.customer_id,
        TRIM(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')) AS customer_name,
        c.email, c.phone,
        ev.event_count, ev.last_activity, ev.top_product_id
      FROM view_customers vc
      JOIN shopi_customers c ON c.customer_id = vc.customer_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS event_count,
          MAX(v.event_timestamp) AS last_activity,
          (SELECT v2.product_id FROM shopi_customer_events v2
            WHERE v2.customer_id = vc.customer_id AND v2.event_type = 'PRODUCT_VIEW'
            GROUP BY v2.product_id ORDER BY COUNT(*) DESC LIMIT 1) AS top_product_id
        FROM shopi_customer_events v
        WHERE v.customer_id = vc.customer_id AND v.event_type = 'PRODUCT_VIEW'
      ) ev ON TRUE
      ORDER BY ev.event_count DESC, ev.last_activity DESC NULLS LAST
      LIMIT $3;
    `, [merchantId, minViews, limit]);

    const customers = await this.attachProductTitles(res.rows, 'top_product_id');

    return {
      segment: 'REPEAT_VIEWERS',
      label: 'Repeat Viewers (No Cart, No Purchase)',
      description: `Customers who viewed products ${minViews}+ times but never added to cart and never purchased.`,
      count: customers.length,
      productCount: new Set(customers.map(c => c.topProductTitle).filter(Boolean)).size,
      customers
    };
  }

  /** Compact summary for dashboards and copilot briefings. */
  async getSummary(merchantId: string = 'default_merchant'): Promise<AudienceIntelligenceSummary> {
    // Counts are computed WITHOUT a customer-list limit; the limit only
    // bounds how many detail rows are returned elsewhere.
    const [cart, checkout, viewers, total] = await Promise.all([
      this.countSegment('ADD_TO_CART', merchantId),
      this.countSegment('CHECKOUT_STARTED', merchantId),
      this.countRepeatViewers(merchantId),
      client.query(`SELECT COUNT(DISTINCT customer_id)::int AS n FROM shopi_customer_events WHERE merchant_id = $1`, [merchantId])
    ]);
    return {
      cartAbandoners: { count: cart.count, productCount: cart.productCount },
      checkoutAbandoners: { count: checkout.count, productCount: checkout.productCount },
      repeatViewers: { count: viewers.count, productCount: viewers.productCount },
      totalTrackedCustomers: total.rows[0]?.n || 0,
      generatedAt: new Date().toISOString()
    };
  }

  /** Count-only queries for large segments (no customer list). */
  private async countSegment(eventType: 'ADD_TO_CART' | 'CHECKOUT_STARTED', merchantId: string): Promise<{ count: number; productCount: number }> {
    const res = await client.query(`
      SELECT
        COUNT(DISTINCT e.customer_id)::int AS count,
        COUNT(DISTINCT e.product_id)::int AS product_count
      FROM shopi_customer_events e
      WHERE e.event_type = $1 AND e.merchant_id = $2
        AND e.customer_id NOT IN (SELECT DISTINCT customer_id FROM shopi_orders);
    `, [eventType, merchantId]);
    return { count: res.rows[0]?.count || 0, productCount: res.rows[0]?.product_count || 0 };
  }

  private async countRepeatViewers(merchantId: string, minViews = 2): Promise<{ count: number; productCount: number }> {
    const res = await client.query(`
      SELECT COUNT(*)::int AS count FROM (
        SELECT v.customer_id
        FROM shopi_customer_events v
        WHERE v.event_type = 'PRODUCT_VIEW' AND v.merchant_id = $1
          AND v.customer_id NOT IN (SELECT DISTINCT customer_id FROM shopi_customer_events WHERE event_type = 'ADD_TO_CART')
          AND v.customer_id NOT IN (SELECT DISTINCT customer_id FROM shopi_orders)
        GROUP BY v.customer_id
        HAVING COUNT(*) >= $2::int
      ) t;
    `, [merchantId, minViews]);
    const prodRes = await client.query(`
      SELECT COUNT(DISTINCT v.product_id)::int AS product_count
      FROM shopi_customer_events v
      WHERE v.event_type = 'PRODUCT_VIEW' AND v.merchant_id = $1
        AND v.customer_id NOT IN (SELECT DISTINCT customer_id FROM shopi_customer_events WHERE event_type = 'ADD_TO_CART')
        AND v.customer_id NOT IN (SELECT DISTINCT customer_id FROM shopi_orders)
        AND v.customer_id IN (
          SELECT v2.customer_id
          FROM shopi_customer_events v2
          WHERE v2.event_type = 'PRODUCT_VIEW'
          GROUP BY v2.customer_id
          HAVING COUNT(*) >= $2::int
        );
    `, [merchantId, minViews]);
    return { count: res.rows[0]?.count || 0, productCount: prodRes.rows[0]?.product_count || 0 };
  }

  /** Enriches rows with product titles/prices from the canonical catalog. */
  private async attachProductTitles(rows: any[], productKey: string): Promise<AudienceCustomer[]> {
    const productIds = rows.map(r => r[productKey]).filter(Boolean);
    const titles = new Map<number, { title: string; price: number }>();
    if (productIds.length > 0) {
      const prodRes = await client.query(
        `SELECT product_id, title, selling_price FROM shopi_products WHERE product_id = ANY($1::int[])`,
        [productIds]
      );
      for (const p of prodRes.rows) {
        titles.set(p.product_id, { title: p.title, price: parseFloat(p.selling_price) });
      }
    }
    return rows.map(r => {
      const prod = r[productKey] ? titles.get(r[productKey]) : undefined;
      return {
        customerId: r.customer_id,
        customerName: r.customer_name && r.customer_name.trim() ? r.customer_name : r.customer_id,
        email: r.email || null,
        phone: r.phone || null,
        eventCount: r.event_count || 0,
        lastActivityAt: r.last_activity ? new Date(r.last_activity).toISOString() : new Date().toISOString(),
        topProductTitle: prod?.title || null,
        topProductPrice: prod?.price ?? null
      };
    });
  }
}

export const audienceIntelligenceService = new AudienceIntelligenceService();
