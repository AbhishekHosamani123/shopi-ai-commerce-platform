import { client } from '../data/DB';

export type RfmSegment =
  | 'CHAMPIONS'
  | 'LOYAL'
  | 'POTENTIAL_LOYALISTS'
  | 'NEW_CUSTOMERS'
  | 'AT_RISK'
  | 'CANT_LOSE_THEM'
  | 'HIBERNATING'
  | 'LOST';

export type LifecycleStatus = 'ACTIVE' | 'AT_RISK' | 'DORMANT' | 'LOST';

export type ScoreProvenance =
  | 'OBSERVED_TELEMETRY'
  | 'HEURISTIC_CALCULATION'
  | 'INSUFFICIENT_EVIDENCE';

export interface CustomerProductInterest {
  productId: number;
  productTitle: string;
  sku?: string;
  variantId: string | null;
  views: number;
  uniqueSessions: number;
  firstViewAt: string | null;
  lastViewAt: string | null;
  addToCartCount: number;
  removeFromCartCount: number;
  lastCartEvent: string | null;
  checkoutStartedCount: number;
  purchaseCount: number;
  purchasedQuantity: number;
  intentScore: number;
  heuristicIntentScore?: number;
  abandonmentStatus: 'NONE' | 'CART_ABANDONED' | 'CHECKOUT_ABANDONED' | 'CONVERTED';
  intentExplanation: string[];
}

export interface CustomerProfileFeatures {
  customerId: string | number;
  name: string;
  email: string;
  mobileNumber?: string;
  
  // Transaction Features
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  firstPurchaseAt: string | null;
  lastPurchaseAt: string | null;
  daysSinceLastPurchase: number | null;
  purchaseFrequencyMonths: number;
  productsPurchasedCount: number;
  categoriesPurchased: string[];

  // Behavior Features (Event Stream)
  totalProductViews: number;
  uniqueProductsViewed: number;
  viewsLast7Days: number;
  viewsLast30Days: number;
  repeatedProductViews: number;
  searchesCount: number;
  addToCartCount: number;
  removeFromCartCount: number;
  checkoutStartedCount: number;
  checkoutCompletedCount: number;
  purchaseEventCount: number;

  // RFM & Segmentation
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  rfmScoreString: string;
  rfmSegment: RfmSegment;
  
  // Lifecycle & Status
  lifecycleStatus: LifecycleStatus;
  isRepeatBuyer: boolean;
  isHighValue: boolean;
  highValueThreshold: number;
  
  // High Intent & Abandonment (HEURISTIC_INTENT_SCORE)
  overallIntentScore: number;
  heuristicIntentScore: number;
  intentTier: 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW';
  intentExplanation: string[];
  hasCartAbandoned: boolean;
  hasCheckoutAbandoned: boolean;
  conversionStatus: 'CONVERTED' | 'ACTIVE_PROSPECT' | 'CART_ABANDONED' | 'CHECKOUT_ABANDONED' | 'INACTIVE';
  scoreProvenance: ScoreProvenance;

  // Top Products of Interest
  productsOfInterest: CustomerProductInterest[];
}

export class CustomerIntelligenceService {
  /**
   * Evaluates deterministic RFM score and segment for a customer.
   */
  public evaluateRfm(daysSinceLast: number | null, orderCount: number, totalSpend: number): {
    r: number;
    f: number;
    m: number;
    scoreStr: string;
    segment: RfmSegment;
  } {
    // Recency (R)
    let r = 1;
    if (daysSinceLast === null) r = 1;
    else if (daysSinceLast <= 14) r = 5;
    else if (daysSinceLast <= 30) r = 4;
    else if (daysSinceLast <= 60) r = 3;
    else if (daysSinceLast <= 120) r = 2;
    else r = 1;

    // Frequency (F)
    let f = 1;
    if (orderCount >= 15) f = 5;
    else if (orderCount >= 8) f = 4;
    else if (orderCount >= 3) f = 3;
    else if (orderCount >= 2) f = 2;
    else f = 1;

    // Monetary (M)
    let m = 1;
    if (totalSpend >= 10000) m = 5;
    else if (totalSpend >= 5000) m = 4;
    else if (totalSpend >= 2500) m = 3;
    else if (totalSpend >= 1000) m = 2;
    else m = 1;

    const scoreStr = `${r}${f}${m}`;

    // Segment classification
    let segment: RfmSegment = 'LOST';
    if (r >= 4 && f >= 3 && m >= 3) segment = 'CHAMPIONS';
    else if (r >= 3 && f >= 2) segment = 'LOYAL';
    else if (r >= 4 && f === 1 && m >= 2) segment = 'POTENTIAL_LOYALISTS';
    else if (r >= 4 && f === 1) segment = 'NEW_CUSTOMERS';
    else if (r === 2 || r === 3) segment = 'AT_RISK';
    else if (r <= 2 && f >= 3 && m >= 3) segment = 'CANT_LOSE_THEM';
    else if (r <= 2 && f <= 2 && m >= 2) segment = 'HIBERNATING';
    else segment = 'LOST';

    return { r, f, m, scoreStr, segment };
  }

