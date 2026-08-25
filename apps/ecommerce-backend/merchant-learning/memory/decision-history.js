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
exports.decisionHistoryService = exports.DecisionHistoryService = void 0;
const DB_1 = require("../../data/DB");
class DecisionHistoryService {
    /**
     * Fetches historical approved and rejected decisions to inform recommendation ranking.
     */
    getDecisionHistory() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant', limit = 20) {
            const res = yield DB_1.client.query(`
      SELECT action_id, action_type, product_id, product_name, quantity, status, reason, created_at, completed_at
      FROM merchant_ai_actions
      WHERE (merchant_id = $1 OR $1 = 'merchant_admin')
      ORDER BY created_at DESC
      LIMIT $2;
    `, [merchantId, limit]);
            return res.rows.map(r => ({
                actionId: r.action_id,
                actionType: r.action_type,
                productId: r.product_id,
                productName: r.product_name,
                quantity: r.quantity,
                status: r.status,
                reason: r.reason,
                createdAt: new Date(r.created_at).toISOString(),
                completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null
            }));
        });
    }
}
exports.DecisionHistoryService = DecisionHistoryService;
exports.decisionHistoryService = new DecisionHistoryService();
