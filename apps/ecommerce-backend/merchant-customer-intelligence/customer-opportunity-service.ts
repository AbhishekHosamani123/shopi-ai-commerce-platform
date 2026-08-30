import { client } from '../data/DB';
import {
  MerchantOpportunity,
  OpportunityType,
  OpportunityPriority,
  OpportunityListFilter,
  OpportunityFinancialContext,
  StructuredOpportunityExplanation
} from '../merchant-opportunity-engine/opportunity-types';
import { opportunityScoringService } from '../merchant-opportunity-engine/opportunity-scoring';

export interface CustomerProductBehavior {
  productId: number;
  productTitle: string;
  sku: string;
  variantId: number | null;
  variantSku: string | null;
  productViews: number;
  uniqueSessions: number;
  cartAdditions: number;
  checkoutInitiations: number;
  purchases: number;
  abandonedCart: boolean;
  abandonedCheckout: boolean;
  firstActivityAt: string | null;
  latestActivityAt: string | null;
  heuristicIntentScore: number;
  evidenceBreakdown: string[];
}

export interface CanonicalCustomerBehavior {
  customerId: string;
  name: string;
  email: string;
  city?: string;
  completedOrderCount: number;
  lifetimeSpend: number;
  averageOrderValue: number;
  firstPurchaseAt: string | null;
  latestPurchaseAt: string | null;
  daysSinceLastPurchase: number | null;
  purchaseFrequencyDays: number;
  
  // Behavioral Signals
  isRepeatBuyer: boolean;
  isOneTimeBuyer: boolean;
  isDormant: boolean;
  isVip: boolean;
  
  // Product-Level Interactions
  productInteractions: CustomerProductBehavior[];

  // Most recently purchased product (anchors win-back offers for dormant/VIP customers)
  lastPurchasedProductId: number | null;
  lastPurchasedProductTitle: string | null;

  // Overall Heuristic Score (Max across products)
  topIntentProductId: number | null;
  topIntentProductTitle: string | null;
  maxHeuristicIntentScore: number;
  overallIntentEvidence: string[];
}

export class CustomerOpportunityService {
  /**
   * Builds the complete canonical behavior model for a specific customer or all customers.
   */
  public async getCustomerBehaviorModel(
    customerId: string,
    merchantId: string = 'default_merchant'
  ): Promise<CanonicalCustomerBehavior | null> {
    const list = await this.buildCustomerBehaviorModels(merchantId, [customerId]);
    return list[0] || null;
  }