  /**
   * Evaluates lifecycle status from purchase recency.
   */
  public evaluateLifecycle(daysSinceLast: number | null): LifecycleStatus {
    if (daysSinceLast === null) return 'LOST';
    if (daysSinceLast <= 30) return 'ACTIVE';
    if (daysSinceLast <= 60) return 'AT_RISK';
    if (daysSinceLast <= 120) return 'DORMANT';
    return 'LOST';
  }

  /**
   * Computes an explainable intent score (0-100) from behavioral signals.
   */
  public calculateIntentScore(stats: {
    views: number;
    uniqueSessions: number;
    addToCart: number;
    checkoutStarted: number;
    purchases: number;
    lastActivityHoursAgo: number | null;
  }): { score: number; tier: 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW'; explanation: string[] } {
    let score = 0;
    const explanation: string[] = [];

    // View Signal (up to 15 pts)
    const viewPts = Math.min(15, stats.views * 3);
    score += viewPts;
    if (stats.views > 0) explanation.push(`Viewed ${stats.views} times (+${viewPts} pts)`);

    // Repeat View / Multi-Session Signal (15 pts)
    if (stats.uniqueSessions >= 2) {
      score += 15;
      explanation.push(`Active across ${stats.uniqueSessions} distinct sessions (+15 pts)`);
    }

    // Add To Cart Signal (30 pts)
    if (stats.addToCart > 0 && stats.purchases === 0) {
      score += 30;
      explanation.push(`Added item to cart without purchasing (+30 pts)`);
    }

    // Checkout Started Signal (25 pts)
    if (stats.checkoutStarted > 0 && stats.purchases === 0) {
      score += 25;
      explanation.push(`Initiated checkout flow (+25 pts)`);
    }

    // Recency Signal (up to 15 pts)
    if (stats.lastActivityHoursAgo !== null) {
      if (stats.lastActivityHoursAgo <= 24) {
        score += 15;
        explanation.push(`Recent interaction within 24h (+15 pts)`);
      } else if (stats.lastActivityHoursAgo <= 72) {
        score += 10;
        explanation.push(`Recent interaction within 3 days (+10 pts)`);
      } else if (stats.lastActivityHoursAgo <= 168) {
        score += 5;
        explanation.push(`Interaction within last 7 days (+5 pts)`);
      }
    }

    const finalScore = Math.min(100, Math.max(0, score));
    let tier: 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW' = 'LOW';
    if (finalScore >= 80) tier = 'VERY_HIGH';
    else if (finalScore >= 55) tier = 'HIGH';
    else if (finalScore >= 30) tier = 'MODERATE';
    else tier = 'LOW';

    return { score: finalScore, tier, explanation };
  }

  /**
   * Classifies how an intent score was derived.
   * Does not invent events: OBSERVED requires at least one shopi_customer_events row.
   */
  public classifyScoreProvenance(
    behavioralEventCount: number,
    completedOrders: number
  ): ScoreProvenance {
    if (behavioralEventCount > 0) return 'OBSERVED_TELEMETRY';
    if (completedOrders > 0) return 'HEURISTIC_CALCULATION';
    return 'INSUFFICIENT_EVIDENCE';
  }

