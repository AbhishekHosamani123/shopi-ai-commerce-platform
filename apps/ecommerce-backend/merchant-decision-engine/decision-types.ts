/**
 * ⚡ Executive Decision Engine & Second-Order Effects Types (Phase 5)
 */

export interface DecisionPriority {
  priorityRank: 1 | 2 | 3;
  severity: 'CRITICAL' | 'WARNING' | 'OPPORTUNITY';
  title: string;
  problem: string;
  evidence: string;
  expectedImpact: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendedAction: {
    actionType: string;
    label: string;
    actionId?: string | null;
  };
  approvalRequired: boolean;
  explanation: {
    why: string;
    whyNow: string;
    whatIfDoNothing: string;
    whatIfAct: string;
    whatCouldGoWrong: string;
  };
}

export interface SecondOrderEffect {
  action: string;
  primaryEffect: string;
  secondaryEffect: string;
  risk: string;
  mitigation: string;
}

export interface ExecutiveDailyDecisions {
  date: string;
  merchantId: string;
  overallHealthScore: number;
  topPriorities: DecisionPriority[];
  secondOrderEffects: SecondOrderEffect[];
  keyAssumptions: string[];
}
