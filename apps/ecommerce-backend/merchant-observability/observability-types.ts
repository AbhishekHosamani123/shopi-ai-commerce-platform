export interface SystemObservabilityMetrics {
  merchantId: string;
  evaluationTimestamp: string;
  aiRequestCount: number;
  totalRecommendationsGenerated: number;
  totalActionsStaged: number;
  totalActionsApproved: number;
  totalActionsRejected: number;
  approvalRatePct: number;
  rejectionRatePct: number;
  executionSuccessRatePct: number;
  actionFailureRatePct: number;
  forecastAccuracyMape14d: number;
  forecastDirectionAccuracyPct: number;
  averageConfidenceLevel: string;
  averageConfidenceScore: number;
  dataSufficiencyScore: number; // 0 - 100
  latencyMetrics: {
    avgAiLatencyMs: number;
    p95AiLatencyMs: number;
    avgDbQueryLatencyMs: number;
    p95DbQueryLatencyMs: number;
  };
  systemErrorRatePct: number;
  systemHealthStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  activeModelVersionsCount: number;
}
