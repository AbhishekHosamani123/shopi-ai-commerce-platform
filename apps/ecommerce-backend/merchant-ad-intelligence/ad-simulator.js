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
exports.adSimulator = exports.AdSimulator = void 0;
const DB_1 = require("../data/DB");
class AdSimulator {
    /**
     * Simulates paid advertising traffic lift, revenue ranges, and stockout probability for a SKU.
     */
    simulateAdSpend(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const prodRes = yield DB_1.client.query('SELECT productid, title, price, discount, stock FROM products WHERE productid = $1', [input.productId]);
            if (prodRes.rows.length === 0)
                return null;
            const prod = prodRes.rows[0];
            const currentStock = parseInt(prod.stock, 10) || 0;
            const price = parseFloat(prod.discount || prod.price) || 1000;
            const spend = Math.max(1000, input.adSpend);
            // Heuristic CPC ~₹18 - ₹28, conversion ~2.0% - 3.5%
            const estimatedClicks = Math.round(spend / 22);
            const minUnits = Math.max(1, Math.round(estimatedClicks * 0.020));
            const midUnits = Math.max(2, Math.round(estimatedClicks * 0.028));
            const maxUnits = Math.max(3, Math.round(estimatedClicks * 0.038));
            const minRevenue = Math.round(minUnits * price);
            const midRevenue = Math.round(midUnits * price);
            const maxRevenue = Math.round(maxUnits * price);
            const projectedDepletion = currentStock - midUnits;
            const stockoutRiskAfterAdLift = projectedDepletion <= 5 ? 'HIGH' : projectedDepletion <= 15 ? 'MEDIUM' : 'LOW';
            return {
                simulatedLabel: 'SIMULATED / ESTIMATED',
                productId: prod.productid,
                productTitle: prod.title,
                adSpend: spend,
                channel: input.channel || 'DIRECT_STORE',
                inventoryCoverageDays: Math.round(currentStock / Math.max(0.5, midUnits / 7)),
                projectedDemandRange: {
                    minUnits,
                    midUnits,
                    maxUnits
                },
                projectedRevenueRange: {
                    minRevenue,
                    midRevenue,
                    maxRevenue
                },
                stockoutRiskAfterAdLift,
                confidence: 'MEDIUM',
                assumptions: [
                    `Heuristic conversion rate modeled between 2.0% and 3.8% for ${prod.title}.`,
                    'CPC benchmark calibrated to Indian DTC commerce standards (~₹22/click).',
                    'Assumes static pricing without concurrent flash discounts.'
                ]
            };
        });
    }
}
exports.AdSimulator = AdSimulator;
exports.adSimulator = new AdSimulator();