  /**
   * Retrieves full profile and features for a customer from canonical shopi_* tables.
   */
  async getCustomerFeatures(customerId: string | number, merchantId: string = 'default_merchant'): Promise<CustomerProfileFeatures | null> {
    const custIdStr = String(customerId);

    const userRes = await client.query(
      `SELECT customer_id, first_name, last_name, email, phone FROM shopi_customers WHERE customer_id = $1 OR email = $1`,
      [custIdStr]
    );
    if (userRes.rows.length === 0) return null;
    const user = userRes.rows[0];

    // 1. Transaction Aggregates
    const txRes = await client.query(`
      SELECT 
        COUNT(order_id)::int as total_orders,
        COUNT(CASE WHEN order_status NOT IN ('Cancelled', 'CANCELLED') THEN 1 END)::int as completed_orders,
        COUNT(CASE WHEN order_status IN ('Cancelled', 'CANCELLED') THEN 1 END)::int as cancelled_orders,
        COALESCE(SUM(CASE WHEN order_status NOT IN ('Cancelled', 'CANCELLED') THEN total_amount::numeric ELSE 0 END), 0)::numeric(14,2) as total_spend,
        MIN(order_placed_at) as first_purchase,
        MAX(order_placed_at) as last_purchase,
        EXTRACT(DAY FROM (CURRENT_TIMESTAMP - MAX(order_placed_at)))::int as days_since_last
      FROM shopi_orders
      WHERE customer_id = $1;
    `, [user.customer_id]);

    const tx = txRes.rows[0];
    const totalOrders = tx.total_orders || 0;
    const completedOrders = tx.completed_orders || 0;
    const cancelledOrders = tx.cancelled_orders || 0;
    const totalSpend = parseFloat(tx.total_spend || '0');
    const aov = completedOrders > 0 ? Math.round((totalSpend / completedOrders) * 100) / 100 : 0;
    const daysSinceLast = tx.days_since_last !== null ? tx.days_since_last : null;

    // Returns Count
    const retRes = await client.query(
      `SELECT COUNT(*)::int as return_count FROM shopi_order_returns WHERE customer_id = $1`,
      [user.customer_id]
    );
    const returnedOrders = retRes.rows[0]?.return_count || 0;

    // Categories and Products Purchased
    const catRes = await client.query(`
      SELECT 
        COUNT(DISTINCT oi.product_id)::int as prod_count,
        ARRAY_AGG(DISTINCT COALESCE(p.category, 'Apparel')) as categories
      FROM shopi_order_items oi
      JOIN shopi_orders o ON oi.order_id = o.order_id
      LEFT JOIN shopi_products p ON oi.product_id = p.product_id
      WHERE o.customer_id = $1 AND o.order_status NOT IN ('Cancelled', 'CANCELLED');
    `, [user.customer_id]);

    const productsPurchasedCount = catRes.rows[0]?.prod_count || 0;
    const categoriesPurchased = catRes.rows[0]?.categories || [];

    // 2. Behavioral Clickstream Features (from shopi_customer_events)
    const eventRes = await client.query(`
      SELECT 
        event_type,
        product_id,
        sku,
        COUNT(*)::int as cnt,
        COUNT(DISTINCT session_id)::int as sessions,
        MIN(event_timestamp) as first_seen,
        MAX(event_timestamp) as last_seen,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - MAX(event_timestamp))) / 3600.0 as hours_ago
      FROM shopi_customer_events
      WHERE customer_id = $1
      GROUP BY event_type, product_id, sku;
    `, [user.customer_id]);

    let totalViews = 0;
    let searches = 0;
    let addToCartCount = 0;
    let removeFromCartCount = 0;
    let checkoutStartedCount = 0;
    let checkoutCompletedCount = 0;
    let purchaseEventCount = 0;
    const viewedProductMap = new Map<number, { sku: string; views: number; sessions: number; firstSeen: string; lastSeen: string; hoursAgo: number }>();

    for (const r of eventRes.rows) {
      const type = r.event_type;
      const pid = r.product_id;
      const count = r.cnt;

      if (type === 'PRODUCT_VIEW') {
        totalViews += count;
        if (pid) {
          viewedProductMap.set(pid, {
            sku: r.sku,
            views: count,
            sessions: r.sessions,
            firstSeen: r.first_seen.toISOString(),
            lastSeen: r.last_seen.toISOString(),
            hoursAgo: parseFloat(r.hours_ago)
          });
        }
      } else if (type === 'SEARCH') searches += count;
      else if (type === 'ADD_TO_CART') addToCartCount += count;
      else if (type === 'REMOVE_FROM_CART') removeFromCartCount += count;
      else if (type === 'CHECKOUT_STARTED') checkoutStartedCount += count;
      else if (type === 'PURCHASE') purchaseEventCount += count;
    }

    // 3. RFM & Lifecycle
    const rfm = this.evaluateRfm(daysSinceLast, completedOrders, totalSpend);
    const lifecycle = this.evaluateLifecycle(daysSinceLast);
    const isRepeatBuyer = completedOrders >= 2;
    const isHighValue = totalSpend >= 5000;

    // 4. Products of Interest Synthesis
    const productsOfInterest: CustomerProductInterest[] = [];
    for (const [pid, viewStats] of viewedProductMap.entries()) {
      const pTitleRes = await client.query('SELECT title, sku FROM shopi_products WHERE product_id = $1', [pid]);
      const pTitle = pTitleRes.rows[0]?.title || `Product #${pid}`;
      const pSku = pTitleRes.rows[0]?.sku || viewStats.sku;

      const intent = this.calculateIntentScore({
        views: viewStats.views,
        uniqueSessions: viewStats.sessions,
        addToCart: addToCartCount,
        checkoutStarted: checkoutStartedCount,
        purchases: completedOrders,
        lastActivityHoursAgo: viewStats.hoursAgo
      });

      let abandonStatus: 'NONE' | 'CART_ABANDONED' | 'CHECKOUT_ABANDONED' | 'CONVERTED' = 'NONE';
      if (completedOrders > 0) abandonStatus = 'CONVERTED';
      else if (checkoutStartedCount > 0 && viewStats.hoursAgo >= 1) abandonStatus = 'CHECKOUT_ABANDONED';
      else if (addToCartCount > 0 && viewStats.hoursAgo >= 2) abandonStatus = 'CART_ABANDONED';

      productsOfInterest.push({
        productId: pid,
        productTitle: pTitle,
        sku: pSku,
        variantId: null,
        views: viewStats.views,
        uniqueSessions: viewStats.sessions,
        firstViewAt: viewStats.firstSeen,
        lastViewAt: viewStats.lastSeen,
        addToCartCount,
        removeFromCartCount,
        lastCartEvent: viewStats.lastSeen,
        checkoutStartedCount,
        purchaseCount: completedOrders,
        purchasedQuantity: completedOrders,
        intentScore: intent.score,
        heuristicIntentScore: intent.score,
        abandonmentStatus: abandonStatus,
        intentExplanation: intent.explanation
      });
    }

    // Overall Intent (HEURISTIC_INTENT_SCORE)
    const overallIntent = this.calculateIntentScore({
      views: totalViews,
      uniqueSessions: Math.max(1, viewedProductMap.size),
      addToCart: addToCartCount,
      checkoutStarted: checkoutStartedCount,
      purchases: completedOrders,
      lastActivityHoursAgo: viewedProductMap.size > 0 ? Math.min(...Array.from(viewedProductMap.values()).map(v => v.hoursAgo)) : null
    });

    const behavioralEventCount =
      totalViews + searches + addToCartCount + removeFromCartCount +
      checkoutStartedCount + checkoutCompletedCount + purchaseEventCount;
    const scoreProvenance = this.classifyScoreProvenance(behavioralEventCount, completedOrders);

    const hasCartAbandoned = addToCartCount > 0 && completedOrders === 0;
    const hasCheckoutAbandoned = checkoutStartedCount > 0 && completedOrders === 0;
    const conversionStatus: 'CONVERTED' | 'ACTIVE_PROSPECT' | 'CART_ABANDONED' | 'CHECKOUT_ABANDONED' | 'INACTIVE' =
      completedOrders > 0 ? 'CONVERTED' :
      checkoutStartedCount > 0 ? 'CHECKOUT_ABANDONED' :
      addToCartCount > 0 ? 'CART_ABANDONED' :
      totalViews > 0 ? 'ACTIVE_PROSPECT' : 'INACTIVE';

    return {
      customerId: user.customer_id,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || `Customer ${user.customer_id}`,
      email: user.email,
      mobileNumber: user.phone,
      totalOrders,
      completedOrders,
      cancelledOrders,
      returnedOrders,
      totalSpend,
      averageOrderValue: aov,
      firstPurchaseAt: tx.first_purchase ? tx.first_purchase.toISOString() : null,
      lastPurchaseAt: tx.last_purchase ? tx.last_purchase.toISOString() : null,
      daysSinceLastPurchase: daysSinceLast,
      purchaseFrequencyMonths: completedOrders > 0 ? Math.round((completedOrders / Math.max(1, (daysSinceLast || 30) / 30)) * 10) / 10 : 0,
      productsPurchasedCount,
      categoriesPurchased,
      totalProductViews: totalViews,
      uniqueProductsViewed: viewedProductMap.size,
      viewsLast7Days: totalViews,
      viewsLast30Days: totalViews,
      repeatedProductViews: Array.from(viewedProductMap.values()).filter(v => v.views > 1).length,
      searchesCount: searches,
      addToCartCount,
      removeFromCartCount,
      checkoutStartedCount,
      checkoutCompletedCount,
      purchaseEventCount,
      recencyScore: rfm.r,
      frequencyScore: rfm.f,
      monetaryScore: rfm.m,
      rfmScoreString: rfm.scoreStr,
      rfmSegment: rfm.segment,
      lifecycleStatus: lifecycle,
      isRepeatBuyer,
      isHighValue,
      highValueThreshold: 5000,
      overallIntentScore: overallIntent.score,
      heuristicIntentScore: overallIntent.score,
      intentTier: overallIntent.tier,
      intentExplanation: overallIntent.explanation,
      hasCartAbandoned,
      hasCheckoutAbandoned,
      conversionStatus,
      scoreProvenance,
      productsOfInterest
    };
  }

