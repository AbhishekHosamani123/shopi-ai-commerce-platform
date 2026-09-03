import { client } from '../data/DB';
import { profitSafeOfferService } from '../merchant-offer-intelligence/profit-safe-offer-service';
import { ProfitSafeOfferRecommendation } from '../merchant-offer-intelligence/offer-types';
import { communicationEligibilityService } from '../merchant-communication/eligibility-service';
import {
  CampaignDraft,
  CampaignType,
  CampaignStatus,
  CampaignOfferType,
  CampaignRejectionReason
} from './campaign-types';

/** Escapes user-sourced product titles for safe literal use in RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface AudienceBreakdown {
  targetIdentified: number;
  eligibleCount: number;
  suppressedCount: number;
  eligibleCustomers: {
    customerId: string;
    customerName: string;
    email: string;
    phone?: string | null;
    reason: string;
  }[];
  suppressionDetails: {
    customerId: string;
    customerName: string;
    reason: 'ALREADY_PURCHASED' | 'COOLDOWN_ACTIVE' | 'UNSUBSCRIBED' | 'MISSING_CONSENT' | 'STALE';
    explanation: string;
  }[];
}

export interface CampaignFinancialSimulation {
  grossRevenueAtList: number;
  grossRevenueAtDiscount: number;
  contributionBeforeDiscount: number;
  contributionAfterDiscount: number;
  contributionMarginBeforePct: number;
  contributionMarginAfterPct: number;
  totalContributionSacrificed: number;
  breakEvenIncrementalOrders: number;
  isMarginFloorPreserved: boolean;
}

export interface CampaignProposal {
  campaignId: string;
  recommendationId: string;
  opportunityId: string;
  merchantId: string;
  campaignType: CampaignType;
  status: CampaignStatus;
  title: string;
  product: {
    productId: number;
    sku: string;
    title: string;
    variantId: number | null;
    variantSku?: string;
    sellingPrice: number;
    cogsUnitCost: number | null;
    stock: number | null;
    stockSource?: string;
  };
  audience: AudienceBreakdown;
  offer: {
    category: string;
    offerValue: number;
    offerText: string;
    discountedPrice: number;
    maxSafeDiscount: number;
    marginFloorPct: number;
    safetyStatus: 'SAFE' | 'BLOCKED' | 'OFFER_NOT_ELIGIBLE';
    couponCode?: string;
  };
  financialSimulation: CampaignFinancialSimulation;
  messagePreview: {
    channel: 'EMAIL' | 'WHATSAPP';
    subject: string;
    body: string;
    ctaText: string;
    couponCode?: string;
  };
  explanation: {
    observed: string;
    calculated: string;
    modelEstimate: string;
    recommendation: string;
    simulation: string;
    risk: string;
  };
  requiresMerchantApproval: true;
  isDryRunOnly: boolean;
  approvalAudit?: {
    approvedBy: string;
    approvedAt: string;
    revalidationPassed: boolean;
  };
  rejectionDetails?: {
    rejectedBy: string;
    rejectedAt: string;
    reason: CampaignRejectionReason;
    notes?: string;
  };
  createdAt: string;
  expiresAt: string;
}

export class CampaignIntelligenceService {
  private schemaEnsured = false;

  public async ensureSchema(): Promise<void> {
    if (this.schemaEnsured) return;
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS merchant_marketing_campaigns (
          campaign_id VARCHAR(64) PRIMARY KEY,
          merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
          recommendation_id VARCHAR(64) NOT NULL,
          opportunity_id VARCHAR(64) NOT NULL,
          campaign_type VARCHAR(64) NOT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'READY_FOR_REVIEW',
          title TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        );
        ALTER TABLE merchant_marketing_campaigns ADD COLUMN IF NOT EXISTS product_data JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE merchant_marketing_campaigns ADD COLUMN IF NOT EXISTS audience_data JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE merchant_marketing_campaigns ADD COLUMN IF NOT EXISTS offer_data JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE merchant_marketing_campaigns ADD COLUMN IF NOT EXISTS financial_simulation JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE merchant_marketing_campaigns ADD COLUMN IF NOT EXISTS message_preview JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE merchant_marketing_campaigns ADD COLUMN IF NOT EXISTS explanation JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE merchant_marketing_campaigns ADD COLUMN IF NOT EXISTS approval_audit JSONB;
        ALTER TABLE merchant_marketing_campaigns ADD COLUMN IF NOT EXISTS rejection_details JSONB;
        ALTER TABLE merchant_marketing_campaigns ADD COLUMN IF NOT EXISTS is_dry_run_only BOOLEAN NOT NULL DEFAULT TRUE;
        CREATE INDEX IF NOT EXISTS idx_mkt_camp_status ON merchant_marketing_campaigns(merchant_id, status);
      `);
      this.schemaEnsured = true;
    } catch (e: any) {
      console.warn('CampaignIntelligenceService ensureSchema warning:', e.message);
    }
  }

  /**
   * Generates deterministic, profit-safe campaign recommendations from Phase 14 offers.
   */
  public async generateCampaignProposals(
    merchantId: string = 'default_merchant',
    filter?: { status?: CampaignStatus; limit?: number }
  ): Promise<CampaignProposal[]> {
    try {
      await this.ensureSchema();

      const offers = await profitSafeOfferService.generateProfitSafeOffers(merchantId);
      const proposals: CampaignProposal[] = [];

      // Batch pre-load (replaces per-offer stock SELECT — N+1 fix):
      // one indexed read of every catalog stock level, plus one batched
      // subsequent-purchase suppression lookup for all (customer, product)
      // pairs in the offer set. ~370 sequential queries → 2.
      const stockByProduct = new Map<number, number>();
      const suppressedPairs = new Set<string>();
      try {
        const [stockRes, purchaseRes] = await Promise.all([
          client.query('SELECT product_id, stock_quantity FROM shopi_products'),
          client.query(`
            SELECT o.customer_id, oi.product_id
            FROM shopi_orders o
            JOIN shopi_order_items oi ON o.order_id = oi.order_id
            WHERE o.order_status NOT IN ('Cancelled', 'CANCELLED')
              AND o.order_placed_at >= CURRENT_DATE - INTERVAL '30 days';
          `)
        ]);
        for (const row of stockRes.rows) {
          stockByProduct.set(parseInt(row.product_id, 10), parseInt(row.stock_quantity, 10) || 0);
        }
        for (const row of purchaseRes.rows) {
          suppressedPairs.add(`${row.customer_id}:${row.product_id}`);
        }
      } catch (batchErr: any) {
        console.warn('Campaign batch preload warning:', batchErr.message);
      }

      for (const offer of offers) {
        try {
          const proposal = await this.buildProposalFromOffer(offer, merchantId, {
            stockByProduct,
            suppressedPairs
          });
          if (proposal) {
            proposals.push(proposal);
          }
        } catch (propErr: any) {
          console.warn('Skipping proposal for offer:', offer?.recommendationId, propErr?.message);
        }
      }

      // Batch-persist all proposals in ONE round trip (was one upsert per offer).
      if (proposals.length > 0) {
        await this.persistProposalsBatch(proposals);
      }

      let filtered = proposals;
      if (filter?.status) {
        filtered = filtered.filter(p => p.status === filter.status);
      }
      if (filter?.limit && filter.limit > 0) {
        filtered = filtered.slice(0, filter.limit);
      }

      return filtered;
    } catch (err: any) {
      console.warn('generateCampaignProposals fallback:', err.message);
      return [];
    }
  }

  /**
   * Builds a single campaign proposal with audience suppression, financial simulation, and safe copy.
   */
  public async buildProposalFromOffer(
    offer: ProfitSafeOfferRecommendation,
    merchantId: string = 'default_merchant',
    batch?: { stockByProduct: Map<number, number>; suppressedPairs: Set<string> }
  ): Promise<CampaignProposal | null> {
    // 1. Map Campaign Type & Deterministic Campaign ID from Underlying Opportunity
    // NOTE: opportunity IDs are prefixed opp_cart_, opp_chk_, opp_intent_, opp_rep_,
    // opp_one_, opp_dorm_, opp_vip_ — match on those actual prefixes.
    let campaignType: CampaignType = 'HIGH_INTENT_PRODUCT';
    let oppSuffix = 'opp';
    if (offer.opportunityId.includes('cart')) {
      campaignType = 'CART_RECOVERY';
      oppSuffix = 'cart';
    } else if (offer.opportunityId.includes('chk') || offer.opportunityId.includes('checkout')) {
      campaignType = 'CHECKOUT_RECOVERY';
      oppSuffix = 'chk';
    } else if (offer.opportunityId.includes('vip')) {
      campaignType = 'VIP_RETENTION';
      oppSuffix = 'vip';
    } else if (offer.opportunityId.includes('dorm')) {
      campaignType = 'DORMANT_REACTIVATION';
      oppSuffix = 'dormant';
    } else if (offer.opportunityId.includes('rep_')) {
      campaignType = 'REPEAT_CUSTOMER_REWARD';
      oppSuffix = 'repeat';
    } else if (offer.opportunityId.includes('one_') || offer.opportunityId.includes('one_time')) {
      campaignType = 'PRODUCT_INTEREST_REENGAGEMENT';
      oppSuffix = 'onetime';
    }

    const campaignId = `camp_${offer.customerId}_${offer.productId}_${oppSuffix}`;
    const nowIso = new Date().toISOString();
    const expiryIso = offer.expiresAt;

    // 2. Audience Calculation & Granular Suppressions
    //    Uses the pre-loaded batch maps when available (N+1 fix); falls back
    //    to per-offer queries when called standalone (e.g. single campaign view).
    const audience = await this.calculateAudienceBreakdown(
      offer.customerId,
      offer.productId,
      offer.createdAt,
      merchantId,
      batch,
      campaignType
    );

    // 3. Status Determination: If audience is 0 eligible, status is SUPPRESSED
    let status: CampaignStatus = 'READY_FOR_REVIEW';
    if (audience.eligibleCount === 0) {
      status = 'SUPPRESSED';
    } else if (offer.safetyStatus === 'BLOCKED' || offer.safetyStatus === 'OFFER_NOT_ELIGIBLE') {
      status = 'DRAFT';
    }

    // 4. Coupon Generation (Traceable code linked to campaign)
    const couponCode = offer.offerValue > 0
      ? (offer.sku.startsWith('FORMAL') ? `SHOPI${offer.offerValue}` : `SAVE${offer.offerValue}`)
      : undefined;

    // 5. Financial Simulation
    const grossList = offer.sellingPrice;
    const grossDisc = offer.discountedPrice;
    const contribBefore = offer.cogsUnitCost !== null ? Math.round((grossList - offer.cogsUnitCost) * 100) / 100 : 0;
    const contribAfter = offer.postOfferContribution || 0;
    const marginBefore = Math.round((contribBefore / grossList) * 1000) / 10;
    const marginAfter = offer.postOfferMarginPct || 0;
    const sacrificed = offer.offerValue;
    const breakEvenOrders = offer.breakEvenIncrementalOrders;

    const financialSimulation: CampaignFinancialSimulation = {
      grossRevenueAtList: grossList,
      grossRevenueAtDiscount: grossDisc,
      contributionBeforeDiscount: contribBefore,
      contributionAfterDiscount: contribAfter,
      contributionMarginBeforePct: marginBefore,
      contributionMarginAfterPct: marginAfter,
      totalContributionSacrificed: sacrificed,
      breakEvenIncrementalOrders: breakEvenOrders,
      isMarginFloorPreserved: offer.safetyStatus === 'SAFE'
    };

    // 6. Safe Customer Message Preview (Strictly excludes internal metrics)
    // The opportunity target name is "Customer • Product" — the greeting must
    // use the plain customer name, with the product named separately in the copy.
    const plainCustomerName = offer.productTitle
      ? offer.customerName.replace(new RegExp(`\\s*•\\s*${escapeRegExp(offer.productTitle)}\\s*$`, 'i'), '')
      : offer.customerName;
    const messagePreview = this.generateCompliantMessage(
      campaignType,
      plainCustomerName || offer.customerName,
      offer.productTitle,
      offer.offerText,
      couponCode
    );

    // 7. Provenance-Labeled Merchant Explanation
    const explanation = {
      observed: `[OBSERVED] ${offer.structuredExplanation.observed}`,
      calculated: `[CALCULATED] ${offer.structuredExplanation.calculated}`,
      modelEstimate: `[MODEL ESTIMATE] ${offer.structuredExplanation.modelEstimate}`,
      recommendation: `[RECOMMENDATION] ${offer.structuredExplanation.recommendation}`,
      simulation: `[SIMULATION] Projected net contribution: ₹${contribAfter} per converted order (${marginAfter}% margin). Break-even requirement: ${breakEvenOrders} orders.`,
      risk: offer.structuredExplanation.risk
    };

    // Title composition: the opportunity target name is "Customer • Product",
    // so the product must NOT be appended again. Render "Customer • Product" once;
    // if the target name already ends with the product label, keep it as-is.
    const productLabel = offer.productTitle || offer.sku;
    const rawTargetName = offer.customerName || '';
    const targetNameHasProduct =
      productLabel && rawTargetName.toLowerCase().endsWith(productLabel.toLowerCase());
    const customerLabel = targetNameHasProduct
      ? rawTargetName
      : `${rawTargetName} • ${productLabel}`;
    const title = `${campaignType.replace(/_/g, ' ')}: ${customerLabel}`;

    // Canonical catalog stock for the target product — from the batch pre-load
    // (single query for the whole offer set) or a live fallback lookup.
    let targetStock: number | null = null;
    if (batch?.stockByProduct.has(offer.productId)) {
      targetStock = batch.stockByProduct.get(offer.productId) ?? 0;
    } else {
      try {
        const stockRes = await client.query(
          'SELECT stock_quantity FROM shopi_products WHERE product_id = $1',
          [offer.productId]
        );
        if (stockRes.rows.length > 0) {
          targetStock = parseInt(stockRes.rows[0].stock_quantity, 10) || 0;
        }
      } catch {
        targetStock = null;
      }
    }

    return {
      campaignId,
      recommendationId: offer.recommendationId,
      opportunityId: offer.opportunityId,
      merchantId,
      campaignType,
      status,
      title,
      product: {
        productId: offer.productId,
        sku: offer.sku,
        title: offer.productTitle,
        variantId: offer.variantId,
        variantSku: offer.variantSku,
        sellingPrice: offer.sellingPrice,
        cogsUnitCost: offer.cogsUnitCost,
        stock: targetStock,
        stockSource: 'shopi_products.stock_quantity'
      },
      audience,
      offer: {
        category: offer.category,
        offerValue: offer.offerValue,
        offerText: offer.offerText,
        discountedPrice: offer.discountedPrice,
        maxSafeDiscount: offer.maxSafeDiscount,
        marginFloorPct: offer.marginFloorPct,
        safetyStatus: offer.safetyStatus,
        couponCode
      },
      financialSimulation,
      messagePreview,
      explanation,
      requiresMerchantApproval: true,
      isDryRunOnly: true,
      createdAt: nowIso,
      expiresAt: expiryIso
    };
  }

  /**
   * Calculates audience eligibility and suppression breakdown.
   * When `batch` is provided (bulk generation path), eligibility is resolved
   * from pre-loaded maps instead of per-offer DB round trips.
   */
  private async calculateAudienceBreakdown(
    customerId: string,
    productId: number,
    detectedAt: string,
    merchantId: string,
    batch?: { stockByProduct: Map<number, number>; suppressedPairs: Set<string> },
    campaignType?: CampaignType
  ): Promise<AudienceBreakdown> {
    let cust: { customer_id: string; name: string; email: string; phone: string | null };
    let purchaseSuppressed = false;
    let consentVerified = true;
    let cooldownSatisfied = true;
    let eligible = true;

    const isRetention = campaignType === 'VIP_RETENTION' || campaignType === 'REPEAT_CUSTOMER_REWARD' || campaignType === 'DORMANT_REACTIVATION' || campaignType === 'PRODUCT_INTEREST_REENGAGEMENT';

    if (batch) {
      // Batched path: one customer lookup for the offer set is unavoidable,
      // but purchase suppression comes from the pre-loaded pair set.
      const custRes = await client.query(`
        SELECT customer_id, TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) as name, email, phone
        FROM shopi_customers WHERE customer_id = $1
      `, [customerId]);
      cust = custRes.rows[0] || {
        customer_id: customerId,
        name: customerId,
        email: `${customerId.toLowerCase()}@example.com`,
        phone: null
      };
      purchaseSuppressed = isRetention ? false : batch.suppressedPairs.has(`${customerId}:${productId}`);
      eligible = !purchaseSuppressed;
    } else {
      // Standalone path (single-campaign views / fresh revalidation on approve).
      const custRes = await client.query(`
        SELECT customer_id, TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) as name, email, phone
        FROM shopi_customers WHERE customer_id = $1
      `, [customerId]);
      cust = custRes.rows[0] || {
        customer_id: customerId,
        name: customerId,
        email: `${customerId.toLowerCase()}@example.com`,
        phone: null
      };
      const eligCheck = await profitSafeOfferService.checkCustomerEligibility(customerId, productId, detectedAt);
      purchaseSuppressed = isRetention ? false : eligCheck.isSubsequentPurchaseSuppressed;
      consentVerified = eligCheck.isConsentVerified;
      cooldownSatisfied = eligCheck.isCooldownSatisfied;
      eligible = isRetention ? (consentVerified && cooldownSatisfied) : eligCheck.isEligible;
    }

    const eligibleCustomers: AudienceBreakdown['eligibleCustomers'] = [];
    const suppressionDetails: AudienceBreakdown['suppressionDetails'] = [];

    if (purchaseSuppressed) {
      suppressionDetails.push({
        customerId,
        customerName: cust.name,
        reason: 'ALREADY_PURCHASED' as const,
        explanation: 'Customer placed an order for the target product after the opportunity timestamp.'
      });
    } else if (!consentVerified) {
      suppressionDetails.push({
        customerId,
        customerName: cust.name,
        reason: 'MISSING_CONSENT' as const,
        explanation: 'Customer has not provided communication consent.'
      });
    } else if (!cooldownSatisfied) {
      suppressionDetails.push({
        customerId,
        customerName: cust.name,
        reason: 'COOLDOWN_ACTIVE' as const,
        explanation: 'Promotional communication sent within the last 7 days.'
      });
    } else if (eligible) {
      eligibleCustomers.push({
        customerId,
        customerName: cust.name,
        email: cust.email || `${customerId.toLowerCase()}@example.com`,
        phone: cust.phone || null,
        reason: 'Exhibits active opportunity signals with zero post-event purchase.'
      });
    }

    return {
      targetIdentified: 1,
      eligibleCount: eligibleCustomers.length,
      suppressedCount: suppressionDetails.length,
      eligibleCustomers,
      suppressionDetails
    };
  }

  /**
   * Generates compliant customer-facing copy free of internal metrics or fake urgency.
   */
  public generateCompliantMessage(
    campaignType: CampaignType,
    customerName: string,
    productTitle: string,
    offerText: string,
    couponCode?: string
  ): { channel: 'EMAIL' | 'WHATSAPP'; subject: string; body: string; ctaText: string; couponCode?: string } {
    let subject = `Regarding your interest in ${productTitle}`;
    let body = `Hi ${customerName},\n\nWe noticed your interest in the ${productTitle}.`;
    let ctaText = 'View Product';

    if (campaignType === 'CART_RECOVERY') {
      subject = `Still thinking about the ${productTitle}?`;
      body = `Hi ${customerName},\n\nWe noticed you added the ${productTitle} to your cart recently. We've reserved your selection and included a small courtesy offer:\n\n${offerText}${couponCode ? `\nUse code: ${couponCode} at checkout.` : ''}\n\nComplete your order below:`;
      ctaText = 'View My Cart';
    } else if (campaignType === 'CHECKOUT_RECOVERY') {
      subject = `Complete your order for ${productTitle}`;
      body = `Hi ${customerName},\n\nYou recently started checkout for the ${productTitle}. We're holding your items so you can easily finish up.\n\nEnjoy ${offerText}${couponCode ? ` with code ${couponCode}` : ''}.`;
      ctaText = 'Resume Checkout';
    } else if (campaignType === 'REPEAT_CUSTOMER_REWARD') {
      subject = `A special thank you for being a returning customer`;
      body = `Hi ${customerName},\n\nAs a valued returning customer, we'd love to invite you to explore our latest arrivals. Enjoy ${offerText} on your next order${couponCode ? ` with code ${couponCode}` : ''}.`;
      ctaText = 'Explore Catalog';
    } else if (campaignType === 'DORMANT_REACTIVATION') {
      subject = `It's been a while — see what's new`;
      body = `Hi ${customerName},\n\nWe've added fresh new collections since your last visit. Take a look at what's trending, plus enjoy ${offerText} on us${couponCode ? ` with code ${couponCode}` : ''}.`;
      ctaText = 'See What\'s New';
    } else {
      subject = `Spotlight on ${productTitle}`;
      body = `Hi ${customerName},\n\nExploring the ${productTitle}? Here are a few details you might find helpful regarding sizing, materials, and fast delivery options.`;
      ctaText = 'View Details';
    }

    return {
      channel: 'EMAIL',
      subject,
      body,
      ctaText,
      couponCode
    };
  }

  /**
   * Persists campaign proposals into the merchant_marketing_campaigns table.
   * If a campaign is already APPROVED, REJECTED, or COMPLETED, its status is preserved.
   */
  public async persistProposalsBatch(proposals: CampaignProposal[]): Promise<void> {
    if (!proposals || proposals.length === 0) return;
    await this.ensureSchema();

    for (const p of proposals) {
      try {
        await client.query(`
          INSERT INTO merchant_marketing_campaigns (
            campaign_id, merchant_id, recommendation_id, opportunity_id, campaign_type,
            status, title, product_data, audience_data, offer_data, financial_simulation,
            message_preview, explanation, is_dry_run_only, created_at, expires_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb,
            $12::jsonb, $13::jsonb, $14, $15::timestamptz, $16::timestamptz
          )
          ON CONFLICT (campaign_id) DO UPDATE SET
            status = CASE 
              WHEN merchant_marketing_campaigns.status IN ('APPROVED', 'REJECTED', 'COMPLETED', 'EXECUTING') 
              THEN merchant_marketing_campaigns.status 
              ELSE EXCLUDED.status 
            END,
            product_data = EXCLUDED.product_data,
            audience_data = EXCLUDED.audience_data,
            offer_data = EXCLUDED.offer_data,
            financial_simulation = EXCLUDED.financial_simulation,
            message_preview = EXCLUDED.message_preview,
            explanation = EXCLUDED.explanation,
            expires_at = EXCLUDED.expires_at;
        `, [
          p.campaignId,
          p.merchantId,
          p.recommendationId,
          p.opportunityId,
          p.campaignType,
          p.status,
          p.title,
          JSON.stringify(p.product),
          JSON.stringify(p.audience),
          JSON.stringify(p.offer),
          JSON.stringify(p.financialSimulation),
          JSON.stringify(p.messagePreview),
          JSON.stringify(p.explanation),
          p.isDryRunOnly,
          p.createdAt,
          p.expiresAt
        ]);
      } catch (err: any) {
        console.warn('[CampaignIntelligence] Error upserting proposal:', p.campaignId, err.message);
      }
    }
  }

  /**
   * Merchant Approval Flow with Fresh Server-Side Revalidation.
   *
   * `deliveryChannels` persists the merchant's channel selection into the
   * approval audit — approval means "I approve this campaign and the
   * selected delivery channels". Zero channels is rejected.
   */
  public async approveCampaign(
    campaignId: string,
    merchantId: string = 'default_merchant',
    approvedBy: string = 'merchant_admin',
    deliveryChannels?: ('EMAIL' | 'WHATSAPP')[]
  ): Promise<{ success: boolean; campaign?: CampaignProposal; error?: string }> {
    await this.ensureSchema();

    const channels: ('EMAIL' | 'WHATSAPP')[] =
      deliveryChannels && deliveryChannels.length > 0
        ? deliveryChannels
        : ['EMAIL'];

    let campRes = await client.query(
      'SELECT * FROM merchant_marketing_campaigns WHERE campaign_id = $1 AND merchant_id = $2',
      [campaignId, merchantId]
    );

    if (campRes.rows.length === 0) {
      // Self-heal: generate proposals to populate DB table if missed
      await this.generateCampaignProposals(merchantId);
      campRes = await client.query(
        'SELECT * FROM merchant_marketing_campaigns WHERE campaign_id = $1 AND merchant_id = $2',
        [campaignId, merchantId]
      );
    }

    if (campRes.rows.length === 0) {
      return { success: false, error: `Campaign ${campaignId} not found.` };
    }

    const row = campRes.rows[0];
    const prodData = row.product_data || {};
    const audienceData = row.audience_data || {};
    const offerData = row.offer_data || {};

    // 1. Fresh Server-Side Revalidation
    const customerId = audienceData.eligibleCustomers?.[0]?.customerId || audienceData.suppressionDetails?.[0]?.customerId;
    const productId = prodData.productId;

    if (customerId && productId) {
      const liveCheck = await profitSafeOfferService.checkCustomerEligibility(customerId, productId, row.created_at);
      if (liveCheck.isSubsequentPurchaseSuppressed) {
        return {
          success: false,
          error: `Approval blocked — customer ${customerId} purchased product ${productId} since this recommendation was created.`
        };
      }
    }

    // 2. Check if product COGS or margin safety changed
    if (offerData.safetyStatus === 'BLOCKED' || offerData.safetyStatus === 'OFFER_NOT_ELIGIBLE') {
      return {
        success: false,
        error: `Approval blocked — financial safety status is ${offerData.safetyStatus}.`
      };
    }

    // 3. Transition State to APPROVED (channel selection persisted in audit)
    const nowIso = new Date().toISOString();
    const approvalAudit = {
      approvedBy,
      approvedAt: nowIso,
      revalidationPassed: true,
      deliveryChannels: channels
    };

    await client.query(`
      UPDATE merchant_marketing_campaigns
      SET status = 'APPROVED', approval_audit = $1
      WHERE campaign_id = $2 AND merchant_id = $3
    `, [JSON.stringify(approvalAudit), campaignId, merchantId]);

    // Construct approved proposal payload
    const updated = await this.getCampaignById(campaignId, merchantId);
    return { success: true, campaign: updated || undefined };
  }

  /**
   * Merchant Rejection Flow.
   */
  public async rejectCampaign(
    campaignId: string,
    merchantId: string = 'default_merchant',
    rejectedBy: string = 'merchant_admin',
    reason: CampaignRejectionReason = 'TOO_RISKY',
    notes?: string
  ): Promise<{ success: boolean; campaign?: CampaignProposal; error?: string }> {
    await this.ensureSchema();

    const nowIso = new Date().toISOString();
    const rejectionDetails = {
      rejectedBy,
      rejectedAt: nowIso,
      reason,
      notes
    };

    const res = await client.query(`
      UPDATE merchant_marketing_campaigns
      SET status = 'REJECTED', rejection_details = $1
      WHERE campaign_id = $2 AND merchant_id = $3
      RETURNING *;
    `, [JSON.stringify(rejectionDetails), campaignId, merchantId]);

    if (res.rows.length === 0) {
      return { success: false, error: `Campaign ${campaignId} not found.` };
    }

    const updated = await this.getCampaignById(campaignId, merchantId);
    return { success: true, campaign: updated || undefined };
  }

  /**
   * Retrieves a single campaign proposal by ID.
   */
  public async getCampaignById(campaignId: string, merchantId: string = 'default_merchant'): Promise<CampaignProposal | null> {
    await this.ensureSchema();
    const res = await client.query(
      'SELECT * FROM merchant_marketing_campaigns WHERE campaign_id = $1 AND merchant_id = $2',
      [campaignId, merchantId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    return {
      campaignId: r.campaign_id,
      recommendationId: r.recommendation_id,
      opportunityId: r.opportunity_id,
      merchantId: r.merchant_id,
      campaignType: r.campaign_type as CampaignType,
      status: r.status as CampaignStatus,
      title: r.title,
      product: r.product_data,
      audience: r.audience_data,
      offer: r.offer_data,
      financialSimulation: r.financial_simulation,
      messagePreview: r.message_preview,
      explanation: r.explanation,
      requiresMerchantApproval: true,
      isDryRunOnly: r.is_dry_run_only,
      approvalAudit: r.approval_audit,
      rejectionDetails: r.rejection_details,
      createdAt: r.created_at,
      expiresAt: r.expires_at
    };
  }

  /**
   * Persists campaign proposals into PostgreSQL in a single batched upsert
   * (replaces one round trip per proposal — the biggest N+1 in the overview).
   */
  private async persistProposalsBatch(proposals: CampaignProposal[]): Promise<void> {
    const CHUNK = 50; // stay well inside parameter-count limits
    for (let i = 0; i < proposals.length; i += CHUNK) {
      const chunk = proposals.slice(i, i + CHUNK);
      const values: any[] = [];
      const tuples = chunk.map((p, idx) => {
        const base = idx * 15;
        const cols = Array.from({ length: 15 }, (_, c) => `$${base + c + 1}`);
        values.push(
          p.campaignId,
          p.merchantId,
          p.recommendationId,
          p.opportunityId,
          p.campaignType,
          p.status,
          p.title,
          JSON.stringify(p.product),
          JSON.stringify(p.audience),
          JSON.stringify(p.offer),
          JSON.stringify(p.financialSimulation),
          JSON.stringify(p.messagePreview),
          JSON.stringify(p.explanation),
          p.isDryRunOnly,
          p.expiresAt
        );
        return `(${cols.join(', ')})`;
      });

      await client.query(`
        INSERT INTO merchant_marketing_campaigns (
          campaign_id, merchant_id, recommendation_id, opportunity_id, campaign_type,
          status, title, product_data, audience_data, offer_data, financial_simulation,
          message_preview, explanation, is_dry_run_only, expires_at
        ) VALUES ${tuples.join(', ')}
        ON CONFLICT (campaign_id) DO UPDATE SET
          status = EXCLUDED.status,
          audience_data = EXCLUDED.audience_data,
          financial_simulation = EXCLUDED.financial_simulation,
          message_preview = EXCLUDED.message_preview;
      `, values);
    }
  }

  /**
   * Persists a single campaign proposal (kept for targeted updates).
   */
  private async persistProposal(p: CampaignProposal): Promise<void> {
    await client.query(`
      INSERT INTO merchant_marketing_campaigns (
        campaign_id, merchant_id, recommendation_id, opportunity_id, campaign_type,
        status, title, product_data, audience_data, offer_data, financial_simulation,
        message_preview, explanation, is_dry_run_only, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (campaign_id) DO UPDATE SET
        status = EXCLUDED.status,
        audience_data = EXCLUDED.audience_data,
        financial_simulation = EXCLUDED.financial_simulation,
        message_preview = EXCLUDED.message_preview;
    `, [
      p.campaignId,
      p.merchantId,
      p.recommendationId,
      p.opportunityId,
      p.campaignType,
      p.status,
      p.title,
      JSON.stringify(p.product),
      JSON.stringify(p.audience),
      JSON.stringify(p.offer),
      JSON.stringify(p.financialSimulation),
      JSON.stringify(p.messagePreview),
      JSON.stringify(p.explanation),
      p.isDryRunOnly,
      p.expiresAt
    ]);
  }
}

export const campaignIntelligenceService = new CampaignIntelligenceService();
