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
exports.analyzePriceElasticity = analyzePriceElasticity;
exports.recommendPriceAdjustment = recommendPriceAdjustment;
const DB_1 = require("../data/DB");
const historical_analytics_1 = require("./historical-analytics");
const pricing_validator_1 = require("./pricing-validator");
/**
 * Evaluates price elasticity of demand based on historical price observations.
 */
function analyzePriceElasticity(productId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Query distinct historical prices and corresponding unit volumes from orderitems joined with products
        const priceHistoryRes = yield DB_1.client.query(`
    SELECT 
      p.price::numeric(10,2) as price_point,
      SUM(oi.quantity)::int as total_units,
      COUNT(DISTINCT DATE(o.createdat))::int as sales_days
    FROM orderitems oi
    JOIN orders o ON oi.orderid = o.orderid
    JOIN products p ON oi.productid = p.productid
    WHERE oi.productid = $1
    GROUP BY p.price
    ORDER BY p.price ASC;
  `, [productId]);
        const observations = priceHistoryRes.rows;
        if (observations.length < 3) {
            return {
                hasSufficientData: false,
                elasticity: null,
                elasticityLabel: 'Insufficient historical pricing variation',
                observationsCount: observations.length,
                explanation: `Only ${observations.length} historical price point(s) recorded for this SKU. A minimum of 3 price points is required to calculate empirical price elasticity.`
            };
        }
        // Calculate arc elasticity between min and max observed price points
        const p1 = parseFloat(observations[0].price_point);
        const q1 = observations[0].total_units / Math.max(1, observations[0].sales_days);
        const p2 = parseFloat(observations[observations.length - 1].price_point);
        const q2 = observations[observations.length - 1].total_units / Math.max(1, observations[observations.length - 1].sales_days);
        const pctDeltaQ = (q2 - q1) / ((q1 + q2) / 2);
        const pctDeltaP = (p2 - p1) / ((p1 + p2) / 2);
        const elasticity = pctDeltaP !== 0 ? parseFloat((pctDeltaQ / pctDeltaP).toFixed(2)) : -1.0;
        const absE = Math.abs(elasticity);
        let elasticityLabel = 'Unitary Elastic';
        if (absE > 1.2) {
            elasticityLabel = 'Elastic (High Demand Sensitivity to Price)';
        }
        else if (absE < 0.8) {
            elasticityLabel = 'Inelastic (Low Demand Sensitivity to Price)';
        }
        return {
            hasSufficientData: true,
            elasticity,
            elasticityLabel,
            observationsCount: observations.length,
            explanation: `Calculated empirical elasticity of ${elasticity} across ${observations.length} distinct historical price points (${elasticityLabel}).`
        };
    });
}
/**
 * Generates an explainable pricing recommendation for a product.
 */
function recommendPriceAdjustment(productId_1) {
    return __awaiter(this, arguments, void 0, function* (productId, merchantId = 'default_merchant') {
        const profile = yield (0, historical_analytics_1.getProductHistoricalProfile)(productId);
        if (!profile)
            return null;
        const elasticityAnalysis = yield analyzePriceElasticity(productId);
        const currentPrice = profile.price;
        const v7 = profile.last7Days.dailyVelocity;
        const stock = profile.currentStock;
        let direction = 'MAINTAIN';
        let recommendedPrice = currentPrice;
        let reason = 'Price is well-calibrated to current demand and inventory buffer.';
        let confidence = elasticityAnalysis.hasSufficientData ? 'HIGH' : 'MEDIUM';
        // Scenario 1: High Demand + Scarcity -> Safe price increase (+5% to +10%)
        if (v7 >= 2.0 && stock < 60 && profile.growthPct >= 10) {
            direction = 'INCREASE';
            // Increase price by ~5-8%, rounded to nearest 49 or 99
            const rawNewPrice = Math.round(currentPrice * 1.06 / 50) * 50 - 1; // e.g. 1999 -> 2099
            recommendedPrice = Math.max(currentPrice + 50, rawNewPrice);
            reason = `Strong sales velocity (${v7} units/day) combined with tight inventory (${stock} units) indicates pricing power. A +${(((recommendedPrice - currentPrice) / currentPrice) * 100).toFixed(1)}% adjustment protects margin while demand remains resilient.`;
        }
        // Scenario 2: Slow velocity + Elevated inventory -> Markdown (-10% to -15%)
        else if (v7 <= 0.8 && stock > 100 && profile.growthPct <= -10) {
            direction = 'DECREASE';
            const rawNewPrice = Math.round(currentPrice * 0.90 / 50) * 50 - 1;
            recommendedPrice = Math.min(currentPrice - 50, rawNewPrice);
            reason = `Low 7-day velocity (${v7} units/day) with excess stock (${stock} units) is tying up capital. A ${(((recommendedPrice - currentPrice) / currentPrice) * 100).toFixed(1)}% markdown stimulates clearance volume.`;
        }
        // Validate recommendation guardrails
        const validation = (0, pricing_validator_1.validatePriceAdjustment)(currentPrice, recommendedPrice);
        if (!validation.isValid) {
            recommendedPrice = currentPrice;
            direction = 'MAINTAIN';
            reason = `Proposed adjustment exceeded safety guardrails (${validation.reason}). Maintaining price baseline.`;
        }
        const priceDelta = recommendedPrice - currentPrice;
        const priceDeltaPct = currentPrice > 0 ? parseFloat(((priceDelta / currentPrice) * 100).toFixed(1)) : 0;
        return {
            productId: profile.productId,
            title: profile.title,
            currentPrice,
            recommendedPrice,
            priceDelta,
            priceDeltaPct,
            direction,
            estimatedElasticity: elasticityAnalysis.elasticity,
            elasticityLabel: elasticityAnalysis.elasticityLabel,
            confidence,
            reason
        };
    });
}
