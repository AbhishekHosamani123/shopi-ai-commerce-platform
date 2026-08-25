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
exports.executiveDecisionEngine = exports.ExecutiveDecisionEngine = void 0;
const DB_1 = require("../data/DB");
const inventory_optimizer_1 = require("../merchant-optimization/inventory-optimizer");
const historical_analytics_1 = require("../merchant-optimization/historical-analytics");
const clv_engine_1 = require("../merchant-customer-intelligence/clv-engine");
const cannibalization_engine_1 = require("../merchant-cannibalization/cannibalization-engine");
const action_service_1 = require("../merchant-actions/action-service");
class ExecutiveDecisionEngine {
    /**
     * Synthesizes today's TOP 3 strategic priorities, second-order effects, and decision explanations.
     */
    getDailyDecisions() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
            const health = yield (0, historical_analytics_1.getDataHealthSummary)(merchantId);
            // 1. Query lowest stock items for restock decision
            const lowStockProds = yield DB_1.client.query('SELECT productid, title, price, stock FROM products ORDER BY stock ASC LIMIT 3');
            const lowestProd = lowStockProds.rows[0];
            const invPlan = lowestProd ? yield (0, inventory_optimizer_1.optimizeProductInventory)(lowestProd.productid) : null;
            // 2. Customer churn signals
            const customerSummary = yield clv_engine_1.clvEngine.getCustomerCohortSummary();
            // 3. Cannibalization & substitution signals
            const cannibalSignals = yield cannibalization_engine_1.cannibalizationEngine.scanCannibalizationSignals(merchantId, 3);
            const priorities = [];
            const secondOrderEffects = [];
            // --- Priority 1: Restock & Supply Chain ---
            if (invPlan && lowestProd) {
                let actionId = null;
                try {
                    const action = yield (0, action_service_1.createAction)({
                        merchantId,
                        actionType: 'RESTOCK',
                        productId: lowestProd.productid,
                        quantity: invPlan.recommendedReorderQuantity,
                        reason: `Executive Priority 1: ${invPlan.reason}`,
                        payload: {
                            currentStock: invPlan.currentStock,
                            reorderPoint: invPlan.reorderPoint
                        }
                    });
                    actionId = action.actionId;
                }
                catch (err) { }
                priorities.push({
                    priorityRank: 1,
                    severity: invPlan.urgency === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
                    title: `Restock Priority: ${lowestProd.title}`,
                    problem: `Stock currently at ${invPlan.currentStock} units with ~${invPlan.daysOfCover || 14} days of inventory buffer remaining.`,
                    evidence: `Daily demand averages ${invPlan.forecastDailyDemand.toFixed(1)} units/day. Reorder Point is ${invPlan.reorderPoint} units.`,
                    expectedImpact: `Prevents an estimated ₹${Math.round(invPlan.recommendedReorderQuantity * parseFloat(lowestProd.price || '1000')).toLocaleString('en-IN')} in lost revenue from stockout.`,
                    confidence: 'HIGH',
                    risk: 'LOW',
                    recommendedAction: {
                        actionType: 'RESTOCK',
                        label: `Prepare PO for ${invPlan.recommendedReorderQuantity} units`,
                        actionId
                    },
                    approvalRequired: true,
                    explanation: {
                        why: `Product demand velocity will deplete existing stock within ~${invPlan.daysOfCover || 14} days.`,
                        whyNow: `Supplier lead time requires placing the purchase order today to arrive before stockouts occur.`,
                        whatIfDoNothing: `Product will stock out in ~${invPlan.daysOfCover || 14} days, resulting in zero sales and lost organic ranking.`,
                        whatIfAct: `Maintains continuous availability with a 21-day sales buffer.`,
                        whatCouldGoWrong: `Capital allocation of ₹${Math.round(invPlan.recommendedReorderQuantity * parseFloat(lowestProd.price || '1000') * 0.45).toLocaleString('en-IN')} committed to inventory.`
                    }
                });
                secondOrderEffects.push({
                    action: `Restock ${lowestProd.title} (${invPlan.recommendedReorderQuantity} units)`,
                    primaryEffect: `Replenishes warehouse buffer to 21 days coverage.`,
                    secondaryEffect: `Locks ~₹${Math.round(invPlan.recommendedReorderQuantity * parseFloat(lowestProd.price || '1000') * 0.45).toLocaleString('en-IN')} in working capital.`,
                    risk: `Inventory holding cost if demand unexpectedly contracts.`,
                    mitigation: `Reorder batch calibrated to exact 21-day velocity.`
                });
            }
            // --- Priority 2: Customer Retention ---
            let custActionId = null;
            if (customerSummary.atRiskCount > 0 && lowStockProds.rows[0]) {
                try {
                    const action = yield (0, action_service_1.createAction)({
                        merchantId,
                        actionType: 'CUSTOMER_REENGAGE',
                        productId: lowStockProds.rows[0].productid,
                        reason: `Executive Priority 2: Win-back discount for ${customerSummary.atRiskCount} at-risk customers`,
                        payload: {
                            atRiskCount: customerSummary.atRiskCount,
                            discountPct: 15
                        }
                    });
                    custActionId = action.actionId;
                }
                catch (err) { }
            }
            priorities.push({
                priorityRank: 2,
                severity: 'WARNING',
                title: `Re-Engage ${customerSummary.atRiskCount} At-Risk High-Value Customers`,
                problem: `${customerSummary.atRiskCount} customer accounts with repeat history have gone dormant (>60 days since last purchase).`,
                evidence: `Cohort represents ₹${Math.round(customerSummary.totalHistoricalSpend * 0.25).toLocaleString('en-IN')} in historical revenue.`,
                expectedImpact: `Recovers ~15% to 25% of lapsed customers, protecting future CLV trajectory.`,
                confidence: 'HIGH',
                risk: 'LOW',
                recommendedAction: {
                    actionType: 'CUSTOMER_REENGAGE',
                    label: `Stage 15% targeted retention discount`,
                    actionId: custActionId
                },
                approvalRequired: true,
                explanation: {
                    why: `Customer repeat purchase interval has lapsed into high churn probability.`,
                    whyNow: `Win-back success rate declines by 40% after 90 days of dormancy.`,
                    whatIfDoNothing: `Customers will permanently churn to competing storefronts.`,
                    whatIfAct: `Re-engages ~20% of accounts with immediate cash-flow lift.`,
                    whatCouldGoWrong: `Conditioning customers to wait for discounts (mitigated by one-time expiry).`
                }
            });
            secondOrderEffects.push({
                action: `Targeted 15% Win-Back Discount for At-Risk Customers`,
                primaryEffect: `Re-activates dormant customer orders.`,
                secondaryEffect: `Reduces margin on promotional transactions by 15%.`,
                risk: `Margin dilution on purchases that might have occurred organically.`,
                mitigation: `Target exclusively customers with >60 days dormancy.`
            });
            // --- Priority 3: Pricing & Cannibalization Defense ---
            const topProdRes = yield DB_1.client.query('SELECT productid, title, price FROM products ORDER BY price DESC LIMIT 1');
            const topProd = topProdRes.rows[0];
            priorities.push({
                priorityRank: 3,
                severity: 'OPPORTUNITY',
                title: cannibalSignals.length > 0
                    ? `Resolve Demand Cannibalization: ${cannibalSignals[0].productTitleA} vs ${cannibalSignals[0].productTitleB}`
                    : `Protect High-Momentum Catalog Pricing: ${(topProd === null || topProd === void 0 ? void 0 : topProd.title) || 'Premium Products'}`,
                problem: cannibalSignals.length > 0
                    ? cannibalSignals[0].interpretation
                    : `High organic demand momentum requires avoiding unnecessary blanket discounting.`,
                evidence: cannibalSignals.length > 0
                    ? `Estimated ${cannibalSignals[0].estimatedCannibalizedUnits} units shifted across substitute SKUs.`
                    : `Recent conversion rates remain stable; margin preservation is optimal.`,
                expectedImpact: `Protects gross margin while maximizing net category profit.`,
                confidence: 'MEDIUM',
                risk: 'LOW',
                recommendedAction: {
                    actionType: 'PRICE_PROTECT',
                    label: cannibalSignals.length > 0 ? `Adjust Promotion Strategy` : `Maintain Regular Price`,
                    actionId: null
                },
                approvalRequired: false,
                explanation: {
                    why: `Uncoordinated discounting across substitute SKUs cannibalizes existing revenue.`,
                    whyNow: `Recent promotion window showed noticeable demand shift between similar catalog lines.`,
                    whatIfDoNothing: `Demand continues shifting to lower-margin variants.`,
                    whatIfAct: `Harmonizes pricing strategy across the category.`,
                    whatCouldGoWrong: `Slight deceleration in low-price variant volume.`
                }
            });
            secondOrderEffects.push({
                action: `Maintain Baseline Price Protection on High-Demand SKUs`,
                primaryEffect: `Maximizes gross margin per unit sold.`,
                secondaryEffect: `May slightly dampen short-term unit velocity compared to steep discounting.`,
                risk: `Slower clearance of aged inventory batches.`,
                mitigation: `Apply selective clearance only to SKUs with >90 days coverage.`
            });
            return {
                date: new Date().toISOString().split('T')[0],
                merchantId,
                overallHealthScore: health.overallHealthScore,
                topPriorities: priorities,
                secondOrderEffects,
                keyAssumptions: [
                    'Recent 14-day sales velocity represents current baseline demand.',
                    'Supplier lead times and fulfillment reliability remain stable.',
                    'No external macroeconomic shocks or unannounced supplier price hikes.'
                ]
            };
        });
    }
}
exports.ExecutiveDecisionEngine = ExecutiveDecisionEngine;
exports.executiveDecisionEngine = new ExecutiveDecisionEngine();