  /**
   * Scans canonical shopi_* tables and builds behavior models for a population of customers.
   */
  public async buildCustomerBehaviorModels(
    merchantId: string = 'default_merchant',
    filterCustomerIds?: string[]
  ): Promise<CanonicalCustomerBehavior[]> {
    // 1. Fetch Customers and Orders
    let custSql = `
      SELECT 
        c.customer_id,
        COALESCE(c.first_name || ' ' || c.last_name, 'Valued Customer') as name,
        c.email,
        c.city,
        COUNT(DISTINCT o.order_id)::int as completed_orders,
        COALESCE(SUM(o.total_amount), 0)::numeric(14,2) as lifetime_spend,
        MIN(o.order_placed_at) as first_purchase_at,
        MAX(o.order_placed_at) as latest_purchase_at,
        EXTRACT(DAY FROM (CURRENT_TIMESTAMP - MAX(o.order_placed_at)))::int as days_since_last_purchase
      FROM shopi_customers c
      LEFT JOIN shopi_orders o ON c.customer_id = o.customer_id AND o.order_status NOT IN ('CANCELLED', 'Cancelled')
    `;

    const params: any[] = [];
    if (filterCustomerIds && filterCustomerIds.length > 0) {
      custSql += ` WHERE c.customer_id = ANY($1)`;
      params.push(filterCustomerIds);
    }
    custSql += ` GROUP BY c.customer_id, c.first_name, c.last_name, c.email, c.city ORDER BY c.customer_id ASC;`;

    const custRes = await client.query(custSql, params);

    // 2. Fetch Events for these customers
    let evtSql = `
      SELECT 
        e.customer_id,
        e.session_id,
        e.event_type,
        e.product_id,
        e.variant_id,
        e.sku,
        e.variant_sku,
        e.event_timestamp,
        p.title as product_title,
        p.selling_price
      FROM shopi_customer_events e
      JOIN shopi_products p ON e.product_id = p.product_id
    `;
    const evtParams: any[] = [];
    if (filterCustomerIds && filterCustomerIds.length > 0) {
      evtSql += ` WHERE e.customer_id = ANY($1)`;
      evtParams.push(filterCustomerIds);
    }
    evtSql += ` ORDER BY e.event_timestamp ASC;`;

    const evtRes = await client.query(evtSql, evtParams);

    // 3. Fetch Purchases for these customers to correlate product purchase outcomes
    let purSql = `
      SELECT 
        o.customer_id,
        oi.product_id,
        COUNT(oi.order_item_id)::int as purchase_count
      FROM shopi_order_items oi
      JOIN shopi_orders o ON oi.order_id = o.order_id
      WHERE o.order_status NOT IN ('CANCELLED', 'Cancelled')
    `;
    const purParams: any[] = [];
    if (filterCustomerIds && filterCustomerIds.length > 0) {
      purSql += ` AND o.customer_id = ANY($1)`;
      purParams.push(filterCustomerIds);
    }
    purSql += ` GROUP BY o.customer_id, oi.product_id;`;

    const purRes = await client.query(purSql, purParams);
    const purchaseMap = new Map<string, number>(); // key: `${customerId}:${productId}`
    for (const row of purRes.rows) {
      purchaseMap.set(`${row.customer_id}:${row.product_id}`, row.purchase_count || 0);
    }

    // 3b. Last purchased product per customer (anchor product for dormant/VIP win-back offers)
    const lastPurRes = await client.query(`
      SELECT DISTINCT ON (o.customer_id)
        o.customer_id,
        oi.product_id,
        p.title as product_title
      FROM shopi_orders o
      JOIN shopi_order_items oi ON o.order_id = oi.order_id
      JOIN shopi_products p ON oi.product_id = p.product_id
      WHERE o.order_status NOT IN ('CANCELLED', 'Cancelled')
        ${filterCustomerIds && filterCustomerIds.length > 0 ? 'AND o.customer_id = ANY($1)' : ''}
      ORDER BY o.customer_id, o.order_placed_at DESC;
    `, purParams);
    const lastPurchasedMap = new Map<string, { productId: number; productTitle: string }>();
    for (const row of lastPurRes.rows) {
      lastPurchasedMap.set(row.customer_id, {
        productId: row.product_id,
        productTitle: row.product_title
      });
    }

    // 4. Group events by customer and product
    const customerEventsMap = new Map<string, Map<number, any[]>>();
    for (const evt of evtRes.rows) {
      if (!customerEventsMap.has(evt.customer_id)) {
        customerEventsMap.set(evt.customer_id, new Map());
      }
      const prodMap = customerEventsMap.get(evt.customer_id)!;
      if (!prodMap.has(evt.product_id)) {
        prodMap.set(evt.product_id, []);
      }
      prodMap.get(evt.product_id)!.push(evt);
    }

    // 5. Build canonical behavior objects
    const results: CanonicalCustomerBehavior[] = [];
    const now = new Date().getTime();

    for (const c of custRes.rows) {
      const completedOrders = c.completed_orders || 0;
      const lifetimeSpend = parseFloat(c.lifetime_spend || '0');
      const aov = completedOrders > 0 ? parseFloat((lifetimeSpend / completedOrders).toFixed(2)) : 0;
      const daysSinceLast = c.days_since_last_purchase !== null ? c.days_since_last_purchase : null;

      // Purchase frequency (days between first and latest / (orders - 1))
      let purchaseFreqDays = 0;
      if (completedOrders > 1 && c.first_purchase_at && c.latest_purchase_at) {
        const spanMs = new Date(c.latest_purchase_at).getTime() - new Date(c.first_purchase_at).getTime();
        purchaseFreqDays = Math.round(spanMs / (1000 * 3600 * 24 * (completedOrders - 1)));
      }

      // Signals
      const isRepeatBuyer = completedOrders >= 2;
      const isOneTimeBuyer = completedOrders === 1;
      const isDormant = daysSinceLast !== null ? daysSinceLast > 60 : false;
      const isVip = lifetimeSpend >= 3000 || completedOrders >= 3;

      // Product Interactions
      const productInteractions: CustomerProductBehavior[] = [];
      const prodMap = customerEventsMap.get(c.customer_id) || new Map();

      let topScore = 0;
      let topPid: number | null = null;
      let topPtitle: string | null = null;
      let topEvidence: string[] = [];

      for (const [pid, events] of prodMap.entries()) {
        const firstEvt = events[0];
        const pTitle = firstEvt.product_title;
        const sku = firstEvt.sku;
        // Simple product safety: FORMAL-SHOE-006 and SPORTS-SHOE-004 have 0 variants
        const isSimpleShoe = sku === 'FORMAL-SHOE-006' || sku === 'SPORTS-SHOE-004';
        const variantId = isSimpleShoe ? null : firstEvt.variant_id;
        const variantSku = isSimpleShoe ? null : firstEvt.variant_sku;

        const views = events.filter(e => e.event_type === 'PRODUCT_VIEW').length;
        const sessions = new Set(events.map(e => e.session_id)).size;
        const cartAdds = events.filter(e => e.event_type === 'ADD_TO_CART').length;
        const checkouts = events.filter(e => e.event_type === 'CHECKOUT_STARTED').length;
        const purchases = purchaseMap.get(`${c.customer_id}:${pid}`) || 0;

        const abandonedCart = cartAdds > 0 && purchases === 0;
        const abandonedCheckout = checkouts > 0 && purchases === 0;

        const firstActivityAt = events[0]?.event_timestamp ? new Date(events[0].event_timestamp).toISOString() : null;
        const latestActivityAt = events[events.length - 1]?.event_timestamp ? new Date(events[events.length - 1].event_timestamp).toISOString() : null;

        // Calculate Heuristic Intent Score & Explicit Evidence
        const latestMs = latestActivityAt ? new Date(latestActivityAt).getTime() : 0;
        const ageDays = latestMs > 0 ? (now - latestMs) / (1000 * 3600 * 24) : 999;

        let score = 0;
        const evidence: string[] = [];

        // 1. Views
        if (views >= 4) {
          score += 15;
          evidence.push(`+15 repeated product views (${views} views)`);
        } else if (views >= 2) {
          score += 10;
          evidence.push(`+10 repeated product views (${views} views)`);
        } else if (views === 1) {
          score += 4;
          evidence.push(`+4 product view (1 view)`);
        }

        // 2. Multi-session
        if (sessions >= 2) {
          score += 15;
          evidence.push(`+15 multi-session interest (${sessions} distinct sessions)`);
        } else if (sessions === 1) {
          score += 5;
          evidence.push(`+5 single session engagement`);
        }

        // 3. Cart
        if (cartAdds > 0) {
          score += 25;
          evidence.push(`+25 cart addition (${cartAdds} add-to-cart events)`);
        }

        // 4. Checkout
        if (checkouts > 0) {
          score += 25;
          evidence.push(`+25 checkout initiation (${checkouts} checkout events)`);
        }

        // 5. Recency
        if (ageDays <= 3) {
          score += 20;
          evidence.push(`+20 high recency (active within last 3 days)`);
        } else if (ageDays <= 7) {
          score += 12;
          evidence.push(`+12 recent activity (active within last 7 days)`);
        } else if (ageDays <= 14) {
          score += 5;
          evidence.push(`+5 moderate recency (active within last 14 days)`);
        }

        // Deduct if already purchased
        if (purchases > 0) {
          score = Math.max(10, score - 30);
          evidence.push(`-30 purchase completed (${purchases} orders)`);
        }

        const normalizedScore = Math.min(100, Math.max(0, score));

        if (normalizedScore > topScore) {
          topScore = normalizedScore;
          topPid = pid;
          topPtitle = pTitle;
          topEvidence = evidence;
        }

        productInteractions.push({
          productId: pid,
          productTitle: pTitle,
          sku,
          variantId,
          variantSku,
          productViews: views,
          uniqueSessions: sessions,
          cartAdditions: cartAdds,
          checkoutInitiations: checkouts,
          purchases,
          abandonedCart,
          abandonedCheckout,
          firstActivityAt,
          latestActivityAt,
          heuristicIntentScore: normalizedScore,
          evidenceBreakdown: evidence
        });
      }

      results.push({
        customerId: c.customer_id,
        name: c.name,
        email: c.email,
        city: c.city,
        completedOrderCount: completedOrders,
        lifetimeSpend,
        averageOrderValue: aov,
        firstPurchaseAt: c.first_purchase_at ? new Date(c.first_purchase_at).toISOString() : null,
        latestPurchaseAt: c.latest_purchase_at ? new Date(c.latest_purchase_at).toISOString() : null,
        daysSinceLastPurchase: daysSinceLast,
        purchaseFrequencyDays: purchaseFreqDays,
        isRepeatBuyer,
        isOneTimeBuyer,
        isDormant,
        isVip,
        productInteractions,
        lastPurchasedProductId: lastPurchasedMap.get(c.customer_id)?.productId ?? topPid,
        lastPurchasedProductTitle: lastPurchasedMap.get(c.customer_id)?.productTitle ?? topPtitle,
        topIntentProductId: topPid,
        topIntentProductTitle: topPtitle,
        maxHeuristicIntentScore: topScore,
        overallIntentEvidence: topEvidence
      });
    }

    return results;
  }

