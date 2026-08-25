"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateChurnRisk = calculateChurnRisk;
/**
 * Calculates deterministic churn risk based on days since last order relative to repeat purchase intervals.
 */
function calculateChurnRisk(input) {
    const { daysSinceLastOrder, orderCount, avgRepeatIntervalDays } = input;
    if (orderCount === 1) {
        if (daysSinceLastOrder > 90) {
            return {
                risk: 'HIGH',
                probabilityPct: 82.0,
                explanation: `One-time purchaser with no activity for ${daysSinceLastOrder} days (>90 days dormancy).`
            };
        }
        if (daysSinceLastOrder > 45) {
            return {
                risk: 'MEDIUM',
                probabilityPct: 50.0,
                explanation: `Single order customer with ${daysSinceLastOrder} days elapsed.`
            };
        }
        return {
            risk: 'LOW',
            probabilityPct: 20.0,
            explanation: `Recent new customer (${daysSinceLastOrder} days ago).`
        };
    }
    // Multi-order customer baseline
    const intervalRatio = avgRepeatIntervalDays > 0 ? daysSinceLastOrder / avgRepeatIntervalDays : 1.0;
    if (intervalRatio >= 2.5 || daysSinceLastOrder > 120) {
        return {
            risk: 'HIGH',
            probabilityPct: 85.0,
            explanation: `Customer is ${daysSinceLastOrder} days past last purchase, which is ${intervalRatio.toFixed(1)}x their average repeat interval (${avgRepeatIntervalDays} days). Significant churn likelihood.`
        };
    }
    if (intervalRatio >= 1.5 || daysSinceLastOrder > 60) {
        return {
            risk: 'MEDIUM',
            probabilityPct: 48.0,
            explanation: `Activity delay of ${daysSinceLastOrder} days exceeds expected interval (${avgRepeatIntervalDays} days). Moderate retention risk.`
        };
    }
    return {
        risk: 'LOW',
        probabilityPct: 15.0,
        explanation: `Active purchase cadence. Last ordered ${daysSinceLastOrder} days ago within standard repeat window (${avgRepeatIntervalDays} days).`
    };
}
