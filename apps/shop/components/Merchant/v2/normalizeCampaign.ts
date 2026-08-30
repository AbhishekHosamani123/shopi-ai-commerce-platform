'use client';

/**
 * Normalizes backend CampaignProposal payloads (campaign-intelligence-service)
 * into the CampaignModalData shape consumed by CampaignDetailModal.
 *
 * Source of truth: GET /api/merchant/campaigns/recommendations
 *   audience:      { targetIdentified, eligibleCount, suppressedCount, eligibleCustomers[], suppressionDetails[] }
 *   product:        { productId, sku, title, variantId, sellingPrice, cogsUnitCost }
 *   offer:          { category, offerValue, offerText, discountedPrice, maxSafeDiscount, marginFloorPct, safetyStatus, couponCode }
 *   financialSimulation: { grossRevenueAtList, grossRevenueAtDiscount, contributionBeforeDiscount, contributionAfterDiscount,
 *                          contributionMarginBeforePct, contributionMarginAfterPct, totalContributionSacrificed,
 *                          breakEvenIncrementalOrders, isMarginFloorPreserved }
 *   explanation:    { observed, calculated, modelEstimate, recommendation, simulation, risk }
 *   messagePreview: { channel, subject, body, ctaText, couponCode }
 *
 * Never fabricates: missing values fall back to explicit "unavailable" markers
 * (null / 0), which the modal renders as INSUFFICIENT DATA.
 */

export interface NormalizedCampaign extends Record<string, any> {
  campaignId: string;
  merchantId: string;
  title: string;
  campaignType: string;
  status: string;
  channel: string;
  activeAudienceCount: number;
  targetAudience: any[];
  targetProducts: any[];
  offer: {
    offerType: string;
    discountValue: number;
    description: string;
    isFinanciallySafe: boolean;
    couponSpec?: any;
  };
  message: {
    email?: { subject: string; previewText?: string; body: string };
    whatsApp?: { message: string };
  };
  financialAnalysis?: any;
  expectedImpact?: any;
  explanation?: {
    observation: string;
    proposedActionRationale: string;
    financialTradeoff: string;
    risks?: string[];
    assumptions?: string[];
  };
  createdAt?: string;
  expiresAt?: string;
  approvalAudit?: any;
}

const num = (v: any): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const int = (v: any, fallback = 0): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
};

const str = (v: any, fallback = ''): string =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallback;

