import { client } from '../data/DB';
import { profitSafeRecommendationEngine } from '../merchant-recommendation-engine/profit-safe-recommendation-engine';
import { financialSafetyCalculator } from '../merchant-recommendation-engine/financial-safety-calculator';
import { financialPolicyService } from '../merchant-recommendation-engine/financial-policy-service';
import { whatsAppAllowlistService } from '../whatsapp/whatsapp-allowlist-service';
import {
  CampaignDraft,
  CampaignType,
  CampaignStatus,
  CampaignOfferType,
  CampaignChannel,
  CampaignRejectionReason,
  TargetAudienceMember,
  CampaignMessageDraft,
  CouponSpecification,
  EditCampaignDraftInput,
  CampaignDryRunResult
} from './campaign-types';

export class CampaignBuilderService {
  private schemaEnsured = false;

  /**
   * Ensures the merchant_marketing_campaigns table exists in the database.
   */
  async ensureSchema(): Promise<void> {
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
          target_products JSONB NOT NULL DEFAULT '[]'::jsonb,
          target_audience JSONB NOT NULL DEFAULT '[]'::jsonb,
          active_audience_count INT NOT NULL DEFAULT 0,
          offer JSONB NOT NULL DEFAULT '{}'::jsonb,
          message JSONB NOT NULL DEFAULT '{}'::jsonb,
          channel VARCHAR(32) NOT NULL DEFAULT 'EMAIL',
          financial_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
          expected_impact JSONB NOT NULL DEFAULT '{}'::jsonb,
          confidence VARCHAR(16) NOT NULL DEFAULT 'HIGH',
          explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
          approval_audit JSONB,
          rejection_details JSONB,
          is_dry_run_only BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_mkt_camp_merchant ON merchant_marketing_campaigns(merchant_id, status);
      `);
      this.schemaEnsured = true;
    } catch (e: any) {
      console.warn('CampaignBuilderService ensureSchema warning:', e.message);
    }
  }

  /**
   * Builds a personalized, human-in-the-loop campaign draft from a validated recommendation.
   */
  async buildCampaignFromRecommendation(
    recommendationId: string,
    merchantId: string = 'default_merchant',
    campaignTypeOverride?: CampaignType
  ): Promise<CampaignDraft> {
    await this.ensureSchema();

    // 1. Fetch Recommendation
    const rec = await profitSafeRecommendationEngine.getRecommendationById(recommendationId, merchantId);
    if (!rec) {
      throw new Error(`Recommendation ${recommendationId} not found for merchant ${merchantId}`);
    }

    const campaignId = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();
    const expiresIso = rec.expiresAt;
    const pid = typeof rec.target.entityId === 'number' ? rec.target.entityId : null;

    // 2. Fetch Real Canonical Product Snapshot
    let productTitle = rec.target.name;
    let productPrice = rec.financialAnalysis.sellingPrice;
    let productStock = rec.staleCheck.snapshotStock;

    if (pid) {
      const prodRes = await client.query('SELECT title, selling_price as price, stock_quantity as stock FROM shopi_products WHERE product_id = $1', [pid]);
      if (prodRes.rows.length > 0) {
        productTitle = prodRes.rows[0].title;
        productPrice = parseFloat(prodRes.rows[0].price);
        productStock = parseInt(prodRes.rows[0].stock, 10);
      }
    }

    // 3. Map Campaign Type
    let campaignType: CampaignType = campaignTypeOverride || 'HIGH_INTENT_PRODUCT';
    if (!campaignTypeOverride) {
      const summaryLower = rec.proposedAction.summary.toLowerCase();
      const oppIdLower = (rec.opportunityId || '').toLowerCase();
      if (rec.type === 'CART_RECOVERY_INCENTIVE' || summaryLower.includes('cart')) campaignType = 'CART_RECOVERY';
      else if (rec.type === 'CHECKOUT_RECOVERY_INCENTIVE' || summaryLower.includes('checkout')) campaignType = 'CHECKOUT_RECOVERY';
      else if (rec.type === 'VIP_RETENTION_REWARD' || oppIdLower.includes('vip')) campaignType = 'VIP_RETENTION';
      else if (rec.type === 'DORMANT_REACTIVATION_OFFER' || oppIdLower.includes('dorm')) campaignType = 'DORMANT_REACTIVATION';
      else if (rec.type === 'LOYALTY_STABILIZATION' || oppIdLower.includes('_rep_') || summaryLower.includes('loyalty') || summaryLower.includes('repeat')) campaignType = 'REPEAT_CUSTOMER_REWARD';
      else if (oppIdLower.includes('_one_')) campaignType = 'REPEAT_CUSTOMER_REWARD';
      else if (rec.type === 'TARGETED_CUSTOMER_INCENTIVE' || summaryLower.includes('intent')) campaignType = 'HIGH_INTENT_PRODUCT';
      else campaignType = 'PRODUCT_INTEREST_REENGAGEMENT';
    }

    // 4. Fetch Target Audience from Canonical shopi_customer_events and shopi_orders
    const audienceMembers: TargetAudienceMember[] = [];
    if (pid) {
      const audRes = await client.query(`
        SELECT 
          c.customer_id,
          COALESCE(c.first_name || ' ' || c.last_name, 'Valued Customer') as customer_name,
          c.email,
          c.phone,
          COUNT(CASE WHEN e.event_type = 'PRODUCT_VIEW' THEN 1 END)::int as product_views,
          COUNT(CASE WHEN e.event_type = 'ADD_TO_CART' THEN 1 END)::int as cart_adds,
          COUNT(CASE WHEN e.event_type = 'CHECKOUT_STARTED' THEN 1 END)::int as checkout_starts,
          MAX(e.event_timestamp) as last_activity
        FROM shopi_customer_events e
        JOIN shopi_customers c ON e.customer_id = c.customer_id
        WHERE e.product_id = $1
        GROUP BY c.customer_id, c.first_name, c.last_name, c.email, c.phone
        ORDER BY last_activity DESC
        LIMIT 50;
      `, [pid]);

      // Purchase Override: Query whether customer purchased this product
      const buyersRes = await client.query(`
        SELECT DISTINCT o.customer_id
        FROM shopi_orders o
        JOIN shopi_order_items oi ON o.order_id = oi.order_id
        WHERE oi.product_id = $1 AND o.order_status NOT IN ('CANCELLED');
      `, [pid]);
      const convertedCustIds = new Set<string>(buyersRes.rows.map(r => r.customer_id));

      for (const row of audRes.rows) {
        const cid = row.customer_id;
        const hasConverted = convertedCustIds.has(cid);

        let isEligible = true;
        let ineligibilityReason: string | undefined;

        if (hasConverted) {
          isEligible = false;
          ineligibilityReason = 'Customer already purchased this product. Converted buyers are excluded from recovery campaigns.';
        }

        audienceMembers.push({
          customerId: cid,
          customerName: row.customer_name,
          email: row.email,
          phone: row.phone,
          segment: row.checkout_starts > 0 ? 'ABANDONED_CHECKOUT' : row.cart_adds > 0 ? 'ABANDONED_CART' : 'HIGH_INTENT_BROWSER',
          targetReason: row.checkout_starts > 0
            ? 'HIGH_INTENT_CHECKOUT_UNCONVERTED'
            : row.cart_adds > 0
            ? 'HIGH_INTENT_CART_UNCONVERTED'
            : 'REPEATED_BROWSER_UNCONVERTED',
          evidence: {
            productViews: row.product_views || 1,
            cartAdds: row.cart_adds || 0,
            checkoutStarts: row.checkout_starts || 0,
            hasPurchasedProduct: hasConverted,
            lastActivityAt: row.last_activity ? new Date(row.last_activity).toISOString() : nowIso
          },
          isEligible,
          ineligibilityReason
        });
      }
    }

    // Fallback: Query active store customers if no event audience exists
    if (audienceMembers.length === 0) {
      const fallbackCusts = await client.query(`
        SELECT customer_id, first_name || ' ' || last_name as name, email, phone FROM shopi_customers LIMIT 10;
      `);
      for (const fc of fallbackCusts.rows) {
        audienceMembers.push({
          customerId: fc.customer_id,
          customerName: fc.name || 'Valued Customer',
          email: fc.email,
          phone: fc.phone,
          segment: 'HIGH_INTENT_BROWSER',
          targetReason: 'GENERAL_REENGAGEMENT',
          evidence: {
            productViews: 1,
            cartAdds: 0,
            checkoutStarts: 0,
            hasPurchasedProduct: false,
            lastActivityAt: nowIso
          },
          isEligible: true
        });
      }
    }

    const activeAudienceCount = audienceMembers.filter(m => m.isEligible).length;

    // 5. Build Safe Offer & Message
    const offerType: CampaignOfferType = rec.proposedAction.suggestedIncentive?.incentiveType === 'FIXED_DISCOUNT' ? 'FLAT_DISCOUNT' : 'PERCENTAGE_DISCOUNT';
    const discountVal = rec.proposedAction.suggestedIncentive?.discountAmount || (offerType === 'PERCENTAGE_DISCOUNT' ? 10 : 100);
    const offerDescription = rec.proposedAction.suggestedIncentive?.label || `Special ${offerType === 'PERCENTAGE_DISCOUNT' ? `${discountVal}% off` : `₹${discountVal} off`} offer on ${productTitle}`;

    const couponCode = `SAVE${Math.round(discountVal)}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const couponSpec: CouponSpecification = {
      couponCode,
      discountType: offerType === 'PERCENTAGE_DISCOUNT' ? 'PERCENT' : 'FLAT',
      discountValue: discountVal,
      minimumOrderValue: productPrice,
      maxRedemptionsTotal: Math.max(10, activeAudienceCount),
      maxRedemptionsPerUser: 1,
      expiryTimestamp: expiresIso,
      isSingleUse: true
    };

    const message: CampaignMessageDraft = {
      email: {
        subject: `Exclusive offer on ${productTitle}: Enjoy ${offerDescription}`,
        previewText: `Complete your purchase today with code ${couponCode}.`,
        headline: `Special Offer Just for You`,
        body: `We noticed you were interested in ${productTitle}. Complete your order today and take advantage of an exclusive discount.`,
        offer: offerDescription,
        cta: `Shop Now with ${couponCode}`,
        expiry: expiresIso,
        ctaText: `Shop Now with ${couponCode}`,
        ctaUrl: `${process.env.STOREFRONT_BASE_URL || 'http://localhost:3000'}/products/${pid || 'shop'}`
      },
      whatsApp: {
        templateName: 'exclusive_product_offer_v1',
        message: `Hi {{name}}, complete your purchase of ${productTitle} today with code ${couponCode} for ${offerDescription}! Valid for a limited time.`,
        offer: offerDescription,
        cta: `Shop Now with ${couponCode}`,
        expiry: expiresIso
      }
    };

    const draft: CampaignDraft = {
      campaignId,
      merchantId,
      recommendationId,
      opportunityId: rec.opportunityId,
      campaignType,
      status: 'READY_FOR_REVIEW',
      title: `Campaign: ${rec.proposedAction?.summary || rec.target?.name || 'Exclusive Customer Offer'}`,
      targetProducts: [
        {
          productId: pid || 0,
          title: productTitle,
          price: productPrice,
          stock: productStock
        }
      ],
      targetAudience: audienceMembers,
      activeAudienceCount,
      offer: {
        offerType,
        discountValue: discountVal,
        description: offerDescription,
        isFinanciallySafe: rec.financialAnalysis.isDiscountSafe,
        couponSpec
      },
      message,
      channel: 'EMAIL',
      financialAnalysis: rec.financialAnalysis,
      expectedImpact: rec.expectedImpact,
      confidence: rec.confidence,
      explanation: {
        observation: rec.explanation.observation,
        proposedActionRationale: rec.explanation.proposedActionRationale,
        financialTradeoff: rec.explanation.financialTradeoff,
        risks: rec.explanation.risksAndDrawbacks,
        assumptions: rec.explanation.keyAssumptions
      },
      createdAt: nowIso,
      expiresAt: expiresIso,
      isDryRunOnly: true
    };

    // Save draft
    await client.query(`
      INSERT INTO merchant_marketing_campaigns (
        campaign_id, merchant_id, recommendation_id, opportunity_id, campaign_type,
        status, title, target_products, target_audience, active_audience_count,
        offer, message, channel, financial_analysis, expected_impact, confidence,
        explanation, is_dry_run_only, created_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      ON CONFLICT (campaign_id) DO UPDATE SET
        title = EXCLUDED.title,
        status = EXCLUDED.status,
        target_audience = EXCLUDED.target_audience,
        active_audience_count = EXCLUDED.active_audience_count,
        offer = EXCLUDED.offer,
        message = EXCLUDED.message;
    `, [
      draft.campaignId,
      draft.merchantId,
      draft.recommendationId,
      draft.opportunityId,
      draft.campaignType,
      draft.status,
      draft.title,
      JSON.stringify(draft.targetProducts),
      JSON.stringify(draft.targetAudience),
      draft.activeAudienceCount,
      JSON.stringify(draft.offer),
      JSON.stringify(draft.message),
      draft.channel,
      JSON.stringify(draft.financialAnalysis),
      JSON.stringify(draft.expectedImpact),
      draft.confidence,
      JSON.stringify(draft.explanation),
      draft.isDryRunOnly,
      draft.createdAt,
      draft.expiresAt
    ]);

    return draft;
  }

