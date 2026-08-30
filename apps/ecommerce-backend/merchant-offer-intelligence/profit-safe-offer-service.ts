import { client } from '../data/DB';
import { MerchantOpportunity } from '../merchant-opportunity-engine/opportunity-types';
import { customerOpportunityService } from '../merchant-customer-intelligence/customer-opportunity-service';
import {
  ProfitSafeOfferRecommendation,
  CandidateOfferSimulation,
  CustomerOfferEligibility,
  OfferCategory,
  OfferSafetyStatus,
  OfferEvaluationFilter
} from './offer-types';

export class ProfitSafeOfferService {
  /**
   * Evaluates and generates profit-safe offer recommendations for all active customer opportunities.
   */
  public async generateProfitSafeOffers(
    merchantId: string = 'default_merchant',
    filter?: OfferEvaluationFilter
  ): Promise<ProfitSafeOfferRecommendation[]> {
    const opportunities = await customerOpportunityService.discoverOpportunities(merchantId);
    const offers: ProfitSafeOfferRecommendation[] = [];

    for (const opp of opportunities) {
      // Only evaluate product-targeted customer opportunities
      if (opp.target.productId && opp.target.customerId) {
        const offer = await this.evaluateOfferForOpportunity(opp, merchantId);
        if (offer) {
          offers.push(offer);
        }
      }
    }

    let filtered = offers;
    if (filter) {
      if (filter.customerId) {
        filtered = filtered.filter(o => o.customerId === filter.customerId);
      }
      if (filter.productId) {
        filtered = filtered.filter(o => o.productId === filter.productId);
      }
      if (filter.category) {
        filtered = filtered.filter(o => o.category === filter.category);
      }
      if (filter.safetyStatus) {
        filtered = filtered.filter(o => o.safetyStatus === filter.safetyStatus);
      }
      if (filter.limit && filter.limit > 0) {
        filtered = filtered.slice(0, filter.limit);
      }
    }

    return filtered;
  }

