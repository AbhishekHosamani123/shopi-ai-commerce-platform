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
exports.evaluateCustomerValueTrend = evaluateCustomerValueTrend;
const DB_1 = require("../data/DB");
/**
 * Tracks historical customer spend trajectory across rolling 30d/60d/90d intervals to detect value decay.
 */
function evaluateCustomerValueTrend(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const query = `
    SELECT
      COALESCE(SUM(CASE WHEN createdat >= CURRENT_DATE - INTERVAL '30 days' THEN totalamount ELSE 0 END), 0)::numeric(12,2) as spend_30d,
      COALESCE(SUM(CASE WHEN createdat >= CURRENT_DATE - INTERVAL '60 days' AND createdat < CURRENT_DATE - INTERVAL '30 days' THEN totalamount ELSE 0 END), 0)::numeric(12,2) as spend_60d,
      COALESCE(SUM(CASE WHEN createdat >= CURRENT_DATE - INTERVAL '90 days' AND createdat < CURRENT_DATE - INTERVAL '60 days' THEN totalamount ELSE 0 END), 0)::numeric(12,2) as spend_90d
    FROM orders
    WHERE userid = $1;
  `;
        const res = yield DB_1.client.query(query, [userId]);
        const row = res.rows[0];
        const spend30d = parseFloat((row === null || row === void 0 ? void 0 : row.spend_30d) || '0');
        const spend60d = parseFloat((row === null || row === void 0 ? void 0 : row.spend_60d) || '0');
        const spend90d = parseFloat((row === null || row === void 0 ? void 0 : row.spend_90d) || '0');
        if (spend30d > spend60d && spend60d >= spend90d) {
            return {
                trend: 'EXPANDING',
                spend30d,
                spend60d,
                spend90d,
                explanation: `Customer value is expanding: 30d spend (₹${spend30d}) grew relative to previous periods.`
            };
        }
        if (spend30d === 0 && (spend60d > 0 || spend90d > 0)) {
            return {
                trend: 'DECLINING',
                spend30d,
                spend60d,
                spend90d,
                explanation: `Customer value is declining: zero spend in the last 30 days following ₹${spend60d + spend90d} in previous 60 days.`
            };
        }
        return {
            trend: 'STABLE',
            spend30d,
            spend60d,
            spend90d,
            explanation: `Customer spend is stable over 90-day trajectory.`
        };
    });
}