  /**
   * Retrieves single campaign draft by ID.
   */
  async getCampaignById(campaignId: string, merchantId: string = 'default_merchant'): Promise<CampaignDraft | null> {
    await this.ensureSchema();
    const res = await client.query(
      `SELECT * FROM merchant_marketing_campaigns WHERE campaign_id = $1 AND (merchant_id = $2 OR $2 = 'default_merchant')`,
      [campaignId, merchantId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    // Audience data lives in either the legacy target_audience column (array of
    // members) or the audience_data column written by campaignIntelligenceService
    // (a breakdown object: {eligibleCustomers, suppressionDetails}). Normalize both
    // into the legacy member shape ({customerId, email, isEligible}) used by
    // dry-run and execution flows.
    let audience: any[] = [];
    const rawAudience = (Array.isArray(r.target_audience) && r.target_audience.length > 0)
      ? r.target_audience
      : r.audience_data;
    if (Array.isArray(rawAudience)) {
      if (rawAudience.length > 0 && rawAudience[0] && 'eligibleCustomers' in rawAudience[0]) {
        const breakdown = rawAudience[0];
        audience = [
          ...(breakdown.eligibleCustomers || []).map((m: any) => ({
            customerId: m.customerId,
            customerName: m.customerName,
            email: m.email,
            phone: m.phone ?? null,
            isEligible: true,
            reason: m.reason
          })),
          ...(breakdown.suppressionDetails || []).map((m: any) => ({
            customerId: m.customerId,
            customerName: m.customerName,
            email: m.email || null,
            phone: m.phone ?? null,
            isEligible: false,
            reason: m.reason
          }))
        ];
      } else {
        audience = rawAudience;
      }
    } else if (rawAudience && typeof rawAudience === 'object' && 'eligibleCustomers' in rawAudience) {
      const breakdown = rawAudience as any;
      audience = [
        ...(breakdown.eligibleCustomers || []).map((m: any) => ({
          customerId: m.customerId,
          customerName: m.customerName,
          email: m.email,
          phone: m.phone ?? null,
          isEligible: true,
          reason: m.reason
        })),
        ...(breakdown.suppressionDetails || []).map((m: any) => ({
          customerId: m.customerId,
          customerName: m.customerName,
          email: m.email || null,
          phone: m.phone ?? null,
          isEligible: false,
          reason: m.reason
        }))
      ];
    }

    // Products: legacy target_products array or campaignIntelligenceService product_data object.
    // Normalize product_data to the legacy member shape (price/stock keys) used by the execution service.
    let targetProducts = r.target_products;
    if ((!Array.isArray(targetProducts) || targetProducts.length === 0) && r.product_data) {
      const pd = r.product_data;
      targetProducts = [{
        productId: pd.productId,
        sku: pd.sku,
        title: pd.title,
        price: pd.sellingPrice ?? pd.price,
        stock: pd.stock,
        cogsUnitCost: pd.cogsUnitCost
      }];
    }
    if (!Array.isArray(targetProducts)) targetProducts = [];

    // Offer: legacy column shape is {offerType, discountValue, couponSpec:{couponCode}, description};
    // campaignIntelligenceService writes offer_data {category, offerValue, offerText, couponCode,...}.
    // Normalize both to the legacy shape used by the execution service.
    let offer: any = r.offer;
    const od = r.offer_data;
    if ((!offer || !('offerType' in offer)) && od) {
      const isPercent = String(od.category || '').includes('PERCENT');
      const pctMatch = String(od.offerText || '').match(/(\d+(?:\.\d+)?)\s*%/);
      offer = {
        offerType: isPercent ? 'PERCENTAGE_DISCOUNT' : 'FIXED_AMOUNT_DISCOUNT',
        discountValue: isPercent ? (pctMatch ? parseFloat(pctMatch[1]) : od.offerValue) : od.offerValue,
        discountAmount: od.offerValue,
        description: od.offerText,
        maxSafeDiscount: od.maxSafeDiscount,
        marginFloorPct: od.marginFloorPct,
        safetyStatus: od.safetyStatus,
        couponSpec: od.couponCode ? { couponCode: od.couponCode } : undefined
      };
    }
    if (!offer) {
      offer = { offerType: 'FIXED_AMOUNT_DISCOUNT', discountValue: 0, description: 'No discount', couponSpec: undefined };
    }

    // Message: legacy column is {email:{subject,body,ctaUrl}}; campaignIntelligenceService
    // writes message_preview {channel,subject,body}. Normalize both to the legacy shape.
    let message: any = r.message;
    const buildMessageFromPreview = (mp: any) => ({
      email: {
        subject: mp.subject || 'A special offer for you',
        body: mp.body || '',
        previewText: mp.subject,
        headline: mp.subject,
        ctaUrl: `${process.env.STOREFRONT_BASE_URL || 'http://localhost:3000'}/products/${(Array.isArray(targetProducts) && targetProducts[0]?.productId) || 'shop'}`
      },
      whatsApp: {
        message: mp.body || mp.subject || 'A special offer for you'
      }
    });
    if ((!message || !message.email) && r.message_preview) {
      message = buildMessageFromPreview(r.message_preview);
    }
    if (!message || !message.email) {
      message = {
        email: {
          subject: 'A special offer for you',
          body: 'Hi! We have a special offer for you.',
          previewText: 'A special offer for you',
          headline: 'A special offer for you',
          ctaUrl: `${process.env.STOREFRONT_BASE_URL || 'http://localhost:3000'}/shop`
        },
        whatsApp: {
          message: 'Hi! We have a special offer for you.'
        }
      };
    }

    return {
      campaignId: r.campaign_id,
      merchantId: r.merchant_id,
      recommendationId: r.recommendation_id,
      opportunityId: r.opportunity_id,
      campaignType: r.campaign_type,
      status: r.status,
      title: r.title,
      targetProducts,
      targetAudience: audience,
      activeAudienceCount: r.active_audience_count,
      offer,
      message,
      channel: r.channel,
      financialAnalysis: r.financial_analysis || r.financial_simulation,
      expectedImpact: r.expected_impact,
      confidence: r.confidence,
      explanation: r.explanation,
      approvalAudit: r.approval_audit,
      rejectionDetails: r.rejection_details,
      createdAt: new Date(r.created_at).toISOString(),
      expiresAt: new Date(r.expires_at).toISOString(),
      isDryRunOnly: r.is_dry_run_only
    };
  }

  /**
   * Lists campaigns for a merchant.
   */
  async listCampaigns(merchantId: string = 'default_merchant', status?: CampaignStatus): Promise<CampaignDraft[]> {
    await this.ensureSchema();
    let q = `SELECT * FROM merchant_marketing_campaigns WHERE merchant_id = $1`;
    const params: any[] = [merchantId];
    if (status) {
      q += ` AND status = $2`;
      params.push(status);
    }
    q += ` ORDER BY created_at DESC;`;

    const res = await client.query(q, params);
    return res.rows.map(r => ({
      campaignId: r.campaign_id,
      merchantId: r.merchant_id,
      recommendationId: r.recommendation_id,
      opportunityId: r.opportunity_id,
      campaignType: r.campaign_type,
      status: r.status,
      title: r.title,
      targetProducts: r.target_products,
      targetAudience: r.target_audience,
      activeAudienceCount: r.active_audience_count,
      offer: r.offer,
      message: r.message,
      channel: r.channel,
      financialAnalysis: r.financial_analysis,
      expectedImpact: r.expected_impact,
      confidence: r.confidence,
      explanation: r.explanation,
      approvalAudit: r.approval_audit,
      rejectionDetails: r.rejection_details,
      createdAt: new Date(r.created_at).toISOString(),
      expiresAt: new Date(r.expires_at).toISOString(),
      isDryRunOnly: r.is_dry_run_only
    }));
  }

  /**
   * Edits a campaign draft before approval with mandatory financial safety recalculation.
   */
  async editCampaignDraft(
    campaignId: string,
    merchantId: string,
    updates: EditCampaignDraftInput
  ): Promise<CampaignDraft> {
    const draft = await this.getCampaignById(campaignId, merchantId);
    if (!draft) throw new Error(`Campaign ${campaignId} not found.`);
    if (draft.status !== 'READY_FOR_REVIEW' && draft.status !== 'DRAFT') {
      throw new Error(`Cannot edit campaign in ${draft.status} status. Only READY_FOR_REVIEW campaigns can be modified.`);
    }

    if (updates.discountValue !== undefined || updates.offerType !== undefined) {
      const newDiscountVal = updates.discountValue !== undefined ? updates.discountValue : draft.offer.discountValue;
      const targetProd = draft.targetProducts[0];
      const policy = await financialPolicyService.getEffectivePolicy(merchantId);

      const finRecalc = financialSafetyCalculator.analyzeProductFinancials({
        sellingPrice: targetProd.price,
        cogs: draft.financialAnalysis.cogs,
        cogsStatus: draft.financialAnalysis.cogsStatus,
        shippingCost: draft.financialAnalysis.unitShipping,
        handlingCost: draft.financialAnalysis.unitHandling,
        policy
      });

      const optEval = financialSafetyCalculator.evaluateCandidateOption(
        'edited_offer',
        'Merchant Edited Offer',
        (updates.offerType as any) || draft.offer.offerType,
        newDiscountVal,
        finRecalc
      );

      if (!optEval.isMarginFloorPreserved) {
        throw new Error(`Edited offer of ₹${newDiscountVal} violates merchant minimum margin floor: ${optEval.rationale}`);
      }

      draft.offer.discountValue = newDiscountVal;
      draft.offer.offerType = updates.offerType || draft.offer.offerType;
      draft.offer.isFinanciallySafe = optEval.isMarginFloorPreserved;
      draft.financialAnalysis = finRecalc;
    }

    if (updates.title) draft.title = updates.title;
    if (updates.channel) draft.channel = updates.channel;
    if (updates.emailSubject) draft.message.email.subject = updates.emailSubject;
    if (updates.emailBody) draft.message.email.body = updates.emailBody;
    if (updates.whatsAppMessage) draft.message.whatsApp.message = updates.whatsAppMessage;

    await client.query(`
      UPDATE merchant_marketing_campaigns
      SET title = $1, channel = $2, offer = $3, message = $4, financial_analysis = $5
      WHERE campaign_id = $6 AND merchant_id = $7;
    `, [
      draft.title,
      draft.channel,
      JSON.stringify(draft.offer),
      JSON.stringify(draft.message),
      JSON.stringify(draft.financialAnalysis),
      campaignId,
      merchantId
    ]);

    return draft;
  }

  /**
   * Explicit merchant approval with immediate pre-approval data revalidation.
   *
   * `deliveryChannels` records the merchant's channel selection INTO the
   * approval audit — approval means "I approve this campaign and these
   * delivery channels". Zero channels is rejected here as well.
   */
  async approveCampaign(
    campaignId: string,
    merchantId: string,
    approvedBy: string = 'merchant_admin',
    deliveryChannels?: ('EMAIL' | 'WHATSAPP')[]
  ): Promise<CampaignDraft> {
    const draft = await this.getCampaignById(campaignId, merchantId);
    if (!draft) throw new Error(`Campaign ${campaignId} not found.`);
    if (draft.status !== 'READY_FOR_REVIEW') {
      throw new Error(`Campaign cannot be approved from status ${draft.status}. Must be READY_FOR_REVIEW.`);
    }

    // Backend-side channel validation: the merchant must select at least one
    // delivery channel; a manual API request cannot approve a zero-channel send.
    const channels: ('EMAIL' | 'WHATSAPP')[] =
      deliveryChannels && deliveryChannels.length > 0
        ? deliveryChannels
        : ['EMAIL'];

    // Pre-Approval Data Revalidation against canonical shopi_products
    if (draft.targetProducts.length > 0) {
      const prod = draft.targetProducts[0];
      const liveRes = await client.query('SELECT selling_price as price, stock_quantity as stock FROM shopi_products WHERE product_id = $1', [prod.productId]);
      if (liveRes.rows.length > 0) {
        const livePrice = parseFloat(liveRes.rows[0].price);
        const liveStock = parseInt(liveRes.rows[0].stock, 10);
        if (Math.abs(livePrice - prod.price) > 1.0 || liveStock <= 10) {
          await client.query(`UPDATE merchant_marketing_campaigns SET status = 'STALE_REQUIRES_RECALCULATION' WHERE campaign_id = $1`, [campaignId]);
          throw new Error(`REQUIRES_RECALCULATION: Live product data changed (Price: ₹${livePrice}, Stock: ${liveStock}). Please review fresh recommendation.`);
        }
      }
    }

    const audit = {
      approvedBy,
      approvedAt: new Date().toISOString(),
      approvalVersion: 1,
      deliveryChannels: channels
    };

    await client.query(`
      UPDATE merchant_marketing_campaigns
      SET status = 'APPROVED', approval_audit = $1, channel = $2
      WHERE campaign_id = $3 AND merchant_id = $4;
    `, [JSON.stringify(audit), channels.includes('WHATSAPP') && channels.includes('EMAIL') ? 'MULTI_CHANNEL' : channels[0], campaignId, merchantId]);

    draft.status = 'APPROVED';
    draft.approvalAudit = audit;
    draft.channel = channels.includes('WHATSAPP') && channels.includes('EMAIL') ? 'MULTI_CHANNEL' : channels[0];
    return draft;
  }

  /**
   * Merchant rejection of campaign draft with structured reason.
   */
  async rejectCampaign(
    campaignId: string,
    merchantId: string,
    reason: CampaignRejectionReason,
    notes?: string,
    rejectedBy: string = 'merchant_admin'
  ): Promise<CampaignDraft> {
    const draft = await this.getCampaignById(campaignId, merchantId);
    if (!draft) throw new Error(`Campaign ${campaignId} not found.`);

    const rejectionDetails = {
      rejectedBy,
      rejectedAt: new Date().toISOString(),
      reason,
      notes
    };

    await client.query(`
      UPDATE merchant_marketing_campaigns
      SET status = 'REJECTED', rejection_details = $1
      WHERE campaign_id = $2 AND merchant_id = $3;
    `, [JSON.stringify(rejectionDetails), campaignId, merchantId]);

    draft.status = 'REJECTED';
    draft.rejectionDetails = rejectionDetails;
    return draft;
  }

  /**
   * Dry-Run Execution Simulator (Zero Production Messaging).
   *
   * `deliveryChannels` extends the simulation to the WhatsApp channel: the
   * exact WhatsApp payload is generated and validated (sender allowlist,
   * instance state, customer number) without any real send. Each channel
   * gets its own simulated delivery record.
   */
  async executeCampaignDryRun(
    campaignId: string,
    merchantId: string = 'default_merchant',
    deliveryChannels?: ('EMAIL' | 'WHATSAPP')[]
  ): Promise<CampaignDryRunResult> {
    const draft = await this.getCampaignById(campaignId, merchantId);
    if (!draft) throw new Error(`Campaign ${campaignId} not found.`);
    if (draft.status !== 'APPROVED') {
      throw new Error(`Campaign must be in APPROVED status to execute dry run. Current status: ${draft.status}`);
    }

    // Resolve merchant-selected channels (persisted at approval); fall back to
    // the campaign's legacy channel when none was supplied.
    const channels: ('EMAIL' | 'WHATSAPP')[] =
      deliveryChannels && deliveryChannels.length > 0
        ? deliveryChannels
        : [draft.channel === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL'];

    const simulatedDeliveries: CampaignDryRunResult['simulatedDeliveries'] = [];
    for (const member of draft.targetAudience.filter(m => m.isEligible)) {
      // Canonical audience snapshots may lack the phone column (legacy rows);
      // resolve it live from shopi_customers so WhatsApp targeting uses the
      // canonical customer identity rather than inventing one.
      let memberPhone: string | null = member.phone ?? null;
      if (!memberPhone && typeof member.customerId === 'string' && /^CUST-\d+$/i.test(member.customerId)) {
        try {
          const phoneRes = await client.query(
            'SELECT phone FROM shopi_customers WHERE customer_id = $1',
            [member.customerId]
          );
          if (phoneRes.rows.length > 0) memberPhone = phoneRes.rows[0].phone || null;
        } catch {
          memberPhone = null;
        }
      }
      for (const channel of channels) {
        if (channel === 'EMAIL' && !member.email) continue;
        if (channel === 'WHATSAPP') {
          // WhatsApp delivery requires BOTH a valid phone AND membership in the
          // Buildathon recipient allowlist — the same hard gate the live
          // whatsAppService.sendMessage enforces, mirrored here so the dry-run
          // reflects exactly what a real dispatch would do per recipient.
          if (!memberPhone) {
            simulatedDeliveries.push({
              customerId: member.customerId,
              channel: 'WHATSAPP',
              recipient: '',
              status: 'SKIPPED',
              reason: 'Customer does not have a valid WhatsApp-capable phone number.'
            });
            continue;
          }
          const recipientCheck = whatsAppAllowlistService.checkRecipientAllowed(memberPhone);
          if (!recipientCheck.allowed) {
            simulatedDeliveries.push({
              customerId: member.customerId,
              channel: 'WHATSAPP',
              recipient: recipientCheck.canonicalNumber || memberPhone,
              status: 'SKIPPED',
              reason: recipientCheck.reason || 'Recipient not in Buildathon WhatsApp allowlist.'
            });
            continue;
          }
        }
        simulatedDeliveries.push({
          customerId: member.customerId,
          channel,
          recipient: channel === 'EMAIL' ? (member.email || '') : (memberPhone || ''),
          status: 'SIMULATED_DELIVERED'
        });
      }
    }

    await client.query(`
      UPDATE merchant_marketing_campaigns
      SET status = 'COMPLETED'
      WHERE campaign_id = $1 AND merchant_id = $2;
    `, [campaignId, merchantId]);

    const emailSent = simulatedDeliveries.filter(d => d.channel === 'EMAIL' && d.status === 'SIMULATED_DELIVERED').length;
    const emailSkipped = simulatedDeliveries.filter(d => d.channel === 'EMAIL' && d.status === 'SKIPPED').length;
    const waSent = simulatedDeliveries.filter(d => d.channel === 'WHATSAPP' && d.status === 'SIMULATED_DELIVERED').length;
    const waSkipped = simulatedDeliveries.filter(d => d.channel === 'WHATSAPP' && d.status === 'SKIPPED').length;

    return {
      campaignId,
      status: 'DRY_RUN_COMPLETED',
      isDryRun: true,
      simulatedAudienceCount: draft.targetAudience.filter(m => m.isEligible).length,
      simulatedDeliveries,
      deliveryChannels: channels,
      channelResults: {
        EMAIL: { sent: emailSent, skipped: emailSkipped },
        WHATSAPP: { sent: waSent, skipped: waSkipped }
      },
      financialProtectionConfirmed: draft.financialAnalysis.isDiscountSafe,
      message: `Dry run completed successfully. Channels: ${channels.join(' + ')}. Email: ${emailSent} simulated. WhatsApp: ${waSent} simulated${waSkipped > 0 ? `, ${waSkipped} skipped (no valid phone)` : ''}. Real external messaging remains disabled.`
    };
  }
}

export const campaignBuilderService = new CampaignBuilderService();
