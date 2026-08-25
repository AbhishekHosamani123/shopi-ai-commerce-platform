"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.predictionEvaluator = exports.PredictionEvaluator = void 0;
class PredictionEvaluator {
    /**
     * Evaluates a prediction against realized empirical outcome data.
     */
    evaluatePrediction(predictedMid, actualValue, predictedMin, predictedMax, predictionConfidence = 'MEDIUM', outcomeId = 'out_eval', decisionId = 'dec_eval') {
        const absoluteError = Math.round(Math.abs(actualValue - predictedMid) * 100) / 100;
        const denominator = Math.max(1, Math.abs(predictedMid));
        const percentageError = Math.round((absoluteError / denominator) * 10000) / 100;
        // Directional correctness (e.g. within envelope or aligned sign)
        let directionCorrect = true;
        if (predictedMin !== undefined && predictedMin !== null && predictedMax !== undefined && predictedMax !== null) {
            directionCorrect = actualValue >= predictedMin * 0.85 && actualValue <= predictedMax * 1.15;
        }
        else {
            directionCorrect = percentageError <= 25;
        }
        // Bias detection (tolerance ±10%)
        let biasClassification = 'CALIBRATED';
        if (actualValue < predictedMid * 0.90) {
            biasClassification = 'OVER_FORECASTING';
        }
        else if (actualValue > predictedMid * 1.10) {
            biasClassification = 'UNDER_FORECASTING';
        }
        // Confidence calibration
        let confidenceCalibration = 'WELL_CALIBRATED';
        if (predictionConfidence === 'HIGH' && percentageError > 25) {
            confidenceCalibration = 'OVERCONFIDENT';
        }
        else if (predictionConfidence === 'LOW' && percentageError <= 10) {
            confidenceCalibration = 'UNDERCONFIDENT';
        }
        const isAccurate = percentageError <= 20;
        const evaluationSummary = isAccurate
            ? `Prediction accurate: realized ${actualValue} vs predicted midpoint ${predictedMid} (${percentageError}% error).`
            : `Prediction variance detected: realized ${actualValue} vs predicted midpoint ${predictedMid} (${percentageError}% error, ${biasClassification}).`;
        return {
            outcomeId,
            decisionId,
            predictedMid,
            predictedMin,
            predictedMax,
            actualValue,
            absoluteError,
            percentageError,
            directionCorrect,
            biasClassification,
            confidenceCalibration,
            isAccurate,
            evaluationSummary
        };
    }
}
exports.PredictionEvaluator = PredictionEvaluator;
exports.predictionEvaluator = new PredictionEvaluator();
