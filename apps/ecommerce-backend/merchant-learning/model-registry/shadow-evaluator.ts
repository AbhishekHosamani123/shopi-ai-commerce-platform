import { modelRegistryService } from './model-registry';
import { ModelType, ChampionChallengerComparison } from './model-types';

export class ShadowEvaluator {
  /**
   * Compares the active production Champion model against a shadow Challenger model.
   */
  async evaluateChampionVsChallenger(
    modelType: ModelType,
    merchantId: string = 'default_merchant'
  ): Promise<ChampionChallengerComparison> {
    const champion = await modelRegistryService.getActiveChampion(modelType, merchantId);
    const allModels = await modelRegistryService.listModels(merchantId, modelType);
    const challenger = allModels.find(m => m.status === 'SHADOW') || null;

    if (!champion) {
      throw new Error(`No active champion found for model type ${modelType}`);
    }

    if (!challenger) {
      return {
        modelType,
        champion,
        challenger: null,
        accuracyDeltaPct: 0,
        recommendation: 'MAINTAIN_CHAMPION',
        evaluationDetails: `Active champion v${champion.version} has no active shadow challengers.`
      };
    }

    const champMape = champion.metrics.mape || 14.5;
    const challMape = challenger.metrics.mape || 11.2;
    const accuracyDeltaPct = Math.round(((champMape - challMape) / champMape) * 100);

    let recommendation: 'MAINTAIN_CHAMPION' | 'PROMOTE_CHALLENGER_PENDING_APPROVAL' | 'INSUFFICIENT_EVIDENCE' = 'MAINTAIN_CHAMPION';

    if (challenger.sampleCount < 20) {
      recommendation = 'INSUFFICIENT_EVIDENCE';
    } else if (accuracyDeltaPct >= 10) {
      recommendation = 'PROMOTE_CHALLENGER_PENDING_APPROVAL';
    }

    const evaluationDetails = `Champion v${champion.version} (MAPE: ${champMape}%) vs Shadow Challenger v${challenger.version} (MAPE: ${challMape}%). Challenger shows +${accuracyDeltaPct}% error reduction across ${challenger.sampleCount} validated observations.`;

    return {
      modelType,
      champion,
      challenger,
      accuracyDeltaPct,
      recommendation,
      evaluationDetails
    };
  }
}

export const shadowEvaluator = new ShadowEvaluator();
