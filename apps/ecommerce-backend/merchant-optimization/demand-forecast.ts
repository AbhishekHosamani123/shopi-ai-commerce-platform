import { getProductHistoricalProfile } from './historical-analytics';
import { DemandForecastResult, ConfidenceLevel } from './optimization-types';

/**
 * Generates deterministic, explainable demand forecasts for a product.
 */
export async function forecastProductDemand(productId: number): Promise<DemandForecastResult | null> {
  const profile = await getProductHistoricalProfile(productId);
  if (!profile) return null;

  const v7 = profile.last7Days.dailyVelocity;
  const v30 = profile.last30Days.dailyVelocity;
  const totalUnits30 = profile.last30Days.units;

  // If very scarce data (< 2 units sold in 30 days)
  if (totalUnits30 < 2 && profile.dataPointsCount < 2) {
    return {
      productId: profile.productId,
      title: profile.title,
      historicalDailyVelocity7d: v7,
      historicalDailyVelocity30d: v30,
      trendAdjustmentPct: 0,
      forecastDailyDemand: Math.max(0.1, v30),
      forecast7DaysUnits: Math.max(1, Math.round(v30 * 7)),
      forecast14DaysUnits: Math.max(2, Math.round(v30 * 14)),
      forecast30DaysUnits: Math.max(3, Math.round(v30 * 30)),
      currentStock: profile.currentStock,
      daysUntilStockout: profile.currentStock > 0 && v30 > 0 ? Math.round(profile.currentStock / v30) : null,
      confidence: 'LOW',
      confidenceScore: 0.35,
      explanation: 'Insufficient historical sales velocity for high-confidence forecast. Output is based on baseline activity.',
      isReliable: false
    };
  }

  // Trend acceleration between 7d and 30d
  const trendAdjustmentPct = v30 > 0
    ? parseFloat((((v7 - v30) / v30) * 100).toFixed(1))
    : 0;

  // Weighted moving average: 60% recent 7-day velocity + 40% 30-day baseline
  const forecastDailyDemand = parseFloat((0.6 * v7 + 0.4 * v30).toFixed(2));
  const forecast7DaysUnits = Math.round(forecastDailyDemand * 7);
  const forecast14DaysUnits = Math.round(forecastDailyDemand * 14);
  const forecast30DaysUnits = Math.round(forecastDailyDemand * 30);

  const daysUntilStockout = forecastDailyDemand > 0
    ? Math.round(profile.currentStock / forecastDailyDemand)
    : null;

  let confidence: ConfidenceLevel = 'MEDIUM';
  let confidenceScore = 0.70;

  if (totalUnits30 >= 30 && profile.dataPointsCount >= 10) {
    confidence = 'HIGH';
    confidenceScore = 0.88;
  } else if (totalUnits30 < 10) {
    confidence = 'LOW';
    confidenceScore = 0.45;
  }

  const trendDesc = trendAdjustmentPct > 0
    ? `+${trendAdjustmentPct}% recent demand acceleration`
    : trendAdjustmentPct < 0
    ? `${trendAdjustmentPct}% recent demand deceleration`
    : 'stable demand velocity';

  const explanation = `Forecast is based on weighted historical velocity (60% 7-day at ${v7} units/day, 40% 30-day baseline at ${v30} units/day) with ${trendDesc}. Projected depletion in ~${daysUntilStockout || 'N/A'} days.`;

  return {
    productId: profile.productId,
    title: profile.title,
    historicalDailyVelocity7d: v7,
    historicalDailyVelocity30d: v30,
    trendAdjustmentPct,
    forecastDailyDemand,
    forecast7DaysUnits,
    forecast14DaysUnits,
    forecast30DaysUnits,
    currentStock: profile.currentStock,
    daysUntilStockout,
    confidence,
    confidenceScore,
    explanation,
    isReliable: confidence !== 'LOW'
  };
}
