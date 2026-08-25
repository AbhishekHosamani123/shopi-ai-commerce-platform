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
exports.businessRiskRadar = exports.BusinessRiskRadar = void 0;
const DB_1 = require("../data/DB");
class BusinessRiskRadar {
    /**
     * Scans multi-dimensional business concentration and operational risks.
     */
    scanBusinessRisks() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const risks = [];
            // 1. SKU Concentration Check (Revenue share of top 2 SKUs)
            const skuRes = yield DB_1.client.query(`
      SELECT 
        p.productid,
        p.title,
        COALESCE(SUM(oi.quantity * COALESCE(p.discount, p.price)), 0) as sku_revenue
      FROM products p
      JOIN orderitems oi ON p.productid = oi.productid
      JOIN orders o ON oi.orderid = o.orderid
      WHERE o.createdat >= CURRENT_TIMESTAMP - INTERVAL '90 days'
      GROUP BY p.productid, p.title
      ORDER BY sku_revenue DESC;
    `);
            const totalSkuRev = skuRes.rows.reduce((acc, r) => acc + parseFloat(r.sku_revenue), 0);
            const top2Rev = (parseFloat((_a = skuRes.rows[0]) === null || _a === void 0 ? void 0 : _a.sku_revenue) || 0) + (parseFloat((_b = skuRes.rows[1]) === null || _b === void 0 ? void 0 : _b.sku_revenue) || 0);
            const skuConcentrationPct = totalSkuRev > 0 ? Math.round((top2Rev / totalSkuRev) * 100) : 25;
            if (skuConcentrationPct > 35) {
                risks.push({
                    riskType: 'SKU_CONCENTRATION',
                    title: 'High Catalog SKU Concentration',
                    severity: skuConcentrationPct > 45 ? 'HIGH' : 'MEDIUM',
                    metricValue: `${skuConcentrationPct}% of revenue from top 2 SKUs`,
                    explanation: `Top 2 products ("${(_c = skuRes.rows[0]) === null || _c === void 0 ? void 0 : _c.title}" and "${(_d = skuRes.rows[1]) === null || _d === void 0 ? void 0 : _d.title}") account for ${skuConcentrationPct}% of 90-day gross revenue.`,
                    mitigationRecommendation: 'Promote secondary category lines and introduce adjacent variants to broaden revenue baseline.'
                });
            }
            // 2. Customer Concentration Check
            const custRes = yield DB_1.client.query(`
      SELECT 
        u.userid,
        COALESCE(SUM(o.totalamount), 0) as user_spend
      FROM users u
      JOIN orders o ON u.userid = o.userid
      GROUP BY u.userid
      ORDER BY user_spend DESC;
    `);
            const totalCustSpend = custRes.rows.reduce((acc, r) => acc + parseFloat(r.user_spend), 0);
            const top5CustSpend = custRes.rows.slice(0, 5).reduce((acc, r) => acc + parseFloat(r.user_spend), 0);
            const custConcentrationPct = totalCustSpend > 0 ? Math.round((top5CustSpend / totalCustSpend) * 100) : 10;
            if (custConcentrationPct > 15) {
                risks.push({
                    riskType: 'CUSTOMER_CONCENTRATION',
                    title: 'Customer Cohort Concentration',
                    severity: custConcentrationPct > 25 ? 'HIGH' : 'MEDIUM',
                    metricValue: `${custConcentrationPct}% from top 5 customer accounts`,
                    explanation: `A narrow segment of 5 buyers generates ${custConcentrationPct}% of all customer lifetime revenue.`,
                    mitigationRecommendation: 'Expand acquisition campaigns and loyalty programs to cultivate a wider mid-tier buyer base.'
                });
            }
            // 3. Supplier Concentration Check
            const suppRes = yield DB_1.client.query(`
      SELECT COUNT(*)::int as supplier_count FROM merchant_suppliers WHERE merchant_id = $1 OR $1 = 'merchant_admin';
    `, [merchantId]);
            const supplierCount = ((_e = suppRes.rows[0]) === null || _e === void 0 ? void 0 : _e.supplier_count) || 0;
            if (supplierCount <= 2) {
                risks.push({
                    riskType: 'SUPPLIER_CONCENTRATION',
                    title: 'Single/Dual Supplier Dependency',
                    severity: supplierCount <= 1 ? 'HIGH' : 'MEDIUM',
                    metricValue: `${supplierCount} active suppliers configured`,
                    explanation: 'Fulfillment relies on a limited supplier base. Operational disruptions or lead-time spikes pose high stockout exposure.',
                    mitigationRecommendation: 'Onboard secondary backup suppliers for top velocity lines to build procurement resilience.'
                });
            }
            // 4. Warehouse Concentration Check
            const whRes = yield DB_1.client.query(`
      SELECT 
        warehouse_id,
        COALESCE(SUM(available_quantity), 0) as wh_stock
      FROM merchant_warehouse_inventory
      WHERE merchant_id = $1 OR $1 = 'merchant_admin'
      GROUP BY warehouse_id
      ORDER BY wh_stock DESC;
    `, [merchantId]);
            const totalWhStock = whRes.rows.reduce((acc, r) => acc + parseInt(r.wh_stock, 10), 0);
            const topWhStock = parseInt((_f = whRes.rows[0]) === null || _f === void 0 ? void 0 : _f.wh_stock, 10) || 0;
            const whConcentrationPct = totalWhStock > 0 ? Math.round((topWhStock / totalWhStock) * 100) : 50;
            if (whConcentrationPct > 55) {
                risks.push({
                    riskType: 'WAREHOUSE_CONCENTRATION',
                    title: 'Asymmetric Warehouse Stock Allocation',
                    severity: 'MEDIUM',
                    metricValue: `${whConcentrationPct}% stock held in single facility`,
                    explanation: `Over half of all available catalog inventory is concentrated in one primary warehouse node.`,
                    mitigationRecommendation: 'Execute inter-warehouse rebalancing transfers to distribute stock closer to regional demand centers.'
                });
            }
            // 5. Discount Dependency Check
            const discRes = yield DB_1.client.query(`
      SELECT 
        COUNT(CASE WHEN discount IS NOT NULL AND discount < price THEN 1 END)::int as discounted_skus,
        COUNT(productid)::int as total_skus
      FROM products;
    `);
            const discountedSkus = ((_g = discRes.rows[0]) === null || _g === void 0 ? void 0 : _g.discounted_skus) || 0;
            const totalSkus = ((_h = discRes.rows[0]) === null || _h === void 0 ? void 0 : _h.total_skus) || 40;
            const discountPct = Math.round((discountedSkus / totalSkus) * 100);
            if (discountPct > 50) {
                risks.push({
                    riskType: 'DISCOUNT_DEPENDENCY',
                    title: 'High Promotion Dependency',
                    severity: 'MEDIUM',
                    metricValue: `${discountPct}% of catalog SKUs discounted`,
                    explanation: `More than half of the product catalog is currently selling at markdown prices.`,
                    mitigationRecommendation: 'Gradually restore full price points on inelastic products to avoid brand margin erosion.'
                });
            }
            const highCount = risks.filter(r => r.severity === 'HIGH').length;
            const overallRiskLevel = highCount >= 2 ? 'HIGH' : highCount === 1 ? 'MEDIUM' : 'LOW';
            const concentrationIndexScore = Math.min(100, Math.round((skuConcentrationPct * 0.4) + (custConcentrationPct * 0.3) + (whConcentrationPct * 0.3)));
            return {
                overallRiskLevel,
                identifiedRisks: risks,
                concentrationIndexScore,
                evaluatedAt: new Date().toISOString()
            };
        });
    }
}
exports.BusinessRiskRadar = BusinessRiskRadar;
exports.businessRiskRadar = new BusinessRiskRadar();