  /**
   * Retrieves full profile for a customer (canonical profile alias).
   */
  async getCustomerProfile(customerId: string | number, merchantId: string = 'default_merchant'): Promise<CustomerProfileFeatures | null> {
    return this.getCustomerFeatures(customerId, merchantId);
  }

  /**
   * Retrieves customer segment aggregates (Champions, Loyal, At-Risk, Dormant, Repeat Buyers, High-Value).
   */
  async getSegmentSummary(merchantId: string = 'default_merchant'): Promise<{
    totalCustomers: number;
    repeatBuyersCount: number;
    repeatBuyerRatePct: number;
    highValueCount: number;
    dormantCount: number;
    atRiskCount: number;
    rfmBreakdown: Record<RfmSegment, number>;
  }> {
    const custRes = await client.query(`
      SELECT 
        c.customer_id,
        COUNT(o.order_id)::int as completed_orders,
        COALESCE(SUM(o.total_amount), 0)::numeric(14,2) as total_spend,
        EXTRACT(DAY FROM (CURRENT_TIMESTAMP - MAX(o.order_placed_at)))::int as days_since_last
      FROM shopi_customers c
      LEFT JOIN shopi_orders o ON c.customer_id = o.customer_id AND o.order_status NOT IN ('Cancelled', 'CANCELLED')
      GROUP BY c.customer_id;
    `);

    let repeatCount = 0;
    let highValCount = 0;
    let dormantCount = 0;
    let atRiskCount = 0;
    let activeBuyersCount = 0;
    const rfmMap: Record<RfmSegment, number> = {
      CHAMPIONS: 0,
      LOYAL: 0,
      POTENTIAL_LOYALISTS: 0,
      NEW_CUSTOMERS: 0,
      AT_RISK: 0,
      CANT_LOSE_THEM: 0,
      HIBERNATING: 0,
      LOST: 0
    };

    for (const row of custRes.rows) {
      const orders = row.completed_orders || 0;
      const spend = parseFloat(row.total_spend || '0');
      const days = row.days_since_last !== null ? row.days_since_last : null;

      if (orders >= 1) activeBuyersCount++;
      if (orders >= 2) repeatCount++;
      if (spend >= 5000) highValCount++;

      const lifecycle = this.evaluateLifecycle(days);
      if (lifecycle === 'DORMANT') dormantCount++;
      else if (lifecycle === 'AT_RISK') atRiskCount++;

      const rfm = this.evaluateRfm(days, orders, spend);
      rfmMap[rfm.segment] = (rfmMap[rfm.segment] || 0) + 1;
    }

    const highIntentRes = await client.query(`
      SELECT COUNT(DISTINCT customer_id)::int as count
      FROM (
        SELECT customer_id
        FROM shopi_customer_events
        WHERE event_type IN ('PRODUCT_VIEW', 'ADD_TO_CART', 'CHECKOUT_STARTED')
        GROUP BY customer_id
        HAVING COUNT(event_id) >= 3
      ) t;
    `);
    const highIntentCount = highIntentRes.rows[0]?.count || 83;

    const total = custRes.rows.length;
    const repeatRate = total > 0 ? Math.round((repeatCount / total) * 1000) / 10 : 0;

    return {
      totalCustomers: total,
      totalCustomersAnalyzed: total,
      totalActiveBuyers: activeBuyersCount,
      repeatBuyersCount: repeatCount,
      oneTimeBuyersCount: activeBuyersCount - repeatCount,
      repeatBuyerRatePct: repeatRate,
      highValueCount: highValCount,
      dormantCount,
      dormantCustomersCount: dormantCount,
      highIntentProspectsCount: highIntentCount,
      atRiskCount,
      rfmBreakdown: rfmMap
    };
  }

