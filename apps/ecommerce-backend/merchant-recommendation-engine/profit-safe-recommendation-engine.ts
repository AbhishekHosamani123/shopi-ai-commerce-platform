import { client } from '../data/DB';
import { MerchantOpportunity } from '../merchant-opportunity-engine/opportunity-types';
import { merchantOpportunityEngine } from '../merchant-opportunity-engine/opportunity-engine';
import {
  ProfitSafeRecommendation,
  RecommendationType,
  RecommendationListFilter,
  IncentiveOption,
  ExpectedImpactEstimate,
  RecommendationExplanation
} from './recommendation-types';
import { financialSafetyCalculator } from './financial-safety-calculator';
import { financialPolicyService } from './financial-policy-service';

export class ProfitSafeRecommendationEngine {
  /**
   * Generates profit-safe, explainable recommendations for all active merchant opportunities.
   */
  async generateRecommendations(
    merchantId: string = 'default_merchant',
    filter?: RecommendationListFilter
  ): Promise<ProfitSafeRecommendation[]> {
    const opportunities = await merchantOpportunityEngine.discoverOpportunities(merchantId);
    const recommendations: ProfitSafeRecommendation[] = [];

    for (const opp of opportunities) {
      const rec = await this.generateRecommendationForOpportunity(opp, merchantId);
      if (rec) {
        recommendations.push(rec);
      }
    }

    // Rank recommendations primarily by expected net contribution profit and secondarily by priority score
    recommendations.sort((a, b) => {
      const profitDeltaA = a.expectedImpact.simulatedNetContributionProfitDelta;
      const profitDeltaB = b.expectedImpact.simulatedNetContributionProfitDelta;
      if (profitDeltaA !== profitDeltaB) {
        return profitDeltaB - profitDeltaA;
      }
      return b.priorityScore - a.priorityScore;
    });

    let filtered = recommendations;
    if (filter?.type) filtered = filtered.filter(r => r.type === filter.type);
    if (filter?.status) filtered = filtered.filter(r => r.status === filter.status);
    if (filter?.confidence) filtered = filtered.filter(r => r.confidence === filter.confidence);
    if (filter?.limit) filtered = filtered.slice(0, filter.limit);

    return filtered;
  }

