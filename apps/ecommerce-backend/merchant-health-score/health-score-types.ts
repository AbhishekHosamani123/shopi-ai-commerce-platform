export interface HealthScoreDimension {
  dimension: string;
  name: string;
  score: number; // 0 - 100
  weight: number; // 0.0 - 1.0
  weightedScore: number;
  status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'AT_RISK' | 'CRITICAL';
  keyMetrics: Record<string, any>;
  positiveDrivers: string[];
  negativeDrivers: string[];
}

export interface BusinessHealthScoreResult {
  merchantId: string;
  overallScore: number; // 0 - 100
  overallStatus: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'AT_RISK' | 'CRITICAL';
  evaluationTimestamp: string;
  dimensions: HealthScoreDimension[];
  highestImpactIssue: {
    dimension: string;
    description: string;
    scoreDrag: number;
    recommendedAction: string;
    actionType: string;
  };
  scoreTrajectory: {
    trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
    wowChange: number;
  };
  explainability: {
    formula: string;
    topPositiveDriver: string;
    topNegativeDriver: string;
  };
}