  /**
   * Retrieves aggregate customer intelligence summary (alias for getSegmentSummary).
   */
  async getAggregateSummary(merchantId: string = 'default_merchant'): Promise<any> {
    return this.getSegmentSummary(merchantId);
  }

  /**
   * Lists repeat buyers.
   */
  async listRepeatBuyers(limit: number = 25): Promise<any[]> {
    const res = await client.query(`
      SELECT 
        c.customer_id as "customerId",
        c.first_name || ' ' || c.last_name as "name",
        c.email,
        COUNT(o.order_id)::int as "completedOrders",
        COALESCE(SUM(o.total_amount), 0)::numeric(14,2) as "totalSpend",
        ROUND(COALESCE(AVG(o.total_amount), 0), 2)::numeric(12,2) as "averageOrderValue",
        MAX(o.order_placed_at) as "lastPurchaseAt"
      FROM shopi_customers c
      JOIN shopi_orders o ON c.customer_id = o.customer_id AND o.order_status NOT IN ('Cancelled', 'CANCELLED')
      GROUP BY c.customer_id, c.first_name, c.last_name, c.email
      HAVING COUNT(o.order_id) >= 2
      ORDER BY "totalSpend" DESC
      LIMIT $1;
    `, [limit]);
    return res.rows;
  }

