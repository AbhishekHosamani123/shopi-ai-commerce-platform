"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selfCalibratingConfidence = exports.SelfCalibratingConfidenceEngine = void 0;
class SelfCalibratingConfidenceEngine {
    /**
     * Computes a self-calibrating, explainable confidence score and rating.
     */
    evaluateConfidence(params) {
        const { sampleSize, historicalErrorRatePct = 15, dataFreshnessDays = 1, dataCompletenessPct = 95, forecastHorizonDays = 14, volatilityScore = 1.0 } = params;
        let score = 50; // Neutral baseline
        // 1. Sample Size Weight (+/- 25 points)
        if (sampleSize >= 100)
            score += 25;
        else if (sampleSize >= 30)
            score += 18;
        else if (sampleSize >= 10)
            score += 8;
        else if (sampleSize < 3)
            score -= 25;
        // 2. Historical Error Rate (+/- 20 points)
        if (historicalErrorRatePct <= 8)
            score += 20;
        else if (historicalErrorRatePct <= 15)
            score += 10;
        else if (historicalErrorRatePct >= 35)
            score -= 20;
        else if (historicalErrorRatePct >= 25)
            score -= 10;
        // 3. Data Freshness (+/- 10 points)
        if (dataFreshnessDays <= 2)
            score += 10;
        else if (dataFreshnessDays > 14)
            score -= 10;
        // 4. Data Completeness (+/- 10 points)
        if (dataCompletenessPct >= 90)
            score += 10;
        else if (dataCompletenessPct < 60)
            score -= 15;
        // 5. Forecast Horizon Degradation
        if (forecastHorizonDays > 30)
            score -= 10;
        if (forecastHorizonDays > 60)
            score -= 15;
        // 6. Volatility Penalty
        if (volatilityScore > 2.5)
            score -= 10;
        // Clamp score to [5, 95]
        score = Math.max(5, Math.min(95, Math.round(score)));
        let confidence = 'LOW';
        if (score >= 70)
            confidence = 'HIGH';
        else if (score >= 40)
            confidence = 'MEDIUM';
        const confidenceReason = confidence === 'HIGH'
            ? `High confidence (${score}/100): ${sampleSize} historical observations, low error rate (${historicalErrorRatePct}%), and fresh data.`
            : confidence === 'MEDIUM'
                ? `Medium confidence (${score}/100): Moderate sample size (${sampleSize} observations) and ${historicalErrorRatePct}% historical error.`
                : `Low confidence (${score}/100): Limited sample size (${sampleSize} observations) or elevated error rate (${historicalErrorRatePct}%).`;
        return {
            confidence,
            confidenceScore: score,
            sampleSize,
            historicalErrorRatePct,
            dataFreshnessDays,
            dataCompletenessPct,
            volatilityScore,
            confidenceReason
        };
    }
}
exports.SelfCalibratingConfidenceEngine = SelfCalibratingConfidenceEngine;
exports.selfCalibratingConfidence = new SelfCalibratingConfidenceEngine();