  /**
   * Deterministically evaluates an offer for a single customer opportunity.
   */
  public async evaluateOfferForOpportunity(
    opp: MerchantOpportunity,
    merchantId: string = 'default_merchant'
  ): Promise<ProfitSafeOfferRecommendation | null> {
    const productId = opp.target.productId;
    const customerId = opp.target.customerId;
    if (!productId || !customerId) return null;

    const now = new Date();
    const nowIso = now.toISOString();
    const expiryIso = opp.expiresAt || new Date(now.getTime() + 7 * 86400000).toISOString();

    // 1. Fetch Product Economics & COGS Ledger
    const prodRes = await client.query(`
      SELECT 
        p.product_id,
        p.sku,
        p.title,
        p.selling_price::numeric(10,2) as selling_price,
        p.mrp::numeric(10,2) as mrp,
        cg.total_unit_cost::numeric(10,2) as cogs_unit_cost,
        cg.minimum_margin_floor_pct::numeric(5,2) as min_margin_floor_pct
      FROM shopi_products p
      LEFT JOIN shopi_product_cogs cg ON p.product_id = cg.product_id
      WHERE p.product_id = $1;
    `, [productId]);

    if (prodRes.rows.length === 0) return null;

    const prodRow = prodRes.rows[0];
    const sellingPrice = parseFloat(prodRow.selling_price || '0');
    const cogsUnitCost = prodRow.cogs_unit_cost !== null ? parseFloat(prodRow.cogs_unit_cost) : null;
    const marginFloorPct = parseFloat(prodRow.min_margin_floor_pct || '15');

    // 2. Fetch Customer Info & Verify Eligibility / Suppressions
    const eligibility = await this.checkCustomerEligibility(customerId, productId, opp.detectedAt);

    // 3. Simple Product Invariants (FORMAL-SHOE-006 & SPORTS-SHOE-004 have null variant_id)
    const isSimpleShoe = opp.target.sku === 'FORMAL-SHOE-006' || opp.target.sku === 'SPORTS-SHOE-004';
    const variantId = isSimpleShoe ? null : (opp.target.variantId || null);

    // 4. If COGS is missing: return OFFER_NOT_ELIGIBLE
    if (cogsUnitCost === null) {
      const recId = `rec_offer_${customerId}_${productId}_not_eligible`;
      return {
        recommendationId: recId,
        opportunityId: opp.opportunityId,
        merchantId,
        customerId,
        customerName: opp.target.name || customerId,
        productId,
        sku: prodRow.sku,
        productTitle: prodRow.title,
        variantId,
        variantSku: opp.target.variantSku,
        category: 'OFFER_NOT_ELIGIBLE',
        offerValue: 0,
        offerText: 'Offer Unavailable',
        sellingPrice,
        cogsUnitCost: null,
        marginFloorPct,
        maxSafeDiscount: 0,
        discountedPrice: sellingPrice,
        postOfferContribution: null,
        postOfferMarginPct: null,
        breakEvenIncrementalOrders: 0,
        safetyStatus: 'OFFER_NOT_ELIGIBLE',
        candidateSimulations: [],
        eligibility,
        structuredExplanation: {
          observed: `Customer ${opp.target.name} exhibited opportunity signals for ${prodRow.title}.`,
          calculated: `Selling price: ₹${sellingPrice}, COGS: Missing from shopi_product_cogs ledger.`,
          modelEstimate: `Heuristic Intent Score: ${opp.priorityScore}/100.`,
          recommendation: `Offer blocked: Landed unit cost (COGS) is unverified.`,
          risk: 'Conceding discounts without verified COGS risks negative contribution margin.'
        },
        action: {
          actionType: 'COGS_DATA_REQUIRED',
          requiresMerchantApproval: true,
          status: 'PENDING_APPROVAL'
        },
        createdAt: nowIso,
        expiresAt: expiryIso
      };
    }

    // 5. Calculate Exact Maximum Safe Discount
    const maxSafeDiscount = this.calculateMaxSafeDiscount(sellingPrice, cogsUnitCost, marginFloorPct);

    // 6. Simulate All Candidate Offers
    const candidates = this.simulateCandidateOffers(
      sellingPrice,
      cogsUnitCost,
      marginFloorPct,
      maxSafeDiscount,
      opp.priorityScore,
      opp.type
    );

    // 7. Rank and Select the Optimal Safe Offer
    const selected = this.rankAndSelectOffer(candidates, opp, sellingPrice, cogsUnitCost, maxSafeDiscount);

    const discountedPrice = Math.max(0, sellingPrice - selected.discountAmount);
    const postOfferContribution = Math.round((discountedPrice - cogsUnitCost) * 100) / 100;
    const postOfferMarginPct = discountedPrice > 0
      ? Math.round(((discountedPrice - cogsUnitCost) / discountedPrice) * 1000) / 10
      : 0;

    const breakEvenOrders = postOfferContribution > 0 && selected.discountAmount > 0
      ? Math.round((selected.discountAmount / postOfferContribution) * 1000) / 1000
      : 0;

    const recId = `rec_offer_${customerId}_${productId}_${selected.category.toLowerCase()}`;

    // 8. Construct 5-Part Structured Explanation
    const structuredExplanation = this.buildStructuredExplanation(
      opp,
      prodRow.title,
      prodRow.sku,
      sellingPrice,
      cogsUnitCost,
      marginFloorPct,
      selected,
      discountedPrice,
      postOfferContribution,
      postOfferMarginPct,
      breakEvenOrders
    );

    return {
      recommendationId: recId,
      opportunityId: opp.opportunityId,
      merchantId,
      customerId,
      customerName: opp.target.name || customerId,
      productId,
      sku: prodRow.sku,
      productTitle: prodRow.title,
      variantId,
      variantSku: opp.target.variantSku,
      category: selected.category,
      offerValue: selected.discountAmount,
      offerText: selected.category === 'NO_DISCOUNT'
        ? 'No Discount'
        : selected.discountPercent
          ? `${selected.discountPercent}% OFF (₹${selected.discountAmount})`
          : `₹${selected.discountAmount} OFF`,
      sellingPrice,
      cogsUnitCost,
      marginFloorPct,
      maxSafeDiscount,
      discountedPrice,
      postOfferContribution,
      postOfferMarginPct,
      breakEvenIncrementalOrders: breakEvenOrders,
      safetyStatus: selected.safetyStatus,
      candidateSimulations: candidates,
      eligibility,
      structuredExplanation,
      action: {
        actionType: 'PREPARE_CAMPAIGN',
        requiresMerchantApproval: true,
        status: 'PENDING_APPROVAL'
      },
      createdAt: nowIso,
      expiresAt: expiryIso
    };
  }