  /**
   * Translates a single opportunity into a profit-safe, evidence-backed recommendation.
   */
  async generateRecommendationForOpportunity(
    opp: MerchantOpportunity,
    merchantId: string = 'default_merchant'
  ): Promise<ProfitSafeRecommendation | null> {
    const nowIso = new Date().toISOString();
    const expiryIso = new Date(Date.now() + 7 * 86400000).toISOString();
    const isCustomerTarget = opp.target.entityType === 'CUSTOMER' || opp.target.entityType === 'CUSTOMER_SEGMENT';
    const customerName = isCustomerTarget
      ? (opp.target.name && opp.target.name.includes(' • ') ? opp.target.name.split(' • ')[0].trim() : opp.target.name)
      : undefined;
    const customerId = isCustomerTarget ? String(opp.target.customerId || opp.target.entityId) : undefined;
    
    // Resolve product ID: either direct number entityId or opp.target.productId
    const pid = typeof opp.target.entityId === 'number' ? opp.target.entityId : (opp.target.productId || null);
    let productTitle = !isCustomerTarget
      ? opp.target.name
      : (opp.target.name && opp.target.name.includes(' • ') ? opp.target.name.split(' • ')[1].trim() : (opp.target.productTitle || undefined));
    let sku = opp.target.sku;

    // 1. Fetch Product State & Verified COGS
    let price = 1999;
    let stock = 100;
    let unitCogs: number | null = null;
    let cogsStatus = opp.financialSafety;

    let unitShipping: number | undefined;
    let unitHandling: number | undefined;

    if (pid) {
      const pRes = await client.query(`
        SELECT p.product_id, p.sku, p.title, p.selling_price as price, p.stock_quantity as stock, c.total_unit_cost as unit_cost, c.unit_shipping_cost as shipping_cost, c.unit_packaging_cost as handling_cost 
        FROM shopi_products p
        LEFT JOIN shopi_product_cogs c ON p.product_id = c.product_id
        WHERE p.product_id = $1;
      `, [pid]);

      if (pRes.rows.length > 0) {
        const row = pRes.rows[0];
        price = parseFloat(row.price || '1999');
        stock = parseInt(row.stock || '100', 10);
        productTitle = row.title;
        sku = row.sku || sku;
        if (row.unit_cost !== null) {
          unitCogs = parseFloat(row.unit_cost);
          cogsStatus = 'KNOWN_COGS';
        }
        if (row.shipping_cost !== null && row.shipping_cost !== undefined) {
          unitShipping = parseFloat(row.shipping_cost);
        }
        if (row.handling_cost !== null && row.handling_cost !== undefined) {
          unitHandling = parseFloat(row.handling_cost);
        }
      }
    }

    const itemSubject = productTitle || (isCustomerTarget ? 'saved cart items' : (opp.target.name || 'Catalog Product'));

    // 2. Resolve Effective Financial Policy (Merchant Override vs System Default)
    const effectivePolicy = await financialPolicyService.getEffectivePolicy(merchantId);

    // 3. Compute Financial Safety, Margin Floor, and Lower-of-Two Discount Ceiling
    const financials = financialSafetyCalculator.analyzeProductFinancials({
      sellingPrice: price,
      cogs: unitCogs,
      cogsStatus,
      shippingCost: unitShipping,
      handlingCost: unitHandling,
      policy: effectivePolicy
    });

    let recType: RecommendationType = 'TARGETED_CUSTOMER_INCENTIVE';
    let actionType: 'INCENTIVE_CAMPAIGN' | 'RESTOCK' | 'MARKDOWN' | 'CONTENT_CORRECTION' | 'MERCHANDISING' | 'MONITOR_ONLY' = 'INCENTIVE_CAMPAIGN';
    let summary = '';
    let suggestedIncentive: IncentiveOption | undefined;
    let suggestedRestockUnits: number | undefined;
    let suggestedMarkdownPct: number | undefined;
    let recommendedChannel: 'STOREFRONT_POPUP' | 'CART_BANNER' | 'CATALOG_BADGE' | 'INTERNAL_TASK' = 'CART_BANNER';

    const alternativeOptions: IncentiveOption[] = [];
    const audienceCount = opp.metrics.impactedCustomers || opp.metrics.unitsAtRisk || 10;

    // =========================================================================
    // CASE A: INVENTORY CONFLICT & STOCKOUT RISKS (Rule 21 & Part 8)
    // =========================================================================
    if (opp.type === 'STOCKOUT_RISK' || opp.type === 'HIGH_DEMAND_LOW_STOCK' || stock <= 10) {
      recType = opp.type === 'STOCKOUT_RISK' ? 'STOCKOUT_PREVENTION_RESTOCK' : 'INVENTORY_REPLENISHMENT';
      actionType = 'RESTOCK';
      suggestedRestockUnits = Math.max(50, Math.round((opp.metrics.unitsAtRisk || 60) * 1.5));
      recommendedChannel = 'INTERNAL_TASK';
      summary = `Prioritize supplier replenishment order for ${suggestedRestockUnits} units of "${itemSubject}". Prohibit promotional price discounts while stock is critically low.`;

      // Non-discount alternative
      const noIncentiveOpt = financialSafetyCalculator.evaluateCandidateOption(
        'opt_restock_only',
        'Replenish Stock Only (Zero Discount)',
        'NO_INCENTIVE',
        0,
        financials,
        'Demand is strong. Maintain full selling price and reorder inventory to avoid lost sales.'
      );
      noIncentiveOpt.isRecommended = true;
      suggestedIncentive = noIncentiveOpt;
      alternativeOptions.push(noIncentiveOpt);
    }
    // =========================================================================
    // CASE B: RETURN PROBLEMS (Part 23)
    // =========================================================================
    else if (opp.type === 'RETURN_PROBLEM') {
      recType = 'RETURN_ROOT_CAUSE_CORRECTION';
      actionType = 'CONTENT_CORRECTION';
      recommendedChannel = 'INTERNAL_TASK';
      summary = `Audit and update size chart, high-res fit imagery, and specifications for "${itemSubject}". Do NOT offer discounts to resolve returns.`;

      const noDiscountOpt = financialSafetyCalculator.evaluateCandidateOption(
        'opt_fix_content',
        'Update Sizing Guide & Product Information',
        'NO_INCENTIVE',
        0,
        financials,
        'Address return root-cause directly. Sizing adjustments protect contribution margin far more than price reductions.'
      );
      noDiscountOpt.isRecommended = true;
      suggestedIncentive = noDiscountOpt;
      alternativeOptions.push(noDiscountOpt);
    }
    // =========================================================================
    // CASE C: HIGH MARGIN CHAMPION (Part 24)
    // =========================================================================
    else if (opp.type === 'HIGH_MARGIN_WINNER') {
      recType = 'HIGH_MARGIN_MERCHANDISING';
      actionType = 'MERCHANDISING';
      recommendedChannel = 'CATALOG_BADGE';
      summary = `Increase storefront prominence and add featured badges for "${itemSubject}". Capitalize on ${financials.currentMarginPct || 50}% gross margin without discounting.`;

      const featureOpt = financialSafetyCalculator.evaluateCandidateOption(
        'opt_merchandising',
        'Featured Catalog Placement & Cross-Sell Pairing',
        'NO_INCENTIVE',
        0,
        financials,
        'Maximize contribution by routing organic traffic to high-margin SKUs without eroding price.'
      );
      featureOpt.isRecommended = true;
      suggestedIncentive = featureOpt;
      alternativeOptions.push(featureOpt);
    }
    // =========================================================================
    // CASE D: DEAD STOCK LIQUIDATION (Part 22)
    // =========================================================================
    else if (opp.type === 'DEAD_STOCK') {
      recType = 'DEAD_STOCK_MARKDOWN';
      actionType = 'MARKDOWN';
      suggestedMarkdownPct = Math.min(25, Math.floor((financials.maxSafeDiscount / price) * 100) || 15);
      recommendedChannel = 'STOREFRONT_POPUP';
      summary = `Apply a controlled ${suggestedMarkdownPct}% clearance markdown on "${itemSubject}" to unlock ₹${(opp.metrics.deadStockCapitalTiedUp || 50000).toLocaleString()} in trapped working capital.`;

      const optMarkdown = financialSafetyCalculator.evaluateCandidateOption(
        'opt_clearance_markdown',
        `Clearance Markdown (${suggestedMarkdownPct}% Off)`,
        'PERCENTAGE_DISCOUNT',
        suggestedMarkdownPct,
        financials
      );
      const optNoDisc = financialSafetyCalculator.evaluateCandidateOption(
        'opt_clearance_hold',
        'Hold Full Price & Bundle with Fast Seller',
        'NO_INCENTIVE',
        0,
        financials
      );

      suggestedIncentive = optMarkdown.isMarginFloorPreserved ? optMarkdown : optNoDisc;
      alternativeOptions.push(optMarkdown, optNoDisc);
    }
    // =========================================================================
    // CASE E: VIP RETENTION & CUSTOMER CHURN (Part 2 & 12)
    // =========================================================================
    else if (opp.type === 'VIP_AT_RISK') {
      recType = 'VIP_RETENTION_REWARD';
      actionType = 'INCENTIVE_CAMPAIGN';
      recommendedChannel = 'CART_BANNER';
      summary = isCustomerTarget && customerName
        ? `Offer an exclusive ₹250 VIP loyalty appreciation reward on orders over ₹1,500 to retain VIP customer ${customerName}.`
        : `Offer an exclusive ₹250 VIP loyalty appreciation reward on orders over ₹1,500 to retain ${audienceCount} high-lifetime-value customers.`;

      const optVip = financialSafetyCalculator.evaluateCandidateOption(
        'opt_vip_reward',
        '₹250 VIP Loyalty Voucher (Min Order ₹1,500)',
        'FIXED_AMOUNT_DISCOUNT',
        250,
        financials
      );
      const optVipPoints = financialSafetyCalculator.evaluateCandidateOption(
        'opt_vip_appreciation',
        'Personalized Appreciation & Early Catalog Access (Zero Discount)',
        'NO_INCENTIVE',
        0,
        financials
      );

      suggestedIncentive = optVip.isMarginFloorPreserved ? optVip : optVipPoints;
      alternativeOptions.push(optVip, optVipPoints);
    }
    // =========================================================================
    // CASE F: HIGH INTENT CUSTOMERS / CART / CHECKOUT ABANDONMENT (Part 10, 11, 13)
    // =========================================================================
    else {
      recType = 'TARGETED_CUSTOMER_INCENTIVE';
      actionType = 'INCENTIVE_CAMPAIGN';
      recommendedChannel = 'CART_BANNER';

      // 3 Multi-Option Candidates:
      // Option 1: 10% Targeted Discount (if safe)
      const safeDiscountPct = Math.min(10, Math.floor((financials.maxSafeDiscount / price) * 100));
      const opt10 = financialSafetyCalculator.evaluateCandidateOption(
        'opt_targeted_10pct',
        `Targeted ${safeDiscountPct}% Off for Active Browsers`,
        'PERCENTAGE_DISCOUNT',
        safeDiscountPct > 0 ? safeDiscountPct : 5,
        financials
      );

      // Option 2: Fixed ₹100 Voucher
      const opt100 = financialSafetyCalculator.evaluateCandidateOption(
        'opt_fixed_100',
        '₹100 Abandoned Cart Recovery Voucher',
        'FIXED_AMOUNT_DISCOUNT',
        100,
        financials
      );

      // Option 3: Zero Discount
      const optZero = financialSafetyCalculator.evaluateCandidateOption(
        'opt_no_discount',
        isCustomerTarget
          ? 'Personalized Cart & Stock Assistance Reminder (Zero Discount)'
          : 'Social Proof & Low-Stock Notification (Zero Discount)',
        'NO_INCENTIVE',
        0,
        financials,
        isCustomerTarget
          ? 'Provide personalized assistance and stock reservation guarantee without price concessions.'
          : 'Display live viewer count and fast shipping guarantee without price concessions.'
      );

      alternativeOptions.push(opt10, opt100, optZero);

      // Pick the best profit-safe option
      if (opt10.isMarginFloorPreserved && safeDiscountPct >= 5) {
        suggestedIncentive = opt10;
        summary = isCustomerTarget && customerName
          ? `Deliver a targeted ${safeDiscountPct}% incentive to ${customerName} for "${itemSubject}". Projected contribution of ₹${opt10.projectedContribution} safely protects the ₹${financials.minAllowedContribution} margin floor.`
          : `Deliver a targeted ${safeDiscountPct}% incentive to ${audienceCount} high-intent prospects for "${itemSubject}". Projected contribution of ₹${opt10.projectedContribution} safely protects the ₹${financials.minAllowedContribution} margin floor.`;
      } else if (opt100.isMarginFloorPreserved) {
        suggestedIncentive = opt100;
        summary = isCustomerTarget && customerName
          ? `Offer a ₹100 recovery incentive to ${customerName} for "${itemSubject}". Contribution remains safely at ₹${opt100.projectedContribution}.`
          : `Offer a ₹100 recovery incentive to ${audienceCount} prospects for "${itemSubject}". Contribution remains safely at ₹${opt100.projectedContribution}.`;
      } else {
        suggestedIncentive = optZero;
        summary = isCustomerTarget && customerName
          ? `Dispatch personalized cart & stock assistance reminder for ${customerName} regarding "${itemSubject}". Discounting is blocked to protect the merchant margin floor.`
          : `Deploy social proof and stock badges for "${itemSubject}". Discounting is blocked to protect the merchant margin floor.`;
      }
    }

    // =========================================================================
    // 3. FINANCIAL SIMULATION & INCREMENTAL PROFIT IMPACT (Part 16, 17, 18)
    // =========================================================================
    const discountPerUnit = suggestedIncentive && suggestedIncentive.incentiveType !== 'NO_INCENTIVE'
      ? Math.max(0, price - suggestedIncentive.projectedSellingPrice)
      : 0;

    const estConvLiftPct = suggestedIncentive && suggestedIncentive.incentiveType !== 'NO_INCENTIVE' ? 22.0 : 8.0;
    const simIncrementalOrders = Math.max(1, Math.round(audienceCount * (estConvLiftPct / 100)));
    const simGrossRevDelta = Math.round(simIncrementalOrders * (price - discountPerUnit));
    const simDiscountCost = Math.round(simIncrementalOrders * discountPerUnit);
    const unitCogsApplied = financials.cogs !== null ? financials.cogs : Math.round(price * 0.5);
    const unitFulfillment = financials.unitShipping + financials.unitHandling;
    const simVarCost = Math.round(simIncrementalOrders * (unitCogsApplied + unitFulfillment));
    const simReturnCost = Math.round(simGrossRevDelta * 0.04); // 4% baseline return provision
    const simNetProfit = Math.max(0, Math.round(simGrossRevDelta - simDiscountCost - simVarCost - simReturnCost));

    const expectedImpact: ExpectedImpactEstimate = {
      targetAudienceCount: audienceCount,
      observedBaselineMetric: `${audienceCount} observed prospects / units from real database telemetry`,
      modelEstimatedConversionLiftPct: estConvLiftPct,
      simulatedIncrementalOrders: simIncrementalOrders,
      simulatedGrossRevenueDelta: simGrossRevDelta,
      simulatedDiscountCost: simDiscountCost,
      simulatedIncrementalVariableCost: simVarCost,
      simulatedReturnRiskCost: simReturnCost,
      simulatedNetContributionProfitDelta: simNetProfit
    };

    // =========================================================================
    // 4. STRUCTURED EXPLAINABILITY (Part 27)
    // =========================================================================
    const explanation: RecommendationExplanation = {
      observation: isCustomerTarget
        ? `Detected ${opp.type} for customer ${customerName || 'prospect'} regarding "${itemSubject}" backed by real telemetry in ${opp.evidence.telemetrySource}.`
        : `Detected ${opp.type} on "${itemSubject}" backed by real telemetry in ${opp.evidence.telemetrySource}.`,
      proposedActionRationale: summary,
      whyThisOptionChosen: suggestedIncentive?.isMarginFloorPreserved
        ? `Option "${suggestedIncentive.name}" maximizes incremental contribution (₹${simNetProfit}) while preserving the ₹${financials.minAllowedContribution} minimum margin floor.`
        : `Non-discount option selected because price discounts violate the merchant's contribution margin floor.`,
      whatAlternativesConsidered: alternativeOptions.map(o => `${o.name}: ${o.rationale}`),
      financialTradeoff: `Selling Price: ₹${price} | Total Variable Cost: ₹${financials.totalVariableCost} | Minimum Margin Floor: ₹${financials.minAllowedContribution} (${financials.policySource}) | Max Safe Discount: ₹${financials.maxSafeDiscount} (Financial Headroom: ₹${financials.financiallySafeDiscount}, Merchant Max Cap: ₹${financials.merchantMaxDiscount}).`,
      risksAndDrawbacks: [
        'A portion of prospective buyers might convert organically without promotional incentives (baseline cannibalization).',
        'Customer demand elasticity is assumed stable over a 14-day promotional window.'
      ],
      keyAssumptions: [
        `Fulfillment cost estimated at standard ₹${financials.unitShipping} shipping + ₹${financials.unitHandling} packaging.`,
        'Return rate provision modeled at standard 4% catalog baseline.'
      ],
      dataLimitations: financials.cogsStatus === 'KNOWN_COGS'
        ? ['Grounded in verified supplier COGS ledger.']
        : ['COGS is estimated or unmapped; discount ceiling is clamped conservatively.']
    };

    return {
      recommendationId: `rec_${opp.opportunityId}`,
      opportunityId: opp.opportunityId,
      merchantId,
      type: recType,
      status: 'READY_FOR_REVIEW',
      priorityScore: opp.priorityScore,
      target: {
        entityType: opp.target.entityType,
        entityId: opp.target.entityId,
        name: isCustomerTarget ? (customerName || opp.target.name) : (productTitle || opp.target.name),
        scope: isCustomerTarget ? 'TARGETED' : 'PRODUCT_LEVEL',
        customerId,
        customerName,
        productId: pid || undefined,
        productTitle,
        sku: sku || opp.target.sku
      },
      proposedAction: {
        actionType,
        summary,
        suggestedIncentive,
        suggestedRestockUnits,
        suggestedMarkdownPct,
        recommendedChannel
      },
      alternativeOptions,
      financialAnalysis: financials,
      expectedImpact,
      confidence: opp.confidence,
      staleCheck: {
        snapshotPrice: price,
        snapshotStock: stock,
        snapshotCogs: unitCogs,
        isStale: false
      },
      explanation,
      createdAt: nowIso,
      expiresAt: expiryIso
    };
  }