export function normalizeCampaignForModal(raw: any): NormalizedCampaign | null {
  if (!raw || typeof raw !== 'object' || !raw.campaignId) return null;

  const audience = raw.audience || {};
  const eligibleCustomers: any[] = Array.isArray(audience.eligibleCustomers)
    ? audience.eligibleCustomers
    : Array.isArray(raw.targetAudience)
      ? raw.targetAudience
      : [];

  const eligibleCount = int(
    audience.eligibleCount ?? raw.activeAudienceCount ?? eligibleCustomers.length,
    0
  );
  const targetIdentified = int(
    audience.targetIdentified ?? (raw.targetAudience?.length ?? eligibleCount),
    eligibleCount
  );
  const suppressedCount = int(
    audience.suppressedCount ??
      (Array.isArray(audience.suppressionDetails) ? audience.suppressionDetails.length : null) ??
      Math.max(0, targetIdentified - eligibleCount),
    0
  );

  const product = raw.product || raw.targetProducts?.[0] || {};
  const sellingPrice = num(product.sellingPrice ?? product.price) ?? 0;
  const cogs = num(product.cogsUnitCost ?? product.cogs);
  // Canonical catalog stock resolved live from shopi_products (campaign product payload).
  // Falls back to 0 only when the backend genuinely did not resolve stock.
  const stock = num(product.stock ?? product.stockQuantity ?? (raw.targetProducts?.[0]?.stock ?? null));
  const stockResolved = stock !== null ? Math.max(0, Math.round(stock)) : 0;

  const offer = raw.offer || {};
  const offerValue = num(offer.offerValue ?? offer.discountValue) ?? 0;
  const offerText = str(offer.offerText, 'No incentive offer on record');
  const safetyStatus = str(offer.safetyStatus, 'UNKNOWN');

  const sim = raw.financialSimulation || {};
  const contributionBefore = num(sim.contributionBeforeDiscount ?? raw.financialAnalysis?.currentContribution);
  const maxSafeDiscount = num(offer.maxSafeDiscount ?? raw.financialAnalysis?.maxSafeDiscount);
  const isSafe =
    (typeof sim.isMarginFloorPreserved === 'boolean' && sim.isMarginFloorPreserved) ||
    safetyStatus === 'SAFE' ||
    (typeof raw.financialAnalysis?.isDiscountSafe === 'boolean' && raw.financialAnalysis.isDiscountSafe);

  const unitShipping = num(raw.financialAnalysis?.unitShipping) ?? 65;
  const unitHandling = num(raw.financialAnalysis?.unitHandling) ?? 25;
  const cogsForCost = cogs ?? 0;

  const financialAnalysis = {
    sellingPrice,
    cogs,
    cogsStatus: cogs !== null ? 'VERIFIED' : 'INSUFFICIENT DATA',
    unitShipping,
    unitHandling,
    totalVariableCost: cogsForCost + unitShipping + unitHandling,
    currentContribution: contributionBefore,
    maxSafeDiscount: maxSafeDiscount ?? 0,
    isDiscountSafe: !!isSafe
  };

  const impact = raw.expectedImpact || {};
  const simRevenue = num(
    sim.grossRevenueAtDiscount ??
      sim.grossRevenueAtList ??
      impact.simulatedGrossRevenueDelta ??
      raw.financialSimulation?.expectedRevenueLift
  );
  const simCost = num(
    sim.totalContributionSacrificed ??
      impact.simulatedDiscountCost ??
      raw.financialSimulation?.simulatedDiscountCost
  );
  const simNet = num(
    sim.contributionAfterDiscount ??
      raw.financialSimulation?.expectedNetProfitGain ??
      impact.simulatedNetContributionProfitDelta
  );

  const expectedImpact = {
    targetAudienceCount: eligibleCount,
    observedBaselineMetric: str(raw.observedBaselineMetric),
    modelEstimatedConversionLiftPct: num(impact.modelEstimatedConversionLiftPct) ?? undefined,
    simulatedIncrementalOrders: num(sim.breakEvenIncrementalOrders) ?? undefined,
    simulatedGrossRevenueDelta: simRevenue ?? 0,
    simulatedDiscountCost: simCost ?? 0,
    simulatedNetContributionProfitDelta: simNet ?? 0
  };

  const exp = raw.explanation || {};
  const observed = str(exp.observed ?? exp.observation);
  const calculated = str(exp.calculated);
  const modelEstimate = str(exp.modelEstimate);
  const recommendation = str(exp.recommendation ?? exp.proposedActionRationale);
  const simulation = str(exp.simulation);
  const risk = str(exp.risk);

  const hasAnyExplanation = [observed, calculated, modelEstimate, recommendation, simulation, risk].some(Boolean);

  const explanation = hasAnyExplanation
    ? {
        observation: observed || 'INSUFFICIENT DATA: no observed telemetry recorded for this opportunity.',
        proposedActionRationale:
          [recommendation, modelEstimate].filter(Boolean).join(' ') ||
          'INSUFFICIENT DATA: no model rationale recorded for this campaign.',
        financialTradeoff:
          [calculated, simulation].filter(Boolean).join(' ') ||
          'INSUFFICIENT DATA: no financial tradeoff simulation recorded.',
        risks: risk ? [risk] : undefined,
        assumptions: undefined
      }
    : undefined;

  const messagePreview = raw.messagePreview || {};
  const channel = str(messagePreview.channel, 'EMAIL').toUpperCase();
  const subject = str(messagePreview.subject ?? raw.message?.email?.subject);
  const body = str(messagePreview.body ?? raw.message?.email?.body);

  const message: NormalizedCampaign['message'] = {};
  if (subject || body) {
    message.email = {
      subject: subject || 'INSUFFICIENT DATA: no draft subject recorded',
      previewText: str(messagePreview.ctaText),
      body: body || 'INSUFFICIENT DATA: no draft body recorded'
    };
  }
  if (channel === 'WHATSAPP' && body) {
    message.whatsApp = { message: body };
  }

  return {
    campaignId: str(raw.campaignId),
    merchantId: str(raw.merchantId, 'default_merchant'),
    title: str(raw.title, 'Untitled campaign'),
    campaignType: str(raw.campaignType, 'UNKNOWN'),
    status: str(raw.status, 'READY_FOR_REVIEW'),
    channel: channel === 'WHATSAPP' ? 'WHATSAPP' : channel === 'MULTI_CHANNEL' ? 'MULTI_CHANNEL' : 'EMAIL',
    activeAudienceCount: eligibleCount,
    targetAudience: eligibleCustomers.map((c: any) => ({
      customerId: str(c.customerId, 'UNKNOWN'),
      customerName: str(c.customerName, `Customer #${c.customerId ?? 'UNKNOWN'}`),
      email: str(c.email),
      segment: str(c.reason, 'PROSPECT'),
      isEligible: true,
      ineligibilityReason: undefined
    })),
    targetProducts: [
      {
        productId: int(product.productId, 0),
        title: str(product.title ?? product.sku, 'Catalog product'),
        price: sellingPrice,
        stock: stockResolved
      }
    ],
    offer: {
      offerType: str(offer.category ?? offer.offerType, 'SAFE_INCENTIVE'),
      offerText: offerText,
      discountValue: offerValue,
      description: offerText,
      isFinanciallySafe: !!isSafe,
      couponSpec: offer.couponCode ? { code: offer.couponCode } : undefined
    },
    message,
    financialAnalysis,
    expectedImpact,
    explanation,
    createdAt: str(raw.createdAt) || undefined,
    expiresAt: str(raw.expiresAt) || undefined,
    approvalAudit: raw.approvalAudit || undefined,
    // Suppressed audience members for the eligibility registry
    __suppressionDetails: Array.isArray(audience.suppressionDetails) ? audience.suppressionDetails : [],
    __targetIdentified: targetIdentified,
    __suppressedCount: suppressedCount,
    __risk: risk || undefined
  } as NormalizedCampaign;
}

export function normalizeCampaignsForModal(list: any[]): NormalizedCampaign[] {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeCampaignForModal).filter((c): c is NormalizedCampaign => c !== null);
}