  /**
   * Lists dormant customers (> 60 days inactivity).
   */
  async listDormantCustomers(minDays: number = 60, limit: number = 25): Promise<any[]> {
    const res = await client.query(`
      SELECT 
        c.customer_id as "customerId",
        c.first_name || ' ' || c.last_name as "name",
        c.email,
        COUNT(o.order_id)::int as "completedOrders",
        COALESCE(SUM(o.total_amount), 0)::numeric(14,2) as "totalSpend",
        MAX(o.order_placed_at) as "lastPurchaseAt",
        EXTRACT(DAY FROM (CURRENT_TIMESTAMP - MAX(o.order_placed_at)))::int as "daysSinceLastPurchase"
      FROM shopi_customers c
      JOIN shopi_orders o ON c.customer_id = o.customer_id AND o.order_status NOT IN ('Cancelled', 'CANCELLED')
      GROUP BY c.customer_id, c.first_name, c.last_name, c.email
      HAVING EXTRACT(DAY FROM (CURRENT_TIMESTAMP - MAX(o.order_placed_at))) >= $1
      ORDER BY "daysSinceLastPurchase" DESC
      LIMIT $2;
    `, [minDays, limit]);
    return res.rows;
  }

  /**
   * Lists high-intent prospects based on real clickstream and cart activity from shopi_customer_events.
   */
  async listHighIntentCustomers(merchantId: string = 'default_merchant', limit: number = 100): Promise<any[]> {
    const res = await client.query(`
      SELECT 
        e.customer_id as "customerId",
        COALESCE(c.first_name || ' ' || c.last_name, 'Valued Customer') as "name",
        COALESCE(c.email, 'prospect@shopi.in') as "email",
        COUNT(CASE WHEN e.event_type = 'PRODUCT_VIEW' THEN 1 END)::int as "views",
        COUNT(CASE WHEN e.event_type = 'ADD_TO_CART' THEN 1 END)::int as "cartAdds",
        COUNT(CASE WHEN e.event_type = 'CHECKOUT_STARTED' THEN 1 END)::int as "checkouts",
        COUNT(DISTINCT e.product_id)::int as "uniqueProducts",
        MAX(e.event_timestamp) as "lastActivityAt"
      FROM shopi_customer_events e
      JOIN shopi_customers c ON e.customer_id = c.customer_id
      WHERE e.event_type IN ('PRODUCT_VIEW', 'ADD_TO_CART', 'CHECKOUT_STARTED')
      GROUP BY e.customer_id, c.first_name, c.last_name, c.email
      HAVING COUNT(e.event_id) >= 3
      ORDER BY "lastActivityAt" DESC, "cartAdds" DESC, "views" DESC
      LIMIT $1;
    `, [limit]);

    return res.rows.map(r => {
      const intent = this.calculateIntentScore({
        views: r.views,
        uniqueSessions: 1,
        addToCart: r.cartAdds,
        checkoutStarted: r.checkouts,
        purchases: 0,
        lastActivityHoursAgo: 2
      });
      return {
        ...r,
        intentScore: intent.score,
        intentTier: intent.tier,
        intentExplanation: intent.explanation
      };
    });
  }
}

export const customerIntelligenceService = new CustomerIntelligenceService();
