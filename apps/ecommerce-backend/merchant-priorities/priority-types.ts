export interface DailyPriorityItem {
  priorityRank: number; // 1 to 5
  severity: 'CRITICAL' | 'WARNING' | 'OPPORTUNITY';
  category: 'INVENTORY' | 'PRICING' | 'RETENTION' | 'SUPPLIERS' | 'CAPITAL';
  title: string;
  problem: string;
  evidence: string;
  expectedImpact: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedEffort: 'LOW' | 'MEDIUM' | 'HIGH';
  actionType: string;
  actionId?: string;
  targetId?: number | string;
  payload: any;
  approvalRequired: boolean;
}

export interface DailyPrioritiesResult {
  date: string;
  topPriorities: DailyPriorityItem[];
  totalActionableCount: number;
  executiveSummary: string;
}