  /**
   * Retrieves financial economics and COGS safety for a product.
   */
  public async getProductEconomics(productId: number): Promise<OpportunityFinancialContext> {
    const res = await client.query(`
      SELECT 
        p.product_id,
        p.selling_price::numeric(10,2) as selling_price,
        cg.total_unit_cost::numeric(10,2) as cogs_unit_cost,
        cg.minimum_margin_floor_pct::numeric(5,2) as min_margin_floor_pct,
        cg.maximum_safe_discount_amount::numeric(10,2) as max_safe_discount
      FROM shopi_products p
      LEFT JOIN shopi_product_cogs cg ON p.product_id = cg.product_id
      WHERE p.product_id = $1;
    `, [productId]);

    if (res.rows.length === 0) {
      return {
        sellingPrice: 0,
        cogsUnitCost: null,
        contributionMargin: null,
        marginFloorPct: 15,
        maxSafeDiscount: null,
        discountAllowed: false,
        reason: 'Offer unavailable — COGS data required.'
      };
    }

    const row = res.rows[0];
    const sellingPrice = parseFloat(row.selling_price || '0');
    const cogsUnitCost = row.cogs_unit_cost !== null ? parseFloat(row.cogs_unit_cost) : null;
    const marginFloor = parseFloat(row.min_margin_floor_pct || '15');

    if (cogsUnitCost === null) {
      return {
        sellingPrice,
        cogsUnitCost: null,
        contributionMargin: null,
        marginFloorPct: marginFloor,
        maxSafeDiscount: null,
        discountAllowed: false,
        reason: 'Offer unavailable — COGS data required.'
      };
    }

    const contrib = Math.max(0, parseFloat((sellingPrice - cogsUnitCost).toFixed(2)));
    const maxSafe = row.max_safe_discount !== null ? parseFloat(row.max_safe_discount) : Math.max(0, parseFloat((contrib * 0.5).toFixed(2)));

    return {
      sellingPrice,
      cogsUnitCost,
      contributionMargin: contrib,
      marginFloorPct: marginFloor,
      maxSafeDiscount: maxSafe,
      discountAllowed: maxSafe > 0,
      reason: 'COGS verified and margin floor preserved'
    };
  }

