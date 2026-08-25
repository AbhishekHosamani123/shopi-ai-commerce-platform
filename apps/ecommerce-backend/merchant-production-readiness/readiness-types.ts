export interface ProductionCategoryStatus {
  category: string;
  name: string;
  status: 'PASS' | 'WARNING' | 'FAIL';
  score: number; // 0 to 100
  summary: string;
  blockers: string[];
  recommendations: string[];
}

export interface ProductionReadinessReport {
  overallScore: number;
  readinessStatus: 'READY' | 'NEEDS_ATTENTION' | 'BLOCKED';
  passedCount: number;
  warningCount: number;
  failedCount: number;
  categories: ProductionCategoryStatus[];
  criticalBlockers: string[];
  timestamp: string;
}
