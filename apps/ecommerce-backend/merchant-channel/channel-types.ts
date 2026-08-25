/**
 * ⚡ Omnichannel Commerce & Channel Allocation Types (Phase 6)
 */

export type SalesChannel =
  | 'DIRECT_STORE'
  | 'GOOGLE_SHOPPING'
  | 'META_COMMERCE'
  | 'MARKETPLACE'
  | 'SOCIAL_COMMERCE'
  | 'EMAIL_CAMPAIGNS';

export interface ChannelSuitabilityScore {
  channel: SalesChannel;
  channelName: string;
  suitabilityScore: number; // 0 - 100
  isConfigured: boolean;
  recommendedRole: string;
  rationale: string;
}

export interface ProductChannelFit {
  productId: number;
  productTitle: string;
  price: number;
  category: string;
  primaryChannel: SalesChannel;
  channelBreakdown: ChannelSuitabilityScore[];
  recommendationType: 'HEURISTIC RECOMMENDATION' | 'DATA_BACKED';
}

export interface OmnichannelCatalogPlan {
  totalCatalogSkus: number;
  channelAllocations: ProductChannelFit[];
  channelSummary: Record<SalesChannel, { skuCount: number; status: 'ACTIVE' | 'NOT_CONFIGURED' }>;
  evaluatedAt: string;
}
