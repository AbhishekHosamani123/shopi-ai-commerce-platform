export type ExplainabilityQuestion =
  | 'WHY_RECOMMENDING'
  | 'WHAT_DATA_USED'
  | 'HOW_CONFIDENT'
  | 'WHERE_COULD_BE_WRONG'
  | 'WHAT_HAPPENED_LAST_TIME'
  | 'WHAT_HAVE_YOU_LEARNED'
  | 'WHY_RECOMMENDATION_CHANGED'
  | 'WHICH_ASSUMPTIONS';

export interface ExplainabilityResponse {
  questionType: ExplainabilityQuestion;
  questionText: string;
  targetSubject: string; // e.g. "Restock Sports Claw Women Shoes" or "General AI Engine"
  summaryAnswer: string;
  detailedPoints: string[];
  underlyingTelemetry: {
    sources: string[];
    sampleObservationCount: number;
    metrics: Record<string, any>;
  };
  confidenceRating: 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
}
