export interface DomainReadinessMetric {
  domain: string;
  recordCount: number;
  dataDepthDescription: string;
  status: 'EXCELLENT' | 'SUFFICIENT' | 'PARTIAL' | 'UNAVAILABLE';
  learningReadiness: 'PRODUCTION_READY' | 'WARMUP_PERIOD' | 'NEEDS_DATA';
  identifiedGaps?: string[];
}

export interface DataReadinessReportResult {
  reportGeneratedAt: string;
  overallReadinessScore: number; // 0 - 100
  overallReadinessStatus: 'PRODUCTION_READY' | 'ACCEPTABLE' | 'NEEDS_DATA';
  totalCatalogProducts: number;
  totalOrders: number;
  totalOrderItems: number;
  orderHistoryDays: number;
  totalCustomers: number;
  totalInventoryMovements: number;
  totalWarehouses: number;
  totalSuppliers: number;
  totalReturns: number;
  totalCancellations: number;
  cogsCoverageSKUs: number;
  pricingExperimentsCount: number;
  matureOutcomesCount: number;
  domains: DomainReadinessMetric[];
  sandboxIsolationGuaranteed: boolean;
  recommendations: string[];
}
