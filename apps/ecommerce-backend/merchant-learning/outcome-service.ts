import { outcomeLedger } from './outcome-ledger';
import { predictionEvaluator } from './prediction-evaluator';
import { forecastAccuracyEngine } from './forecast-accuracy-engine';
import { selfCalibratingConfidence } from './self-calibrating-confidence';
import { decisionQualityEngine } from './decision-quality-engine';
import { feedbackService } from './feedback/feedback-service';
import { learningMemoryEngine } from './memory/learning-memory';
import { modelRegistryService } from './model-registry/model-registry';
import { learningExplainer } from './explainability/learning-explainer';
import { learningDataHealthService } from './learning-data-health';
import { CreateOutcomeInput, RecordActualOutcomeInput, OutcomeRecord } from './outcome-types';

export class OutcomeService {
  async recordDecision(input: CreateOutcomeInput): Promise<OutcomeRecord> {
    return outcomeLedger.recordPrediction(input);
  }

  async recordOutcome(input: RecordActualOutcomeInput): Promise<OutcomeRecord | null> {
    return outcomeLedger.recordActualOutcome(input);
  }

  async listOutcomes(merchantId: string, filter?: any) {
    return outcomeLedger.listOutcomes(merchantId, filter);
  }

  async getLearningTimeline(merchantId: string = 'default_merchant') {
    const outcomes = await outcomeLedger.listOutcomes(merchantId, { limit: 20 });
    return outcomes.map(o => {
      const isEvaluated = o.outcomeStatus === 'EVALUATED';
      let lessonLearned = 'Outcome pending empirical realization.';
      if (isEvaluated) {
        if (o.percentageError && o.percentageError <= 15) {
          lessonLearned = `Prediction accurate: Realized ${o.actualValue} vs predicted ${o.predictedMid} (${o.percentageError}% variance).`;
        } else if (o.biasClassification === 'OVER_FORECASTING') {
          lessonLearned = `Over-forecasting detected (${o.percentageError}% error). Adjusted future safety buffer.`;
        } else if (o.biasClassification === 'UNDER_FORECASTING') {
          lessonLearned = `Demand exceeded predicted midpoint by +${o.percentageError}%. Increased forecast elasticity weight.`;
        }
      }

      return {
        date: o.decisionTimestamp,
        decisionId: o.decisionId,
        actionType: o.actionType,
        predicted: `${o.predictedMid} (Range: ${o.predictedMin || 'N/A'} - ${o.predictedMax || 'N/A'})`,
        actual: o.actualValue !== null ? o.actualValue : 'Pending',
        errorPct: o.percentageError !== null ? `${o.percentageError}%` : 'Pending',
        status: o.outcomeStatus,
        lessonLearned
      };
    });
  }
}

export const outcomeService = new OutcomeService();