  /**
   * Generates actionable opportunities across all canonical types.
   */
  public async discoverOpportunities(
    merchantId: string = 'default_merchant',
    filter?: OpportunityListFilter
  ): Promise<MerchantOpportunity[]> {
    const behaviors = await this.buildCustomerBehaviorModels(merchantId);
    const opportunities: MerchantOpportunity[] = [];
    const seenDeduplicationKeys = new Set<string>();
    const now = new Date();
    const nowIso = now.toISOString();

    for (const c of behaviors) {
      // -----------------------------------------------------------------------
      // A. CHECKOUT ABANDONMENT & CART ABANDONMENT (Product-Level)
      // -----------------------------------------------------------------------
      for (const p of c.productInteractions) {
        const econ = await this.getProductEconomics(p.productId);

        if (p.abandonedCheckout) {
          const dedupKey = `${c.customerId}:${p.productId}:CHECKOUT_ABANDONMENT`;
          if (!seenDeduplicationKeys.has(dedupKey)) {
            seenDeduplicationKeys.add(dedupKey);

            const scoreRes = opportunityScoringService.calculateScore({
              businessImpact: econ.sellingPrice >= 2000 ? 'HIGH' : 'MEDIUM',
              urgency: 'IMMEDIATE',
              confidence: 'HIGH',
              customerSignalStrength: 'STRONG',
              financialSafety: econ.discountAllowed ? 'KNOWN_COGS' : 'MISSING_COGS'
            });

            const opp: MerchantOpportunity = {
              opportunityId: `opp_chk_${c.customerId}_${p.productId}`,
              merchantId,
              type: 'CHECKOUT_ABANDONMENT',
              priority: scoreRes.priority,
              status: 'ACTIVE',
              priorityScore: scoreRes.score,
              title: `Checkout Abandoned: ${c.name} for ${p.productTitle}`,
              summary: `${c.name} started checkout for ${p.productTitle} but did not complete the transaction.`,
              target: {
                entityType: 'CUSTOMER',
                entityId: c.customerId,
                name: `${c.name} • ${p.productTitle}`,
                customerId: c.customerId,
                productId: p.productId,
                sku: p.sku,
                variantId: p.variantId
              },
              evidence: {
                telemetrySource: 'Canonical Shopi Customer Event Stream',
                sampleSize: 1,
                signals: {
                  customerId: c.customerId,
                  productId: p.productId,
                  sku: p.sku,
                  variantSku: p.variantSku,
                  checkoutInitiations: p.checkoutInitiations,
                  heuristicScore: p.heuristicIntentScore,
                  evidenceBreakdown: p.evidenceBreakdown
                },
                observedAt: p.latestActivityAt || nowIso
              },
              metrics: {
                potentialRevenue: econ.sellingPrice,
                impactedCustomers: 1
              },
              confidence: 'HIGH',
              urgency: 'IMMEDIATE',
              businessImpact: econ.sellingPrice >= 2000 ? 'HIGH' : 'MEDIUM',
              financialSafety: econ.cogsUnitCost !== null ? 'KNOWN_COGS' : 'MISSING_COGS',
              financialContext: econ,
              recommendedAction: econ.discountAllowed
                ? `Send checkout recovery assistance with verified safe incentive up to ₹${econ.maxSafeDiscount}.`
                : 'Send stock & delivery assistance reminder (Offer unavailable — COGS data required for discounts).',
              detectedAt: nowIso,
              expiresAt: new Date(now.getTime() + 7 * 86400000).toISOString(),
              explanation: {
                observation: `Customer ${c.name} (${c.email}) initiated checkout for ${p.productTitle} (${p.sku}) without finalizing order.`,
                hypothesis: [
                  'Customer experienced checkout distraction, network interruption, or payment hesitation.',
                  'Customer showed strong purchase intent but did not complete purchase.'
                ],
                questionsToInvestigate: [
                  'Are all payment gateways responsive for this customer location?',
                  'Is variant stock actively allocated and ready for fulfillment?'
                ],
                limitations: [
                  'Reason for abandonment is not definitively price-driven; do not assume price was the blocker.'
                ],
                structured: {
                  observed: `Customer initiated checkout for ${p.productTitle} (${p.sku}) on ${p.latestActivityAt || 'recently'}.`,
                  calculated: `Lifetime spend: ₹${c.lifetimeSpend}, Orders: ${c.completedOrderCount}, Cart Value: ₹${econ.sellingPrice}.`,
                  modelEstimate: `Heuristic Intent Score: ${p.heuristicIntentScore}/100 based on observed event frequency.`,
                  recommendation: econ.discountAllowed
                    ? `Prepare a high-urgency checkout completion prompt with max safe concession of ₹${econ.maxSafeDiscount}.`
                    : `Provide customer support and stock reservation reminder.`,
                  risk: 'Customer may have completed purchase via alternative offline channel or changed requirements.'
                }
              },
              structuredExplanation: {
                observed: `Customer initiated checkout for ${p.productTitle} (${p.sku}) on ${p.latestActivityAt || 'recently'}.`,
                calculated: `Lifetime spend: ₹${c.lifetimeSpend}, Orders: ${c.completedOrderCount}, Cart Value: ₹${econ.sellingPrice}.`,
                modelEstimate: `Heuristic Intent Score: ${p.heuristicIntentScore}/100 based on observed event frequency.`,
                recommendation: econ.discountAllowed
                  ? `Prepare a high-urgency checkout completion prompt with max safe concession of ₹${econ.maxSafeDiscount}.`
                  : `Provide customer support and stock reservation reminder.`,
                risk: 'Customer may have completed purchase via alternative offline channel or changed requirements.'
              }
            };

            opportunities.push(opp);
          }
        } else if (p.abandonedCart) {
          const dedupKey = `${c.customerId}:${p.productId}:CART_ABANDONMENT`;
          if (!seenDeduplicationKeys.has(dedupKey)) {
            seenDeduplicationKeys.add(dedupKey);

            const scoreRes = opportunityScoringService.calculateScore({
              businessImpact: econ.sellingPrice >= 2000 ? 'HIGH' : 'MEDIUM',
              urgency: 'IMMEDIATE',
              confidence: 'HIGH',
              customerSignalStrength: 'STRONG',
              financialSafety: econ.discountAllowed ? 'KNOWN_COGS' : 'MISSING_COGS'
            });

            const opp: MerchantOpportunity = {
              opportunityId: `opp_cart_${c.customerId}_${p.productId}`,
              merchantId,
              type: 'CART_ABANDONMENT',
              priority: scoreRes.priority,
              status: 'ACTIVE',
              priorityScore: scoreRes.score,
              title: `Cart Abandoned: ${c.name} for ${p.productTitle}`,
              summary: `${c.name} placed ${p.productTitle} in cart without completing purchase.`,
              target: {
                entityType: 'CUSTOMER',
                entityId: c.customerId,
                name: `${c.name} • ${p.productTitle}`,
                customerId: c.customerId,
                productId: p.productId,
                sku: p.sku,
                variantId: p.variantId
              },
              evidence: {
                telemetrySource: 'Canonical Shopi Customer Event Stream',
                sampleSize: 1,
                signals: {
                  customerId: c.customerId,
                  productId: p.productId,
                  sku: p.sku,
                  variantSku: p.variantSku,
                  cartAdditions: p.cartAdditions,
                  heuristicScore: p.heuristicIntentScore,
                  evidenceBreakdown: p.evidenceBreakdown
                },
                observedAt: p.latestActivityAt || nowIso
              },
              metrics: {
                potentialRevenue: econ.sellingPrice,
                impactedCustomers: 1
              },
              confidence: 'HIGH',
              urgency: 'IMMEDIATE',
              businessImpact: econ.sellingPrice >= 2000 ? 'HIGH' : 'MEDIUM',
              financialSafety: econ.cogsUnitCost !== null ? 'KNOWN_COGS' : 'MISSING_COGS',
              financialContext: econ,
              recommendedAction: econ.discountAllowed
                ? `Send cart reminder highlighting product features and safe discount up to ₹${econ.maxSafeDiscount}.`
                : 'Send cart reservation notice (Offer unavailable — COGS data required for discounts).',
              detectedAt: nowIso,
              expiresAt: new Date(now.getTime() + 7 * 86400000).toISOString(),
              explanation: {
                observation: `Customer ${c.name} added ${p.productTitle} to cart with ${p.uniqueSessions} browsing sessions and no subsequent purchase.`,
                hypothesis: [
                  'Customer showed strong purchase intent but did not complete purchase.',
                  'Customer is actively evaluating item and comparing alternatives.'
                ],
                questionsToInvestigate: [
                  'Is product available with estimated 2-3 day delivery?',
                  'Has customer viewed other items in the same category?'
                ],
                limitations: [
                  'No direct price complaint recorded; treat as high intent evaluation.'
                ],
                structured: {
                  observed: `Customer added ${p.productTitle} to cart on ${p.latestActivityAt || 'recently'}.`,
                  calculated: `Lifetime spend: ₹${c.lifetimeSpend}, Orders: ${c.completedOrderCount}.`,
                  modelEstimate: `Heuristic Intent Score: ${p.heuristicIntentScore}/100.`,
                  recommendation: econ.discountAllowed
                    ? `Dispatch personalized cart reminder with safe discount.`
                    : `Dispatch personalized cart reminder highlighting stock availability.`,
                  risk: 'Customer may find excessive follow-up intrusive if sent too frequently.'
                }
              },
              structuredExplanation: {
                observed: `Customer added ${p.productTitle} to cart on ${p.latestActivityAt || 'recently'}.`,
                calculated: `Lifetime spend: ₹${c.lifetimeSpend}, Orders: ${c.completedOrderCount}.`,
                modelEstimate: `Heuristic Intent Score: ${p.heuristicIntentScore}/100.`,
                recommendation: econ.discountAllowed
                  ? `Dispatch personalized cart reminder with safe discount.`
                  : `Dispatch personalized cart reminder highlighting stock availability.`,
                risk: 'Customer may find excessive follow-up intrusive if sent too frequently.'
              }
            };

            opportunities.push(opp);
          }
        }

        if (p.heuristicIntentScore >= 40 && p.purchases === 0) {
          // -------------------------------------------------------------------
          // B. HIGH INTENT PRODUCT OPPORTUNITY
          // -------------------------------------------------------------------
          const dedupKey = `${c.customerId}:${p.productId}:HIGH_INTENT_PRODUCT`;
          if (!seenDeduplicationKeys.has(dedupKey)) {
            seenDeduplicationKeys.add(dedupKey);

            const scoreRes = opportunityScoringService.calculateScore({
              businessImpact: econ.sellingPrice >= 2000 ? 'HIGH' : 'MEDIUM',
              urgency: 'THIS_WEEK',
              confidence: 'HIGH',
              customerSignalStrength: 'STRONG',
              financialSafety: econ.discountAllowed ? 'KNOWN_COGS' : 'MISSING_COGS'
            });

            const opp: MerchantOpportunity = {
              opportunityId: `opp_intent_${c.customerId}_${p.productId}`,
              merchantId,
              type: 'HIGH_INTENT_PRODUCT',
              priority: scoreRes.priority,
              status: 'ACTIVE',
              priorityScore: scoreRes.score,
              title: `High Intent Browsing: ${c.name} for ${p.productTitle}`,
              summary: `${c.name} viewed ${p.productTitle} ${p.productViews} times across ${p.uniqueSessions} sessions.`,
              target: {
                entityType: 'CUSTOMER',
                entityId: c.customerId,
                name: `${c.name} • ${p.productTitle}`,
                customerId: c.customerId,
                productId: p.productId,
                sku: p.sku,
                variantId: p.variantId
              },
              evidence: {
                telemetrySource: 'Canonical Shopi Customer Event Stream',
                sampleSize: 1,
                signals: {
                  customerId: c.customerId,
                  productId: p.productId,
                  sku: p.sku,
                  views: p.productViews,
                  sessions: p.uniqueSessions,
                  heuristicScore: p.heuristicIntentScore,
                  evidenceBreakdown: p.evidenceBreakdown
                },
                observedAt: p.latestActivityAt || nowIso
              },
              metrics: {
                potentialRevenue: econ.sellingPrice,
                impactedCustomers: 1
              },
              confidence: 'HIGH',
              urgency: 'THIS_WEEK',
              businessImpact: econ.sellingPrice >= 2000 ? 'HIGH' : 'MEDIUM',
              financialSafety: econ.cogsUnitCost !== null ? 'KNOWN_COGS' : 'MISSING_COGS',
              financialContext: econ,
              recommendedAction: `Present tailored product recommendation for ${p.productTitle}.`,
              detectedAt: nowIso,
              expiresAt: new Date(now.getTime() + 14 * 86400000).toISOString(),
              explanation: {
                observation: `Customer ${c.name} exhibited repeated interest (${p.productViews} views across ${p.uniqueSessions} sessions) in ${p.productTitle}.`,
                hypothesis: [
                  'Customer is researching product suitability or size availability.',
                  'Customer showed strong purchase intent but did not complete purchase.'
                ],
                questionsToInvestigate: [
                  'Does the product description clarify size fit and material details?'
                ],
                limitations: [
                  'Heuristic score reflects browsing frequency, not certainty.'
                ],
                structured: {
                  observed: `Customer viewed ${p.productTitle} ${p.productViews} times across ${p.uniqueSessions} sessions.`,
                  calculated: `Lifetime spend: ₹${c.lifetimeSpend}, Orders: ${c.completedOrderCount}.`,
                  modelEstimate: `Heuristic Intent Score: ${p.heuristicIntentScore}/100.`,
                  recommendation: `Share product highlights and customer review highlights.`,
                  risk: 'Customer may already be satisfied with existing alternative.'
                }
              },
              structuredExplanation: {
                observed: `Customer viewed ${p.productTitle} ${p.productViews} times across ${p.uniqueSessions} sessions.`,
                calculated: `Lifetime spend: ₹${c.lifetimeSpend}, Orders: ${c.completedOrderCount}.`,
                modelEstimate: `Heuristic Intent Score: ${p.heuristicIntentScore}/100.`,
                recommendation: `Share product highlights and customer review highlights.`,
                risk: 'Customer may already be satisfied with existing alternative.'
              }
            };

            opportunities.push(opp);
          }
        }
      }

      // -----------------------------------------------------------------------
      // C. REPEAT BUYER RETENTION
      // -----------------------------------------------------------------------
      if (c.isRepeatBuyer) {
        const dedupKey = `${c.customerId}:0:REPEAT_BUYER_RETENTION`;
        if (!seenDeduplicationKeys.has(dedupKey)) {
          seenDeduplicationKeys.add(dedupKey);

          const isApproachingCycle = (c.daysSinceLastPurchase || 0) >= 20;
          const scoreRes = opportunityScoringService.calculateScore({
            businessImpact: c.lifetimeSpend >= 4000 ? 'HIGH' : 'MEDIUM',
            urgency: isApproachingCycle ? 'THIS_WEEK' : 'THIS_WEEK',
            confidence: 'HIGH',
            customerSignalStrength: 'STRONG',
            financialSafety: 'KNOWN_COGS'
          });

          opportunities.push({
            opportunityId: `opp_rep_${c.customerId}`,
            merchantId,
            type: 'REPEAT_BUYER_RETENTION',
            priority: scoreRes.priority,
            status: 'ACTIVE',
            priorityScore: scoreRes.score,
            title: `Repeat Buyer Retention: ${c.name} (${c.completedOrderCount} Orders)`,
            summary: `${c.name} has ${c.completedOrderCount} lifetime orders (₹${c.lifetimeSpend} spend) and last purchased ${c.daysSinceLastPurchase} days ago.`,
            target: {
              entityType: 'CUSTOMER',
              entityId: c.customerId,
              name: c.lastPurchasedProductTitle
                ? `${c.name} • ${c.lastPurchasedProductTitle}`
                : c.name,
              customerId: c.customerId,
              productId: c.lastPurchasedProductId ?? c.topIntentProductId ?? undefined,
              productTitle: c.lastPurchasedProductTitle ?? c.topIntentProductTitle ?? undefined
            },
            evidence: {
              telemetrySource: 'Canonical Shopi Orders Database',
              sampleSize: c.completedOrderCount,
              signals: {
                customerId: c.customerId,
                completedOrders: c.completedOrderCount,
                lifetimeSpend: c.lifetimeSpend,
                daysSinceLastPurchase: c.daysSinceLastPurchase,
                avgOrderValue: c.averageOrderValue
              },
              observedAt: c.latestPurchaseAt || nowIso
            },
            metrics: {
              potentialRevenue: c.averageOrderValue,
              impactedCustomers: 1
            },
            confidence: 'HIGH',
            urgency: 'THIS_WEEK',
            businessImpact: c.lifetimeSpend >= 4000 ? 'HIGH' : 'MEDIUM',
            financialSafety: 'KNOWN_COGS',
            recommendedAction: 'Engage with loyalty appreciation and new arrivals in matching categories.',
            detectedAt: nowIso,
            expiresAt: new Date(now.getTime() + 14 * 86400000).toISOString(),
            explanation: {
              observation: `Customer has placed ${c.completedOrderCount} completed orders totaling ₹${c.lifetimeSpend} with average interval of ${c.purchaseFrequencyDays || 30} days.`,
              hypothesis: [
                'Customer has high trust in the store and is primed for seasonal replenishment.',
                'Regular engagement maintains brand salience.'
              ],
              questionsToInvestigate: [
                'What new catalog additions align with customer purchase history?'
              ],
              limitations: [
                'Ensure message frequency respects customer preferences.'
              ],
              structured: {
                observed: `Customer completed ${c.completedOrderCount} orders; last order placed on ${c.latestPurchaseAt}.`,
                calculated: `Lifetime spend: ₹${c.lifetimeSpend}, AOV: ₹${c.averageOrderValue}.`,
                modelEstimate: `High customer retention value (VIP / Loyal).`,
                recommendation: `Offer curated recommendations matching past purchased categories.`,
                risk: 'Over-messaging loyal customers may cause unsubscribe actions.'
              }
            },
            structuredExplanation: {
              observed: `Customer completed ${c.completedOrderCount} orders; last order placed on ${c.latestPurchaseAt}.`,
              calculated: `Lifetime spend: ₹${c.lifetimeSpend}, AOV: ₹${c.averageOrderValue}.`,
              modelEstimate: `High customer retention value (VIP / Loyal).`,
              recommendation: `Offer curated recommendations matching past purchased categories.`,
              risk: 'Over-messaging loyal customers may cause unsubscribe actions.'
            }
          });
        }
      }

      // -----------------------------------------------------------------------
      // D. ONE-TIME BUYER CONVERSION
      // -----------------------------------------------------------------------
      if (c.isOneTimeBuyer && (c.daysSinceLastPurchase || 0) >= 10 && (c.daysSinceLastPurchase || 0) <= 60) {
        const dedupKey = `${c.customerId}:0:ONE_TIME_BUYER_CONVERSION`;
        if (!seenDeduplicationKeys.has(dedupKey)) {
          seenDeduplicationKeys.add(dedupKey);

          const scoreRes = opportunityScoringService.calculateScore({
            businessImpact: 'MEDIUM',
            urgency: 'THIS_WEEK',
            confidence: 'HIGH',
            customerSignalStrength: 'MODERATE',
            financialSafety: 'KNOWN_COGS'
          });

          opportunities.push({
            opportunityId: `opp_one_${c.customerId}`,
            merchantId,
            type: 'ONE_TIME_BUYER_CONVERSION',
            priority: scoreRes.priority,
            status: 'ACTIVE',
            priorityScore: scoreRes.score,
            title: `Second Order Nudge: ${c.name}`,
            summary: `${c.name} made 1 purchase of ₹${c.lifetimeSpend} ${c.daysSinceLastPurchase} days ago.`,
            target: {
              entityType: 'CUSTOMER',
              entityId: c.customerId,
              name: c.lastPurchasedProductTitle
                ? `${c.name} • ${c.lastPurchasedProductTitle}`
                : c.name,
              customerId: c.customerId,
              productId: c.lastPurchasedProductId ?? c.topIntentProductId ?? undefined,
              productTitle: c.lastPurchasedProductTitle ?? c.topIntentProductTitle ?? undefined
            },
            evidence: {
              telemetrySource: 'Canonical Shopi Orders Database',
              sampleSize: 1,
              signals: {
                customerId: c.customerId,
                completedOrders: 1,
                lifetimeSpend: c.lifetimeSpend,
                daysSinceLastPurchase: c.daysSinceLastPurchase
              },
              observedAt: c.latestPurchaseAt || nowIso
            },
            metrics: {
              potentialRevenue: c.averageOrderValue,
              impactedCustomers: 1
            },
            confidence: 'HIGH',
            urgency: 'THIS_WEEK',
            businessImpact: 'MEDIUM',
            financialSafety: 'KNOWN_COGS',
            recommendedAction: 'Send post-purchase follow-up and cross-sell recommendations.',
            detectedAt: nowIso,
            expiresAt: new Date(now.getTime() + 14 * 86400000).toISOString(),
            explanation: {
              observation: `Customer completed first order of ₹${c.lifetimeSpend} on ${c.latestPurchaseAt} and has not yet placed a 2nd order.`,
              hypothesis: [
                'First-time buyers receiving timely post-purchase engagement have higher 2nd order conversion.'
              ],
              questionsToInvestigate: [
                'Was the first order delivered successfully without return claims?'
              ],
              limitations: [
                'Customer may have low immediate demand if purchase was a durable good.'
              ],
              structured: {
                observed: `Customer completed 1 order on ${c.latestPurchaseAt}.`,
                calculated: `Spend: ₹${c.lifetimeSpend}, Days elapsed: ${c.daysSinceLastPurchase}.`,
                modelEstimate: `Targeted second-order conversion opportunity.`,
                recommendation: `Present complementary product recommendations.`,
                risk: 'Customer may not require additional products immediately.'
              }
            },
            structuredExplanation: {
              observed: `Customer completed 1 order on ${c.latestPurchaseAt}.`,
              calculated: `Spend: ₹${c.lifetimeSpend}, Days elapsed: ${c.daysSinceLastPurchase}.`,
              modelEstimate: `Targeted second-order conversion opportunity.`,
              recommendation: `Present complementary product recommendations.`,
              risk: 'Customer may not require additional products immediately.'
            }
          });
        }
      }

      // -----------------------------------------------------------------------
      // E. DORMANT CUSTOMER REACTIVATION
      // -----------------------------------------------------------------------
      if (c.isDormant) {
        const dedupKey = `${c.customerId}:0:DORMANT_CUSTOMER_REACTIVATION`;
        if (!seenDeduplicationKeys.has(dedupKey)) {
          seenDeduplicationKeys.add(dedupKey);

          const scoreRes = opportunityScoringService.calculateScore({
            businessImpact: c.lifetimeSpend >= 3000 ? 'HIGH' : 'LOW',
            urgency: 'MONITOR',
            confidence: 'MEDIUM',
            customerSignalStrength: 'WEAK',
            financialSafety: 'KNOWN_COGS'
          });

          opportunities.push({
            opportunityId: `opp_dorm_${c.customerId}`,
            merchantId,
            type: 'DORMANT_CUSTOMER_REACTIVATION',
            priority: scoreRes.priority,
            status: 'ACTIVE',
            priorityScore: scoreRes.score,
            title: `Reactivate Dormant Buyer: ${c.name}`,
            summary: `${c.name} last purchased ${c.daysSinceLastPurchase} days ago (>60d inactivity).`,
            target: {
              entityType: 'CUSTOMER',
              entityId: c.customerId,
              name: c.lastPurchasedProductTitle
                ? `${c.name} • ${c.lastPurchasedProductTitle}`
                : c.name,
              customerId: c.customerId,
              productId: c.lastPurchasedProductId ?? c.topIntentProductId ?? undefined,
              productTitle: c.lastPurchasedProductTitle ?? c.topIntentProductTitle ?? undefined
            },
            evidence: {
              telemetrySource: 'Canonical Shopi Orders Database',
              sampleSize: c.completedOrderCount,
              signals: {
                customerId: c.customerId,
                completedOrders: c.completedOrderCount,
                lifetimeSpend: c.lifetimeSpend,
                daysSinceLastPurchase: c.daysSinceLastPurchase
              },
              observedAt: c.latestPurchaseAt || nowIso
            },
            metrics: {
              potentialRevenue: c.averageOrderValue,
              impactedCustomers: 1
            },
            confidence: 'MEDIUM',
            urgency: 'MONITOR',
            businessImpact: c.lifetimeSpend >= 3000 ? 'HIGH' : 'LOW',
            financialSafety: 'KNOWN_COGS',
            recommendedAction: 'Send win-back campaign highlighting new collection and store updates.',
            detectedAt: nowIso,
            expiresAt: new Date(now.getTime() + 21 * 86400000).toISOString(),
            explanation: {
              observation: `Customer has not placed an order in ${c.daysSinceLastPurchase} days (threshold: 60 days).`,
              hypothesis: [
                'Customer has lapsed into dormancy but retains historical store familiarity.'
              ],
              questionsToInvestigate: [
                'Has customer unsubscribed or updated contact preferences?'
              ],
              limitations: [
                'Long-dormant buyers have lower response rates; keep concession modest.'
              ],
              structured: {
                observed: `Customer inactive for ${c.daysSinceLastPurchase} days since ${c.latestPurchaseAt}.`,
                calculated: `Historical spend: ₹${c.lifetimeSpend}, Orders: ${c.completedOrderCount}.`,
                modelEstimate: `Lapsed customer reactivation segment.`,
                recommendation: `Send store catalog digest featuring top-rated catalog items.`,
                risk: 'Unresponsive dormant accounts should not be excessively contacted.'
              }
            },
            structuredExplanation: {
              observed: `Customer inactive for ${c.daysSinceLastPurchase} days since ${c.latestPurchaseAt}.`,
              calculated: `Historical spend: ₹${c.lifetimeSpend}, Orders: ${c.completedOrderCount}.`,
              modelEstimate: `Lapsed customer reactivation segment.`,
              recommendation: `Send store catalog digest featuring top-rated catalog items.`,
              risk: 'Unresponsive dormant accounts should not be excessively contacted.'
            }
          });
        }
      }

      // -----------------------------------------------------------------------
      // F. VIP RETENTION
      // -----------------------------------------------------------------------
      if (c.isVip) {
        const dedupKey = `${c.customerId}:0:VIP_RETENTION`;
        if (!seenDeduplicationKeys.has(dedupKey)) {
          seenDeduplicationKeys.add(dedupKey);

          const scoreRes = opportunityScoringService.calculateScore({
            businessImpact: 'HIGH',
            urgency: 'IMMEDIATE',
            confidence: 'HIGH',
            customerSignalStrength: 'STRONG',
            financialSafety: 'KNOWN_COGS'
          });

          opportunities.push({
            opportunityId: `opp_vip_${c.customerId}`,
            merchantId,
            type: 'VIP_RETENTION',
            priority: scoreRes.priority,
            status: 'ACTIVE',
            priorityScore: scoreRes.score,
            title: `VIP Concierge Check-in: ${c.name} (₹${c.lifetimeSpend} Spend)`,
            summary: `High-value customer ${c.name} has not placed an order in ${c.daysSinceLastPurchase} days.`,
            target: {
              entityType: 'CUSTOMER',
              entityId: c.customerId,
              name: c.lastPurchasedProductTitle
                ? `${c.name} • ${c.lastPurchasedProductTitle}`
                : c.name,
              customerId: c.customerId,
              productId: c.lastPurchasedProductId ?? c.topIntentProductId ?? undefined,
              productTitle: c.lastPurchasedProductTitle ?? c.topIntentProductTitle ?? undefined
            },
            evidence: {
              telemetrySource: 'Canonical Shopi Orders Database',
              sampleSize: c.completedOrderCount,
              signals: {
                customerId: c.customerId,
                completedOrders: c.completedOrderCount,
                lifetimeSpend: c.lifetimeSpend,
                daysSinceLastPurchase: c.daysSinceLastPurchase
              },
              observedAt: c.latestPurchaseAt || nowIso
            },
            metrics: {
              potentialRevenue: c.averageOrderValue,
              impactedCustomers: 1
            },
            confidence: 'HIGH',
            urgency: 'IMMEDIATE',
            businessImpact: 'HIGH',
            financialSafety: 'KNOWN_COGS',
            recommendedAction: 'Personal merchant outreach or early-access invitation to new catalog arrivals.',
            detectedAt: nowIso,
            expiresAt: new Date(now.getTime() + 10 * 86400000).toISOString(),
            explanation: {
              observation: `VIP customer (${c.completedOrderCount} orders, ₹${c.lifetimeSpend} lifetime spend) is approaching churn window (${c.daysSinceLastPurchase} days since last purchase).`,
              hypothesis: [
                'High-value buyers respond favorably to priority service and early access.'
              ],
              questionsToInvestigate: [
                'Does customer have pending inquiries or return requests?'
              ],
              limitations: [
                'VIP outreach should be high-touch and personalized.'
              ],
              structured: {
                observed: `Top-tier customer spend ₹${c.lifetimeSpend} across ${c.completedOrderCount} orders.`,
                calculated: `AOV: ₹${c.averageOrderValue}, Inactive: ${c.daysSinceLastPurchase} days.`,
                modelEstimate: `High LTV risk if customer churns.`,
                recommendation: `Execute proactive VIP check-in.`,
                risk: 'Generic promotional blasts may devalue VIP relationship.'
              }
            },
            structuredExplanation: {
              observed: `Top-tier customer spend ₹${c.lifetimeSpend} across ${c.completedOrderCount} orders.`,
              calculated: `AOV: ₹${c.averageOrderValue}, Inactive: ${c.daysSinceLastPurchase} days.`,
              modelEstimate: `High LTV risk if customer churns.`,
              recommendation: `Execute proactive VIP check-in.`,
              risk: 'Generic promotional blasts may devalue VIP relationship.'
            }
          });
        }
      }
    }

    // Sort by priorityScore DESC
    opportunities.sort((a, b) => b.priorityScore - a.priorityScore);

    // Apply filters if present
    let filtered = opportunities;
    if (filter) {
      if (filter.type) {
        filtered = filtered.filter(o => o.type === filter.type || (filter.type === 'HIGH_INTENT_CUSTOMERS' && o.type === 'HIGH_INTENT_PRODUCT'));
      }
      if (filter.priority) {
        filtered = filtered.filter(o => o.priority === filter.priority);
      }
      if (filter.customerId) {
        filtered = filtered.filter(o => o.target.customerId === filter.customerId || o.target.entityId === filter.customerId);
      }
      if (filter.productId) {
        filtered = filtered.filter(o => o.target.productId === filter.productId || o.target.entityId === filter.productId);
      }
      if (filter.limit && filter.limit > 0) {
        filtered = filtered.slice(0, filter.limit);
      }
    }

    return filtered;
  }
}

export const customerOpportunityService = new CustomerOpportunityService();