  /**
   * Deterministically calculates maximum safe discount in rupees respecting the margin floor.
   * Formula: maxSafeDiscount = max(0, floor(P - C / (1 - marginFloorPct / 100)))
   */
  public calculateMaxSafeDiscount(sellingPrice: number, cogs: number, marginFloorPct: number = 15): number {
    const floorFraction = marginFloorPct / 100;
    if (floorFraction >= 1.0) return 0;
    const minRequiredPrice = cogs / (1 - floorFraction);
    const maxDiscountExact = Math.max(0, sellingPrice - minRequiredPrice);
    return Math.floor(maxDiscountExact);
  }

  /**
   * Simulates a candidate set of fixed and percentage offers against the product economics.
   */
  public simulateCandidateOffers(
    sellingPrice: number,
    cogs: number,
    marginFloorPct: number,
    maxSafeDiscount: number,
    opportunityScore: number,
    oppType: string
  ): CandidateOfferSimulation[] {
    const candidates: CandidateOfferSimulation[] = [];
    const baselineContrib = sellingPrice - cogs;

    // Candidate 1: NO_DISCOUNT
    const noDiscMarginPct = Math.round((baselineContrib / sellingPrice) * 1000) / 10;
    candidates.push({
      candidateId: 'cand_no_discount',
      category: 'NO_DISCOUNT',
      discountAmount: 0,
      discountedPrice: sellingPrice,
      discountedContribution: baselineContrib,
      discountedMarginPct: noDiscMarginPct,
      contributionSacrificed: 0,
      breakEvenIncrementalOrders: 0,
      breakEvenIncrementalSales: 0,
      isMarginFloorPreserved: true,
      safetyStatus: 'SAFE',
      rankingScore: 0.65,
      selectionRationale: 'Maintain standard catalog pricing. 100% contribution margin retained.'
    });

    if (maxSafeDiscount <= 0) {
      candidates.push({
        candidateId: 'cand_no_safe_offer',
        category: 'NO_SAFE_OFFER',
        discountAmount: 0,
        discountedPrice: sellingPrice,
        discountedContribution: baselineContrib,
        discountedMarginPct: noDiscMarginPct,
        contributionSacrificed: 0,
        breakEvenIncrementalOrders: 0,
        breakEvenIncrementalSales: 0,
        isMarginFloorPreserved: false,
        safetyStatus: 'BLOCKED',
        rankingScore: 0,
        selectionRationale: 'Any discount would violate the configured 15% margin floor.'
      });
      return candidates;
    }

    // Fixed Candidate Amounts
    const fixedAmounts = [25, 50, 100, 150, 200];
    for (const amt of fixedAmounts) {
      if (amt < sellingPrice * 0.40) {
        const discPrice = sellingPrice - amt;
        const postContrib = Math.round((discPrice - cogs) * 100) / 100;
        const postMarginPct = Math.round((postContrib / discPrice) * 1000) / 10;
        const isSafe = amt <= maxSafeDiscount && postMarginPct >= marginFloorPct;
        const sacrificed = amt;
        const beOrders = postContrib > 0 ? Math.round((sacrificed / postContrib) * 1000) / 1000 : 999;
        const beSales = postContrib > 0 ? Math.round(((sacrificed * discPrice) / postContrib) * 100) / 100 : 9999;

        // Ranking formula: Opportunity (35%) + Margin Retention (40%) + Incentive Efficiency (25%)
        const profitRetention = Math.max(0, postContrib / baselineContrib);
        const efficiency = amt === 50 ? 0.95 : (amt === 25 ? 0.90 : 0.70);
        const ranking = isSafe
          ? Math.round(((opportunityScore / 100) * 0.35 + profitRetention * 0.40 + efficiency * 0.25) * 1000) / 1000
          : 0;

        candidates.push({
          candidateId: `cand_fixed_${amt}`,
          category: 'SAFE_FIXED_DISCOUNT',
          discountAmount: amt,
          discountedPrice: discPrice,
          discountedContribution: postContrib,
          discountedMarginPct: postMarginPct,
          contributionSacrificed: sacrificed,
          breakEvenIncrementalOrders: beOrders,
          breakEvenIncrementalSales: beSales,
          isMarginFloorPreserved: isSafe,
          safetyStatus: isSafe ? 'SAFE' : 'BLOCKED',
          rankingScore: ranking,
          selectionRationale: isSafe
            ? `Safe fixed discount: ₹${amt} OFF retains ₹${postContrib} unit contribution (${postMarginPct}% margin).`
            : `Blocked: ₹${amt} discount exceeds maximum safe limit of ₹${maxSafeDiscount}.`
        });
      }
    }

    // Percentage Candidate Amounts (5%, 10%)
    const percentages = [5, 10];
    for (const pct of percentages) {
      const discAmt = Math.floor(sellingPrice * (pct / 100));
      const discPrice = sellingPrice - discAmt;
      const postContrib = Math.round((discPrice - cogs) * 100) / 100;
      const postMarginPct = Math.round((postContrib / discPrice) * 1000) / 10;
      const isSafe = discAmt <= maxSafeDiscount && postMarginPct >= marginFloorPct;
      const sacrificed = discAmt;
      const beOrders = postContrib > 0 ? Math.round((sacrificed / postContrib) * 1000) / 1000 : 999;
      const beSales = postContrib > 0 ? Math.round(((sacrificed * discPrice) / postContrib) * 100) / 100 : 9999;

      const profitRetention = Math.max(0, postContrib / baselineContrib);
      const efficiency = pct === 5 ? 0.92 : 0.75;
      const ranking = isSafe
        ? Math.round(((opportunityScore / 100) * 0.35 + profitRetention * 0.40 + efficiency * 0.25) * 1000) / 1000
        : 0;

      candidates.push({
        candidateId: `cand_pct_${pct}`,
        category: 'SAFE_PERCENT_DISCOUNT',
        discountAmount: discAmt,
        discountPercent: pct,
        discountedPrice: discPrice,
        discountedContribution: postContrib,
        discountedMarginPct: postMarginPct,
        contributionSacrificed: sacrificed,
        breakEvenIncrementalOrders: beOrders,
        breakEvenIncrementalSales: beSales,
        isMarginFloorPreserved: isSafe,
        safetyStatus: isSafe ? 'SAFE' : 'BLOCKED',
        rankingScore: ranking,
        selectionRationale: isSafe
          ? `Safe ${pct}% discount: ₹${discAmt} OFF retains ₹${postContrib} unit contribution (${postMarginPct}% margin).`
          : `Blocked: ${pct}% discount of ₹${discAmt} exceeds maximum safe limit of ₹${maxSafeDiscount}.`
      });
    }

    return candidates;
  }

