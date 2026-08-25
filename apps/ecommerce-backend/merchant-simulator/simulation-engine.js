"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.businessSimulator = exports.BusinessSimulationEngine = void 0;
const DB_1 = require("../data/DB");
const historical_analytics_1 = require("../merchant-optimization/historical-analytics");
const pricing_optimizer_1 = require("../merchant-optimization/pricing-optimizer");
class BusinessSimulationEngine {
    /**
     * Simulates commercial what-if scenarios with explainable risk envelopes and bounds.
     */
    simulate(req) {
        return __awaiter(this, void 0, void 0, function* () {
            const merchantId = req.merchantId || 'default_merchant';
            const simulationId = `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const productId = req.productId || 1;
            const profile = yield (0, historical_analytics_1.getProductHistoricalProfile)(productId);
            const currentPrice = (profile === null || profile === void 0 ? void 0 : profile.price) || 999;
            const currentStock = (profile === null || profile === void 0 ? void 0 : profile.currentStock) || 50;
            const currentVelocity = (profile === null || profile === void 0 ? void 0 : profile.last30Days.dailyVelocity) || 2.0;
            const currentMonthlyRevenue = (profile === null || profile === void 0 ? void 0 : profile.last30Days.revenue) || currentPrice * currentVelocity * 30;
            let projectedPrice = currentPrice;
            let projectedDailyVelocity = currentVelocity;
            let confidence = 'MEDIUM';
            const assumptions = [];
            let riskAssessment = 'Standard commercial variance applies.';
            let recommendationText = '';
            const elasticityData = yield (0, pricing_optimizer_1.analyzePriceElasticity)(productId);
            const empiricalElasticity = elasticityData.hasSufficientData && elasticityData.elasticity !== null
                ? elasticityData.elasticity
                : -1.05; // Conservative default unitary elasticity
            // --- Scenario 1: Price Change ---
            if (req.scenarioType === 'PRICE_CHANGE') {
                projectedPrice = req.parameters.newPrice || (currentPrice * (1 + (req.parameters.priceChangePct || 0) / 100));
                const priceDeltaPct = (projectedPrice - currentPrice) / currentPrice;
                // Projected velocity = currentVelocity * (1 + elasticity * priceDeltaPct)
                const velocityMultiplier = Math.max(0.2, 1 + empiricalElasticity * priceDeltaPct);
                projectedDailyVelocity = parseFloat((currentVelocity * velocityMultiplier).toFixed(2));
                assumptions.push(`Price adjustment: ₹${currentPrice} → ₹${projectedPrice} (${priceDeltaPct >= 0 ? '+' : ''}${(priceDeltaPct * 100).toFixed(1)}%).`);
                assumptions.push(`Demand elasticity modeled at ${empiricalElasticity} (${elasticityData.elasticityLabel}).`);
                if (priceDeltaPct > 0) {
                    riskAssessment = 'Higher price may dampen unit conversion if competitors offer substitute items.';
                    recommendationText = projectedDailyVelocity * projectedPrice * 30 > currentMonthlyRevenue
                        ? `Simulation indicates a net revenue gain despite slight volume reduction. Recommend proceeding with Phase 3B price action.`
                        : `Simulation indicates unit volume drop may exceed margin gain. Caution advised.`;
                }
                else {
                    riskAssessment = 'Gross margin percentage per unit decreases.';
                    recommendationText = `Price reduction is projected to accelerate unit velocity to ${projectedDailyVelocity} units/day.`;
                }
            }
            // --- Scenario 2: Discount Clearance ---
            else if (req.scenarioType === 'DISCOUNT_CLEARANCE') {
                const discountPct = req.parameters.discountPct || 10;
                projectedPrice = Math.round(currentPrice * (1 - discountPct / 100));
                // Discounts typically generate +20% to +40% velocity lift on dead stock
                projectedDailyVelocity = parseFloat((currentVelocity * (1 + discountPct * 0.03)).toFixed(2));
                assumptions.push(`Clearance discount of ${discountPct}% applied.`);
                assumptions.push(`Estimated demand elasticity response of +${(discountPct * 3).toFixed(0)}% velocity increase.`);
                riskAssessment = 'Margin compression per unit sold; ideal for liquidating stagnant inventory.';
                recommendationText = `Applying a ${discountPct}% markdown will recover working capital and reduce days-to-depletion.`;
            }
            // --- Scenario 3: Restock Expansion ---
            else if (req.scenarioType === 'RESTOCK_EXPANSION') {
                const reorderUnits = req.parameters.reorderUnits || 50;
                projectedDailyVelocity = currentVelocity;
                assumptions.push(`Replenishing +${reorderUnits} units into catalog buffer.`);
                assumptions.push(`Maintains current sales run-rate without stockout interruption.`);
                riskAssessment = 'Working capital outlay for inventory holding.';
                recommendationText = `Restocking +${reorderUnits} units prevents estimated stockout and preserves monthly revenue run-rate.`;
            }
            // --- Scenario 4: Category Promotion ---
            else {
                projectedDailyVelocity = parseFloat((currentVelocity * 1.25).toFixed(2));
                assumptions.push(`25% baseline demand lift modeled from promotional banner visibility.`);
                riskAssessment = 'Traffic quality may vary depending on marketing channel.';
                recommendationText = `Category spotlight will drive incremental footfall to champion SKUs.`;
            }
            const projectedMonthlyUnits = Math.round(projectedDailyVelocity * 30);
            const projectedMonthlyRevenueMid = Math.round(projectedMonthlyUnits * projectedPrice);
            const projectedMonthlyRevenueMin = Math.round(projectedMonthlyRevenueMid * 0.90);
            const projectedMonthlyRevenueMax = Math.round(projectedMonthlyRevenueMid * 1.10);
            const revenueDeltaPct = currentMonthlyRevenue > 0
                ? parseFloat((((projectedMonthlyRevenueMid - currentMonthlyRevenue) / currentMonthlyRevenue) * 100).toFixed(1))
                : 0;
            const projectedDaysToDepletion = projectedDailyVelocity > 0
                ? Math.round(currentStock / projectedDailyVelocity)
                : null;
            const result = {
                simulationId,
                scenarioType: req.scenarioType,
                productId: (profile === null || profile === void 0 ? void 0 : profile.productId) || null,
                productTitle: (profile === null || profile === void 0 ? void 0 : profile.title) || null,
                parameters: req.parameters,
                currentState: {
                    price: currentPrice,
                    stock: currentStock,
                    dailyVelocity: currentVelocity,
                    monthlyRevenue: currentMonthlyRevenue
                },
                projectedState: {
                    projectedPrice,
                    projectedDailyVelocity,
                    projectedMonthlyRevenueMin,
                    projectedMonthlyRevenueMax,
                    projectedMonthlyRevenueMid,
                    projectedDaysToDepletion,
                    revenueDeltaPct
                },
                confidence,
                assumptions,
                riskAssessment,
                recommendationText,
                simulatedLabel: 'SIMULATED / ESTIMATED',
                createdAt: new Date().toISOString()
            };
            // Persist simulation to database
            try {
                yield DB_1.client.query(`
        INSERT INTO merchant_ai_simulations (
          simulation_id, merchant_id, scenario_type, product_id, parameters,
          current_state, projected_state, confidence, risk_assessment, recommendation_text
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
                    simulationId,
                    merchantId,
                    req.scenarioType,
                    (profile === null || profile === void 0 ? void 0 : profile.productId) || null,
                    JSON.stringify(req.parameters),
                    JSON.stringify(result.currentState),
                    JSON.stringify(result.projectedState),
                    confidence,
                    riskAssessment,
                    recommendationText
                ]);
            }
            catch (err) {
                console.error('Failed to log simulation to DB:', err);
            }
            return result;
        });
    }
}
exports.BusinessSimulationEngine = BusinessSimulationEngine;
exports.businessSimulator = new BusinessSimulationEngine();