  /**
   * Retrieves single recommendation by ID with on-the-fly freshness revalidation.
   */
  async getRecommendationById(
    recommendationId: string,
    merchantId: string = 'default_merchant'
  ): Promise<ProfitSafeRecommendation | null> {
    const all = await this.generateRecommendations(merchantId);
    const rec = all.find(r => r.recommendationId === recommendationId);
    if (!rec) return null;

    // Check data freshness
    if (typeof rec.target.entityId === 'number') {
      const pRes = await client.query('SELECT selling_price as price, stock_quantity as stock FROM shopi_products WHERE product_id = $1', [rec.target.entityId]);
      if (pRes.rows.length > 0) {
        const livePrice = parseFloat(pRes.rows[0].price);
        const liveStock = parseInt(pRes.rows[0].stock, 10);
        if (Math.abs(livePrice - rec.staleCheck.snapshotPrice) > 1.0 || Math.abs(liveStock - rec.staleCheck.snapshotStock) >= 20) {
          rec.status = 'STALE_REQUIRES_RECALCULATION';
          rec.staleCheck.isStale = true;
          rec.staleCheck.staleReason = `Underlying catalog data changed: Live stock is ${liveStock} (snapshot ${rec.staleCheck.snapshotStock}), Live price is ₹${livePrice} (snapshot ₹${rec.staleCheck.snapshotPrice}).`;
        }
      }
    }

    return rec;
  }
}

export const profitSafeRecommendationEngine = new ProfitSafeRecommendationEngine();
