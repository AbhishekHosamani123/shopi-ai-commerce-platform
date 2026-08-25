/**
 * ⚡ Merchant AI Scheduled Business Digests Types (Phase 3C)
 */

export type DigestType = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface DigestMetrics {
  grossRevenue: number;
  netRevenue: number;
  totalOrders: number;
  unitsSold: number;
  averageOrderValue: number;
  revenueGrowthPct?: number;
  ordersGrowthPct?: number;
  returnRatePct?: number;
}

export interface MerchantAiDigestRecord {
  digestId: string;
  merchantId: string;
  digestType: DigestType;
  period: string;
  title: string;
  summary: string;
  metrics: DigestMetrics;
  topProducts: any[];
  inventoryRisks: any[];
  aiPriorities: any[];
  createdAt: string;
}

export interface DigestSettings {
  merchantId: string;
  proactiveInsightsEnabled: boolean;
  digestFrequency: DigestType;
  digestTime: string;
  timezone: string;
  alertPreferences: {
    critical: boolean;
    warning: boolean;
    opportunity: boolean;
    info: boolean;
  };
  updatedAt: string;
}
