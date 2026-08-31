/**
 * Payload trimmers for merchant intelligence collections.
 *
 * The raw engine outputs carry deep per-record evidence trees, alternative
 * offer ladders and full audience breakdowns — 191 opportunities ≈ 474 KB,
 * 191 recommendations ≈ 987 KB, 185 campaigns ≈ 483 KB (2 MB total). The
 * overview dashboard renders at most a handful of each and only a small
 * subset of the fields; detail drawers fetch full records from their own
 * endpoints (`/opportunities/:id`, `/campaigns/:id`, actions ledger).
 *
 * These trimmers return ONLY the fields the overview UI reads, which cuts
 * the response by ~97% without changing any displayed information.
 */

import { normalizeCampaignShape } from './campaign-normalizer';

export interface TrimmedOpportunity {
  opportunityId: string;
  type: string;
  priority: string;
  priorityScore?: number;
  status: string;
  title: string;
  summary: string;
  estimatedValueInr?: number;
  target: {
    name?: string;
    entityType?: string;
    entityId?: string | number;
    productId?: number;
    productTitle?: string;
    customerId?: string;
  };
  metrics: {
    potentialRevenue?: number;
  };
}

export function trimOpportunities(opportunities: any[], limit = 12): TrimmedOpportunity[] {
  if (!Array.isArray(opportunities)) return [];
  return opportunities.slice(0, limit).map((o: any) => ({
    opportunityId: o.opportunityId,
    type: o.type,
    priority: o.priority,
    priorityScore: o.priorityScore,
    status: o.status,
    title: o.title,
    summary: o.summary,
    estimatedValueInr: o.estimatedValueInr,
    target: {
      name: o.target?.name,
      entityType: o.target?.entityType,
      entityId: o.target?.entityId,
      productId: typeof o.target?.productId === 'number' ? o.target.productId : undefined,
      productTitle: o.target?.productTitle,
      customerId: o.target?.customerId
    },
    metrics: {
      potentialRevenue: o.metrics?.potentialRevenue ?? o.estimatedValueInr ?? 0
    }
  }));
}

export interface TrimmedRecommendation {
  recommendationId: string;
  opportunityId?: string;
  type: string;
  status: string;
  priorityScore?: number;
  title?: string;
  confidence?: string;
  createdAt?: string;
  expiresAt?: string;
  target: {
    entityType?: string;
    entityId?: string | number;
    name?: string;
    customerName?: string;
    productId?: number;
    productTitle?: string;
    sku?: string;
  };
  proposedAction: {
    actionType?: string;
    summary?: string;
    suggestedRestockUnits?: number | null;
  };
  expectedImpact?: {
    simulatedGrossRevenueDelta?: number;
    simulatedIncrementalOrders?: number;
    simulatedNetContributionProfitDelta?: number;
  };
  staleCheck?: { snapshotStock?: number };
  financialAnalysis?: { currentMarginPct?: number };
  explanation?: { observation?: string };
}

export function trimRecommendations(recommendations: any[], limit = 8): TrimmedRecommendation[] {
  if (!Array.isArray(recommendations)) return [];
  return recommendations.slice(0, limit).map((rec: any) => ({
    recommendationId: rec.recommendationId,
    opportunityId: rec.opportunityId,
    type: rec.type,
    status: rec.status,
    priorityScore: rec.priorityScore,
    title: rec.title,
    confidence: rec.confidence,
    createdAt: rec.createdAt,
    expiresAt: rec.expiresAt,
    target: {
      entityType: rec.target?.entityType,
      entityId: rec.target?.entityId,
      name: rec.target?.name,
      customerName: rec.target?.customerName,
      productId: typeof rec.target?.productId === 'number' ? rec.target.productId : undefined,
      productTitle: rec.target?.productTitle,
      sku: rec.target?.sku
    },
    proposedAction: {
      actionType: rec.proposedAction?.actionType,
      summary: rec.proposedAction?.summary,
      suggestedRestockUnits: rec.proposedAction?.suggestedRestockUnits ?? null
    },
    expectedImpact: rec.expectedImpact ? {
      simulatedGrossRevenueDelta: rec.expectedImpact.simulatedGrossRevenueDelta,
      simulatedIncrementalOrders: rec.expectedImpact.simulatedIncrementalOrders,
      simulatedNetContributionProfitDelta: rec.expectedImpact.simulatedNetContributionProfitDelta
    } : undefined,
    staleCheck: rec.staleCheck ? { snapshotStock: rec.staleCheck.snapshotStock } : undefined,
    financialAnalysis: rec.financialAnalysis ? { currentMarginPct: rec.financialAnalysis.currentMarginPct } : undefined,
    explanation: rec.explanation ? { observation: rec.explanation.observation } : undefined
  }));
}

export interface TrimmedCampaign {
  campaignId: string;
  recommendationId?: string;
  opportunityId?: string;
  campaignType?: string;
  status: string;
  title: string;
  product?: {
    productId?: number;
    sku?: string;
    title?: string;
    sellingPrice?: number;
    stock?: number | null;
  };
  audience?: { eligibleCount?: number; targetAudience?: any[] };
  activeAudienceCount?: number;
  offer: {
    offerText?: string;
    description?: string;
    offerValue?: number;
    category?: string;
    offerType?: string;
    discountValue?: number;
    safetyStatus?: string;
    couponCode?: string;
    marginFloorPct?: number;
  };
  financialSimulation?: {
    expectedNetProfitGain?: number;
    contributionAfterDiscount?: number;
  };
  expectedImpact?: { simulatedNetContributionProfitDelta?: number };
  expiresAt?: string;
}

export function trimCampaigns(campaigns: any[], limit = 6): TrimmedCampaign[] {
  if (!Array.isArray(campaigns)) return [];
  return campaigns.slice(0, limit).map((c: any) => {
    const base = normalizeCampaignShape(c);
    return {
      campaignId: base.campaignId,
      recommendationId: c.recommendationId,
      opportunityId: c.opportunityId,
      campaignType: c.campaignType,
      status: base.status,
      title: base.title,
      product: c.product ? {
        productId: c.product.productId,
        sku: c.product.sku,
        title: c.product.title,
        sellingPrice: c.product.sellingPrice,
        stock: c.product.stock
      } : undefined,
      audience: c.audience ? {
        eligibleCount: Array.isArray(c.audience) ? c.audience.length : c.audience.eligibleCount,
        targetAudience: c.targetAudience
      } : undefined,
      activeAudienceCount: c.activeAudienceCount,
      offer: {
        offerText: c.offer?.offerText,
        description: c.offer?.description,
        offerValue: c.offer?.offerValue,
        category: c.offer?.category,
        offerType: c.offer?.offerType,
        discountValue: c.offer?.discountValue,
        safetyStatus: c.offer?.safetyStatus,
        couponCode: c.offer?.couponCode,
        marginFloorPct: c.offer?.marginFloorPct
      },
      financialSimulation: c.financialSimulation ? {
        expectedNetProfitGain: c.financialSimulation.expectedNetProfitGain,
        contributionAfterDiscount: c.financialSimulation.contributionAfterDiscount
      } : undefined,
      expectedImpact: c.expectedImpact ? {
        simulatedNetContributionProfitDelta: c.expectedImpact.simulatedNetContributionProfitDelta
      } : undefined,
      expiresAt: c.expiresAt
    };
  });
}