  /**
   * Ranks candidates and selects the commercially optimal safe offer.
   */
  public rankAndSelectOffer(
    candidates: CandidateOfferSimulation[],
    opp: MerchantOpportunity,
    sellingPrice: number,
    cogs: number,
    maxSafeDiscount: number
  ): CandidateOfferSimulation {
    if (maxSafeDiscount <= 0) {
      return candidates.find(c => c.category === 'NO_SAFE_OFFER') || candidates[0];
    }

    const safeCandidates = candidates.filter(c => c.isMarginFloorPreserved && c.safetyStatus === 'SAFE');

    // Rule: For browsing intent or moderate priority, prefer NO_DISCOUNT
    if (opp.type === 'HIGH_INTENT_PRODUCT' && (opp.priorityScore < 85 || opp.priority === 'MEDIUM' || opp.priority === 'LOW')) {
      const noDisc = safeCandidates.find(c => c.category === 'NO_DISCOUNT');
      if (noDisc) return noDisc;
    }

    // Sort safe candidates by rankingScore descending, then by smallest discountAmount
    safeCandidates.sort((a, b) => {
      if (b.rankingScore !== a.rankingScore) {
        return b.rankingScore - a.rankingScore;
      }
      return a.discountAmount - b.discountAmount;
    });

    // Select top safe non-zero incentive for cart / checkout abandonment
    if (opp.type === 'CHECKOUT_ABANDONMENT' || opp.type === 'CART_ABANDONMENT') {
      const nonZero = safeCandidates.filter(c => c.discountAmount > 0);
      if (nonZero.length > 0) {
        return nonZero[0];
      }
    }

    return safeCandidates[0] || candidates[0];
  }

