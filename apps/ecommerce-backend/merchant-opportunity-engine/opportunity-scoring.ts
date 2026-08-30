import {
  BusinessImpactLevel,
  UrgencyLevel,
  ConfidenceLevel,
  FinancialSafetyState,
  OpportunityPriority
} from './opportunity-types';

export class OpportunityScoringService {
  /**
   * Computes deterministic priority score (0 - 100) and priority bucket for an opportunity.
   */
  public calculateScore(inputs: {
    businessImpact: BusinessImpactLevel;
    urgency: UrgencyLevel;
    confidence: ConfidenceLevel;
    customerSignalStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE';
    financialSafety: FinancialSafetyState;
  }): { score: number; priority: OpportunityPriority; scoreBreakdown: Record<string, number> } {
    let impactPts = 0;
    if (inputs.businessImpact === 'HIGH') impactPts = 35;
    else if (inputs.businessImpact === 'MEDIUM') impactPts = 22;
    else impactPts = 10;

    let urgencyPts = 0;
    if (inputs.urgency === 'IMMEDIATE') urgencyPts = 25;
    else if (inputs.urgency === 'THIS_WEEK') urgencyPts = 15;
    else urgencyPts = 5;

    let confidencePts = 0;
    if (inputs.confidence === 'HIGH') confidencePts = 15;
    else if (inputs.confidence === 'MEDIUM') confidencePts = 10;
    else if (inputs.confidence === 'LOW') confidencePts = 4;
    else confidencePts = 0; // INSUFFICIENT_EVIDENCE

    let signalPts = 0;
    if (inputs.customerSignalStrength === 'STRONG') signalPts = 15;
    else if (inputs.customerSignalStrength === 'MODERATE') signalPts = 10;
    else if (inputs.customerSignalStrength === 'WEAK') signalPts = 5;
    else signalPts = 0;

    let finPts = 0;
    if (inputs.financialSafety === 'KNOWN_COGS') finPts = 10;
    else if (inputs.financialSafety === 'ESTIMATED_COGS') finPts = 5;
    else finPts = 0;

    const total = Math.min(100, Math.max(0, impactPts + urgencyPts + confidencePts + signalPts + finPts));

    // Calibrated Semantics:
    // CRITICAL: Immediate merchant action required (IMMEDIATE urgency & high total score >= 75)
    // HIGH: Meaningful commercial opportunity requiring near-term attention (THIS_WEEK >= 50 or IMMEDIATE < 75)
    // MEDIUM: Worth investigating / monitoring (total >= 35)
    // LOW: Informational / weak (< 35)
    let priority: OpportunityPriority = 'LOW';
    if (inputs.urgency === 'IMMEDIATE' && total >= 75) {
      priority = 'CRITICAL';
    } else if ((inputs.urgency === 'IMMEDIATE' && total < 75) || (inputs.urgency === 'THIS_WEEK' && total >= 50)) {
      priority = 'HIGH';
    } else if (total >= 35) {
      priority = 'MEDIUM';
    } else {
      priority = 'LOW';
    }

    return {
      score: total,
      priority,
      scoreBreakdown: {
        businessImpact: impactPts,
        urgency: urgencyPts,
        confidence: confidencePts,
        customerSignals: signalPts,
        financialSafety: finPts
      }
    };
  }
}

export const opportunityScoringService = new OpportunityScoringService();
