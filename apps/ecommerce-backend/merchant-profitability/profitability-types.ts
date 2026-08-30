export interface ProductProfitabilityItem {
  productId: number;
  productTitle: string;
  category: string;
  unitsSold: number;
  grossRevenue: number;
  discountAmount: number;
  netRevenue: number;
  unitCogs: number | null;
  totalCogs: number | null;
  shippingCost: number;
  fulfillmentCost: number;
  refundAmount: number;
  adCostAllocated: number | null;
  contributionProfit: number | null;
  contributionMarginPct: number | null;
  grossMarginPct: number | null;
  profitPerUnit: number | null;
  isCogsAvailable: boolean;
  cogsStatus: 'KNOWN' | 'ESTIMATED' | 'MISSING';
  cogs_status?: 'KNOWN' | 'ESTIMATED' | 'MISSING';
  profitabilityTier: 'HIGH_MARGIN' | 'MODERATE_MARGIN' | 'LOW_MARGIN' | 'MARGIN_NEGATIVE' | 'COGS_UNAVAILABLE';
}

export interface CategoryProfitabilityItem {
  category: string;
  productCount: number;
  unitsSold: number;
  netRevenue: number;
  contributionProfit: number | null;
  avgContributionMarginPct: number | null;
  isFullyCalculated: boolean;
}

export interface ChannelProfitabilityItem {
  channel: string;
  orderCount: number;
  netRevenue: number;
  shippingCosts: number;
  adSpend: number | null;
  contributionProfit: number | null;
  contributionMarginPct: number | null;
  adAttributionStatus: 'DIRECT_TRACKED' | 'OPPORTUNITY_ALLOCATED' | 'NOT_CONFIGURED';
}

export interface ProfitabilityOverviewResult {
  merchantId: string;
  periodDays: number;
  totalNetRevenue: number;
  totalEstimatedCogs: number | null;
  totalDiscounts: number;
  totalRefunds: number;
  totalShippingCost: number;
  totalFulfillmentCost: number;
  totalContributionProfit: number | null;
  overallContributionMarginPct: number | null;
  overallGrossMarginPct: number | null;
  cogsCoverageCount: number;
  cogsMissingCount: number;
  totalCatalogCount: number;
  activeSellingCount: number;
  nonSellingCount: number;
  products: ProductProfitabilityItem[];
  categories: CategoryProfitabilityItem[];
  channels: ChannelProfitabilityItem[];
  dataSufficiencyNotice?: string;
}
