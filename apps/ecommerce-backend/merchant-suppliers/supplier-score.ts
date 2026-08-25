import { SupplierPerformanceMetrics, SupplierReliabilityScore } from './supplier-types';

/**
 * Calculates supplier reliability scores and on-time delivery statistics.
 */
export function calculateSupplierScore(metrics: {
  onTimeDeliveryPct: number;
  fillRatePct: number;
  avgLeadTimeDays: number;
  totalOrdersCount: number;
}): { score: SupplierReliabilityScore; explanation: string; stockoutRiskMultiplier: number } {
  const { onTimeDeliveryPct, fillRatePct, avgLeadTimeDays, totalOrdersCount } = metrics;

  if (totalOrdersCount < 3) {
    return {
      score: 'MEDIUM',
      explanation: 'Limited historical delivery telemetry. Standard reliability assumed.',
      stockoutRiskMultiplier: 1.15
    };
  }

  if (onTimeDeliveryPct >= 90 && fillRatePct >= 95 && avgLeadTimeDays <= 6) {
    return {
      score: 'HIGH',
      explanation: `High reliability rating: ${onTimeDeliveryPct}% on-time delivery with ${fillRatePct}% fill rate and ${avgLeadTimeDays} days avg lead time.`,
      stockoutRiskMultiplier: 1.0
    };
  }

  if (onTimeDeliveryPct < 75 || fillRatePct < 85 || avgLeadTimeDays > 10) {
    return {
      score: 'LOW',
      explanation: `Elevated replenishment risk: ${onTimeDeliveryPct}% on-time delivery (${100 - onTimeDeliveryPct}% delayed) with ${avgLeadTimeDays} days extended lead time. Buffer safety stock required.`,
      stockoutRiskMultiplier: 1.5
    };
  }

  return {
    score: 'MEDIUM',
    explanation: `Moderate reliability rating: ${onTimeDeliveryPct}% on-time delivery and ${fillRatePct}% fill rate.`,
    stockoutRiskMultiplier: 1.2
  };
}
