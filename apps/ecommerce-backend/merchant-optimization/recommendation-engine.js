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
exports.optimizationRecommendationEngine = exports.OptimizationRecommendationEngine = void 0;
const DB_1 = require("../data/DB");
const inventory_optimizer_1 = require("./inventory-optimizer");
const pricing_optimizer_1 = require("./pricing-optimizer");
const customer_growth_1 = require("./customer-growth");
const action_service_1 = require("../merchant-actions/action-service");
function mapRowToRecommendation(r) {
    return {
        recommendationId: r.recommendation_id,
        merchantId: r.merchant_id,
        category: r.category,
        goal: r.goal,
        title: r.title,
        summary: r.summary,
        productId: r.product_id ? parseInt(r.product_id, 10) : null,
        impact: r.impact,
        confidence: r.confidence,
        confidenceScore: parseFloat(r.confidence_score || '0.80'),
        urgency: r.urgency,
        risk: r.risk,
        actionType: r.action_type,
        actionId: r.action_id,
        evidence: typeof r.evidence === 'string' ? JSON.parse(r.evidence) : r.evidence || {},
        status: r.status,
        createdAt: r.created_at,
        expiresAt: r.expires_at
    };
}
class OptimizationRecommendationEngine {
    /**
     * Generates goal-driven, explainable recommendations tailored to the merchant's strategic objective.
     */
    generateRecommendations() {
        return __awaiter(this, arguments, void 0, function* (goal = 'MAXIMIZE_REVENUE', merchantId = 'default_merchant') {
            const productsRes = yield DB_1.client.query('SELECT productid FROM products ORDER BY stock ASC LIMIT 20');
            const productIds = productsRes.rows.map(r => r.productid);
            const recommendations = [];
            // 1. Inventory & Restock Optimizations
            for (const pid of productIds.slice(0, 5)) {
                const invPlan = yield (0, inventory_optimizer_1.optimizeProductInventory)(pid);
                if (invPlan) {
                    let actionId = null;
                    try {
                        const action = yield (0, action_service_1.createAction)({
                            merchantId,
                            actionType: 'RESTOCK',
                            productId: pid,
                            quantity: invPlan.recommendedReorderQuantity,
                            reason: invPlan.reason,
                            payload: {
                                currentStock: invPlan.currentStock,
                                safetyStock: invPlan.safetyStock,
                                reorderPoint: invPlan.reorderPoint
                            }
                        });
                        actionId = action.actionId;
                    }
                    catch (err) {
                        // Action creation fallback
                    }
                    recommendations.push({
                        merchantId,
                        category: 'INVENTORY',
                        goal,
                        title: `Restock Recommendation: ${invPlan.title}`,
                        summary: invPlan.reason,
                        productId: pid,
                        impact: invPlan.urgency === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
                        confidence: 'HIGH',
                        confidenceScore: 0.90,
                        urgency: invPlan.urgency,
                        risk: 'LOW',
                        actionType: 'RESTOCK',
                        actionId,
                        evidence: {
                            currentStock: invPlan.currentStock,
                            reorderPoint: invPlan.reorderPoint,
                            safetyStock: invPlan.safetyStock,
                            recommendedQuantity: invPlan.recommendedReorderQuantity
                        },
                        status: 'ACTIVE'
                    });
                }
            }
            // 2. Pricing & Margin Adjustments
            for (const pid of productIds.slice(0, 5)) {
                const priceRec = yield (0, pricing_optimizer_1.recommendPriceAdjustment)(pid, merchantId);
                if (priceRec && priceRec.direction !== 'MAINTAIN') {
                    let actionId = null;
                    try {
                        const action = yield (0, action_service_1.createAction)({
                            merchantId,
                            actionType: priceRec.direction === 'DECREASE' ? 'DISCOUNT' : 'RESTOCK',
                            productId: pid,
                            reason: priceRec.reason,
                            payload: {
                                currentPrice: priceRec.currentPrice,
                                recommendedPrice: priceRec.recommendedPrice,
                                priceDeltaPct: priceRec.priceDeltaPct
                            }
                        });
                        actionId = action.actionId;
                    }
                    catch (err) { }
                    recommendations.push({
                        merchantId,
                        category: 'PRICING',
                        goal,
                        title: `Price Adjustment: ${priceRec.title} (${priceRec.direction})`,
                        summary: priceRec.reason,
                        productId: pid,
                        impact: priceRec.direction === 'INCREASE' ? 'HIGH' : 'MEDIUM',
                        confidence: priceRec.confidence,
                        confidenceScore: priceRec.confidence === 'HIGH' ? 0.85 : 0.65,
                        urgency: 'INFO',
                        risk: priceRec.direction === 'INCREASE' ? 'LOW' : 'MEDIUM',
                        actionType: 'PRICE_CHANGE',
                        actionId,
                        evidence: {
                            currentPrice: priceRec.currentPrice,
                            recommendedPrice: priceRec.recommendedPrice,
                            priceDeltaPct: priceRec.priceDeltaPct,
                            elasticity: priceRec.estimatedElasticity
                        },
                        status: 'ACTIVE'
                    });
                }
            }
            // 3. Customer Retention & Growth
            const customerSummary = yield (0, customer_growth_1.getCustomerGrowthAnalysis)();
            if (customerSummary.atRiskCount > 0) {
                let actionId = null;
                try {
                    const action = yield (0, action_service_1.createAction)({
                        merchantId,
                        actionType: 'PROMOTION',
                        productId: productIds[0],
                        reason: `Win-back discount for ${customerSummary.atRiskCount} at-risk customers`,
                        payload: {
                            atRiskCount: customerSummary.atRiskCount,
                            discountPct: 10
                        }
                    });
                    actionId = action.actionId;
                }
                catch (err) { }
                recommendations.push({
                    merchantId,
                    category: 'CUSTOMER',
                    goal,
                    title: `Re-Engage ${customerSummary.atRiskCount} At-Risk High Value Customers`,
                    summary: `${customerSummary.atRiskCount} historically loyal customer(s) haven't purchased in >60 days. Staging targeted email/coupon incentives can prevent churn.`,
                    impact: 'HIGH',
                    confidence: 'HIGH',
                    confidenceScore: 0.85,
                    urgency: 'WARNING',
                    risk: 'LOW',
                    actionType: 'CUSTOMER_REENGAGE',
                    actionId,
                    evidence: {
                        atRiskCount: customerSummary.atRiskCount,
                        vipCount: customerSummary.vipCount
                    },
                    status: 'ACTIVE'
                });
            }
            // 4. Filter & Rank according to active Business Goal
            const scoredRecommendations = recommendations.sort((a, b) => {
                // Goal Weighting Modifier
                let weightA = 0;
                let weightB = 0;
                if (goal === 'CLEAR_INVENTORY') {
                    if (a.actionType === 'DISCOUNT' || a.category === 'INVENTORY')
                        weightA += 10;
                    if (b.actionType === 'DISCOUNT' || b.category === 'INVENTORY')
                        weightB += 10;
                }
                else if (goal === 'PROTECT_MARGIN') {
                    if (a.actionType === 'PRICE_CHANGE')
                        weightA += 10;
                    if (b.actionType === 'PRICE_CHANGE')
                        weightB += 10;
                }
                else if (goal === 'GROW_CUSTOMERS' || goal === 'INCREASE_REPEAT_PURCHASES') {
                    if (a.category === 'CUSTOMER')
                        weightA += 10;
                    if (b.category === 'CUSTOMER')
                        weightB += 10;
                }
                else {
                    // MAXIMIZE_REVENUE default
                    if (a.impact === 'HIGH')
                        weightA += 5;
                    if (b.impact === 'HIGH')
                        weightB += 5;
                }
                if (a.urgency === 'CRITICAL')
                    weightA += 10;
                if (b.urgency === 'CRITICAL')
                    weightB += 10;
                return weightB - weightA;
            });
            // 5. Persist to merchant_ai_recommendations table
            const persisted = [];
            for (const rec of scoredRecommendations.slice(0, 10)) {
                const recId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                const query = `
        INSERT INTO merchant_ai_recommendations (
          recommendation_id, merchant_id, category, goal, title, summary,
          product_id, impact, confidence, confidence_score, urgency, risk,
          action_type, action_id, evidence, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'ACTIVE')
        RETURNING *;
      `;
                try {
                    const res = yield DB_1.client.query(query, [
                        recId,
                        merchantId,
                        rec.category,
                        goal,
                        rec.title,
                        rec.summary,
                        rec.productId || null,
                        rec.impact,
                        rec.confidence,
                        rec.confidenceScore,
                        rec.urgency,
                        rec.risk,
                        rec.actionType || null,
                        rec.actionId || null,
                        JSON.stringify(rec.evidence)
                    ]);
                    persisted.push(mapRowToRecommendation(res.rows[0]));
                }
                catch (err) {
                    console.error('Failed to persist recommendation:', err);
                }
            }
            return persisted;
        });
    }
    /**
     * Lists active optimization recommendations for a merchant.
     */
    listRecommendations() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant', goal) {
            const params = [merchantId];
            let goalFilter = '';
            if (goal) {
                params.push(goal);
                goalFilter = `AND goal = $2`;
            }
            const query = `
      SELECT * FROM merchant_ai_recommendations
      WHERE (merchant_id = $1 OR $1 = 'merchant_admin') AND status = 'ACTIVE'
      ${goalFilter}
      ORDER BY 
        CASE urgency WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,
        confidence_score DESC,
        created_at DESC
      LIMIT 20;
    `;
            const res = yield DB_1.client.query(query, params);
            if (res.rows.length === 0) {
                return yield this.generateRecommendations(goal || 'MAXIMIZE_REVENUE', merchantId);
            }
            return res.rows.map(mapRowToRecommendation);
        });
    }
}
exports.OptimizationRecommendationEngine = OptimizationRecommendationEngine;
exports.optimizationRecommendationEngine = new OptimizationRecommendationEngine();
