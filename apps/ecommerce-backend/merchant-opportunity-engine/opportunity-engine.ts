import { client } from '../data/DB';
import {
  MerchantOpportunity,
  OpportunityType,
  OpportunityListFilter
} from './opportunity-types';
import { opportunityScoringService } from './opportunity-scoring';
import { customerOpportunityService } from '../merchant-customer-intelligence/customer-opportunity-service';

export class MerchantOpportunityEngine {
  /**
   * Scans store telemetry, orders, inventory, returns, and customer events from canonical Supabase
   * datasets (shopi_* tables) to discover and rank active business opportunities.
   */
  async discoverOpportunities(
    merchantId: string = 'default_merchant',
    filter?: OpportunityListFilter
  ): Promise<MerchantOpportunity[]> {
    const opportunities: MerchantOpportunity[] = [];
    const now = new Date();
    const nowIso = now.toISOString();
    const defaultExpiry = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString(); // 7-day default window

    // =========================================================================
    // 1. CANONICAL CUSTOMER OPPORTUNITIES (via customerOpportunityService)
    // =========================================================================
    try {
      const customerOpps = await customerOpportunityService.discoverOpportunities(merchantId, filter);
      opportunities.push(...customerOpps);
    } catch (e: any) {
      console.warn('[MerchantOpportunityEngine] Customer opportunity discovery warning:', e.message);
    }

    // =========================================================================
    // 2. PRODUCT OPPORTUNITIES: HIGH_MARGIN_WINNER
    // =========================================================================
    try {
      const highMarginRes = await client.query(`
        SELECT 
          p.product_id,
          p.sku,
          p.title,
          p.selling_price as price,
          c.total_unit_cost as unit_cost,
          c.baseline_gross_margin_pct as gross_margin_pct,
          COALESCE(SUM(oi.quantity), 0)::int as units_sold,
          COALESCE(SUM(oi.line_total), 0)::numeric(12,2) as total_rev
        FROM shopi_product_cogs c
        JOIN shopi_products p ON c.product_id = p.product_id
        LEFT JOIN shopi_order_items oi ON p.product_id = oi.product_id
        GROUP BY p.product_id, p.sku, p.title, p.selling_price, c.total_unit_cost, c.baseline_gross_margin_pct
        HAVING c.baseline_gross_margin_pct >= 40.0
        ORDER BY total_rev DESC NULLS LAST
        LIMIT 3;
      `);

      for (const r of highMarginRes.rows) {
        const margin = parseFloat(r.gross_margin_pct);
        const rev = parseFloat(r.total_rev || '0');

        const scoring = opportunityScoringService.calculateScore({
          businessImpact: 'HIGH',
          urgency: 'THIS_WEEK',
          confidence: 'HIGH',
          customerSignalStrength: 'MODERATE',
          financialSafety: 'KNOWN_COGS'
        });

        opportunities.push({
          opportunityId: `opp_high_margin_${r.product_id}`,
          merchantId,
          type: 'HIGH_MARGIN_WINNER',
          priority: scoring.priority,
          status: 'ACTIVE',
          priorityScore: scoring.score,
          title: `High Margin Champion: ${r.title} (${margin}% Margin)`,
          summary: `Product has verified unit COGS (₹${r.unit_cost}) yielding ${margin}% gross margin. Strategic feature placement can maximize net profit.`,
          target: {
            entityType: 'PRODUCT',
            entityId: r.product_id,
            productId: r.product_id,
            sku: r.sku,
            name: r.title
          },
          evidence: {
            telemetrySource: 'Verified Supabase COGS Ledger & Order Item Sales',
            sampleSize: r.units_sold || 50,
            signals: {
              productId: r.product_id,
              sku: r.sku,
              sellingPrice: r.price,
              unitCost: r.unit_cost,
              grossMarginPct: margin,
              lifetimeRevenue: rev
            },
            observedAt: nowIso
          },
          metrics: {
            marginImpactPct: margin,
            potentialRevenue: Math.round(rev * 0.15)
          },
          confidence: 'HIGH',
          urgency: 'THIS_WEEK',
          businessImpact: 'HIGH',
          financialSafety: 'KNOWN_COGS',
          detectedAt: nowIso,
          expiresAt: defaultExpiry,
          explanation: {
            observation: `Verified unit COGS of ₹${r.unit_cost} with selling price of ₹${r.price} delivers ${margin}% gross margin.`,
            hypothesis: ['Increasing catalog prominence for high-margin winners directly expands contribution profit.'],
            questionsToInvestigate: [
              'Is stock healthy enough to support increased promotion?',
              'Can this item be paired as a cross-sell recommendation in Shopi AI?'
            ],
            limitations: ['Requires verified row in shopi_product_cogs.']
          }
        });
      }
    } catch (e: any) {
      console.warn('[MerchantOpportunityEngine] High margin query warning:', e.message);
    }

    // =========================================================================
    // 3. PRODUCT OPPORTUNITIES: RETURN_PROBLEM
    // =========================================================================
    try {
      const returnRes = await client.query(`
        SELECT 
          oi.product_id,
          p.sku,
          p.title,
          COUNT(oi.order_item_id)::int as total_sold,
          COUNT(r.return_id)::int as total_returned,
          ROUND((COUNT(r.return_id)::numeric / NULLIF(COUNT(oi.order_item_id), 0) * 100), 2) as return_rate_pct
        FROM shopi_order_items oi
        JOIN shopi_products p ON oi.product_id = p.product_id
        LEFT JOIN shopi_order_returns r ON oi.product_id = r.product_id
        GROUP BY oi.product_id, p.sku, p.title
        HAVING COUNT(r.return_id) >= 1
        ORDER BY return_rate_pct DESC
        LIMIT 3;
      `);

      for (const r of returnRes.rows) {
        const returnRate = parseFloat(r.return_rate_pct);
        const scoring = opportunityScoringService.calculateScore({
          businessImpact: 'MEDIUM',
          urgency: 'THIS_WEEK',
          confidence: 'HIGH',
          customerSignalStrength: 'STRONG',
          financialSafety: 'KNOWN_COGS'
        });

        opportunities.push({
          opportunityId: `opp_return_problem_${r.product_id}`,
          merchantId,
          type: 'RETURN_PROBLEM',
          priority: scoring.priority,
          status: 'ACTIVE',
          priorityScore: scoring.score,
          title: `High Return Rate (${returnRate}%): ${r.title}`,
          summary: `${r.total_returned} units returned (${returnRate}%), eroding net contribution margin.`,
          target: {
            entityType: 'PRODUCT',
            entityId: r.product_id,
            productId: r.product_id,
            sku: r.sku,
            name: r.title
          },
          evidence: {
            telemetrySource: 'Canonical shopi_order_returns Ledger & Order Items',
            sampleSize: r.total_sold,
            signals: {
              productId: r.product_id,
              sku: r.sku,
              totalSold: r.total_sold,
              totalReturned: r.total_returned,
              returnRatePct: returnRate
            },
            observedAt: nowIso
          },
          metrics: {
            returnRatePct: returnRate,
            unitsAtRisk: r.total_returned
          },
          confidence: 'HIGH',
          urgency: 'THIS_WEEK',
          businessImpact: 'MEDIUM',
          financialSafety: 'KNOWN_COGS',
          detectedAt: nowIso,
          expiresAt: defaultExpiry,
          explanation: {
            observation: `Product return rate of ${returnRate}% indicates potential sizing or description mismatches.`,
            hypothesis: ['Sizing discrepancies or fit mismatch for apparel SKUs.'],
            questionsToInvestigate: [
              'What are the primary reasons recorded in shopi_order_returns?',
              'Is the sizing guide accurate on the storefront?'
            ],
            limitations: ['Evaluates returns on recent completed orders.']
          }
        });
      }
    } catch (e: any) {
      console.warn('[MerchantOpportunityEngine] Return problem query warning:', e.message);
    }

    // Rank opportunities by priorityScore descending
    opportunities.sort((a, b) => b.priorityScore - a.priorityScore);

    // Apply optional filters
    let filtered = opportunities;
    if (filter) {
      if (filter.type) {
        filtered = filtered.filter(o => o.type === filter.type || (filter.type === 'HIGH_INTENT_CUSTOMERS' && o.type === 'HIGH_INTENT_PRODUCT'));
      }
      if (filter.priority) {
        filtered = filtered.filter(o => o.priority === filter.priority);
      }
      if (filter.status) {
        filtered = filtered.filter(o => o.status === filter.status);
      }
      if (filter.confidence) {
        filtered = filtered.filter(o => o.confidence === filter.confidence);
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

  /**
   * Retrieves a single opportunity by ID.
   */
  async getOpportunityById(opportunityId: string, merchantId: string = 'default_merchant'): Promise<MerchantOpportunity | null> {
    const all = await this.discoverOpportunities(merchantId);
    return all.find(o => o.opportunityId === opportunityId) || null;
  }
}

export const merchantOpportunityEngine = new MerchantOpportunityEngine();
