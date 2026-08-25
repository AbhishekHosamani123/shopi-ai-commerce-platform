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
exports.feedbackService = exports.FeedbackService = void 0;
const DB_1 = require("../../data/DB");
class FeedbackService {
    /**
     * Records human merchant feedback on an AI decision without mutating underlying financial ledgers.
     */
    recordFeedback(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const feedbackId = `fb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const res = yield DB_1.client.query(`
      INSERT INTO merchant_learning_feedback (
        feedback_id, decision_id, merchant_id, feedback_type, rating_score, reason, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      RETURNING *;
    `, [
                feedbackId,
                params.decisionId,
                params.merchantId,
                params.feedbackType,
                params.ratingScore || null,
                params.reason || null
            ]);
            const r = res.rows[0];
            return {
                feedbackId: r.feedback_id,
                decisionId: r.decision_id,
                merchantId: r.merchant_id,
                feedbackType: r.feedback_type,
                ratingScore: r.rating_score ? parseInt(r.rating_score, 10) : null,
                reason: r.reason || null,
                createdAt: new Date(r.created_at).toISOString()
            };
        });
    }
    /**
     * Aggregates merchant feedback stats.
     */
    getFeedbackSummary() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
            const res = yield DB_1.client.query(`
      SELECT 
        COUNT(*)::int as total,
        COALESCE(SUM(CASE WHEN feedback_type IN ('HELPFUL', 'CORRECT') THEN 1 ELSE 0 END), 0)::int as positive,
        COALESCE(SUM(CASE WHEN feedback_type IN ('NOT_HELPFUL', 'INCORRECT') THEN 1 ELSE 0 END), 0)::int as negative,
        COALESCE(SUM(CASE WHEN feedback_type = 'TOO_RISKY' THEN 1 ELSE 0 END), 0)::int as too_risky,
        COALESCE(SUM(CASE WHEN feedback_type = 'TOO_CONSERVATIVE' THEN 1 ELSE 0 END), 0)::int as too_conservative
      FROM merchant_learning_feedback
      WHERE (merchant_id = $1 OR $1 = 'merchant_admin');
    `, [merchantId]);
            const row = res.rows[0];
            const total = row.total || 0;
            const pos = row.positive || 0;
            const neg = row.negative || 0;
            return {
                totalFeedbackCount: total,
                helpfulCount: pos,
                notHelpfulCount: neg,
                correctCount: pos,
                tooRiskyCount: row.too_risky || 0,
                tooConservativeCount: row.too_conservative || 0,
                satisfactionRatePct: total > 0 ? Math.round((pos / total) * 100) : 90
            };
        });
    }
}
exports.FeedbackService = FeedbackService;
exports.feedbackService = new FeedbackService();
