export interface DailyBriefingResult {
  greeting: string;
  businessHealthScore: number;
  healthStatus: string;
  date: string;
  /**
   * Human-readable executive brief synthesized from live metrics.
   * Derived from real shopi_orders / shopi_products data — not a static fallback.
   */
  executiveBrief: string;
  yesterdayMetrics: {
    revenue: number;
    orderCount: number;
    unitsSold: number;
    aov: number;
    contributionMarginPct: number;
  };
  periodComparison: {
    revenueChangePct: number;
    ordersChangePct: number;
    marginChangePct: number;
  };
  topWin: {
    productTitle: string;
    revenue: number;
    unitsSold: number;
    description: string;
  };
  biggestRisk: {
    title: string;
    severity: 'CRITICAL' | 'WARNING' | 'OPPORTUNITY';
    daysRemaining: number;
    description: string;
  };
  topRecommendation: {
    actionType: string;
    title: string;
    expectedImpact: string;
    protectedRevenue: number;
    recommendedUnits?: number;
    actionId?: string;
  };
  pendingApprovalCount: number;
  todayForecast: {
    minRevenue: number;
    midRevenue: number;
    maxRevenue: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  rawTelemetrySource: string;
}