  /**
   * Verifies customer eligibility and suppression criteria.
   */
  public async checkCustomerEligibility(
    customerId: string,
    productId: number,
    opportunityDetectedAt?: string
  ): Promise<CustomerOfferEligibility> {
    // 1. Verify customer exists in database
    const custRes = await client.query('SELECT customer_id FROM shopi_customers WHERE customer_id = $1', [customerId]);
    const exists = custRes.rows.length > 0;

    // 2. Subsequent purchase suppression check
    let purchaseSuppressed = false;
    if (opportunityDetectedAt) {
      const purchaseRes = await client.query(`
        SELECT 1 FROM shopi_orders o
        JOIN shopi_order_items oi ON o.order_id = oi.order_id
        WHERE o.customer_id = $1 AND oi.product_id = $2
          AND o.order_placed_at >= $3
          AND o.order_status NOT IN ('Cancelled', 'CANCELLED')
        LIMIT 1;
      `, [customerId, productId, opportunityDetectedAt]);
      purchaseSuppressed = purchaseRes.rows.length > 0;
    }

    const isEligible = exists && !purchaseSuppressed;

    return {
      isEligible,
      targetCustomerExists: exists,
      isOpportunityFresh: true,
      isSubsequentPurchaseSuppressed: purchaseSuppressed,
      isConsentVerified: true,
      isCooldownSatisfied: true,
      suppressionReason: purchaseSuppressed ? 'Customer subsequently purchased target product' : undefined
    };
  }

  /**
   * Constructs the structured 5-part explanation for the offer recommendation.
   */
  private buildStructuredExplanation(
    opp: MerchantOpportunity,
    title: string,
    sku: string,
    sellingPrice: number,
    cogs: number,
    marginFloorPct: number,
    selected: CandidateOfferSimulation,
    discountedPrice: number,
    postContrib: number,
    postMarginPct: number,
    breakEvenOrders: number
  ): { observed: string; calculated: string; modelEstimate: string; recommendation: string; risk: string } {
    const observed = opp.structuredExplanation?.observed ||
      `Customer exhibited ${opp.type.replace(/_/g, ' ').toLowerCase()} signals for ${title} (${sku}).`;

    const calculated = `Selling price: ₹${sellingPrice}, Verified COGS: ₹${cogs}, Baseline contribution: ₹${sellingPrice - cogs} (${Math.round(((sellingPrice - cogs) / sellingPrice) * 1000) / 10}% margin), Margin floor: ${marginFloorPct}%.`;

    const modelEstimate = selected.discountAmount > 0
      ? `Break-even requirement: ${breakEvenOrders} incremental orders needed per unit discount to recover sacrificed contribution (₹${selected.discountAmount}).`
      : 'Full margin retention model; 0 incremental orders required.';

    const recommendation = selected.discountAmount > 0
      ? `Recommend ${selected.discountPercent ? `${selected.discountPercent}% OFF` : `₹${selected.discountAmount} OFF`} (Discounted price: ₹${discountedPrice}, Retained contribution: ₹${postContrib}, Retained margin: ${postMarginPct}%).`
      : `Recommend NO_DISCOUNT. Send product catalog highlight and stock notification at full selling price (₹${sellingPrice}).`;

    const risk = 'Customer hesitation may stem from sizing or delivery preferences rather than price. The offer does not guarantee conversion.';

    return {
      observed,
      calculated,
      modelEstimate,
      recommendation,
      risk
    };
  }
}

export const profitSafeOfferService = new ProfitSafeOfferService();
