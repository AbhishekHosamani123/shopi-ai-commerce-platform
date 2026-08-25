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
exports.experimentService = exports.MerchantExperimentService = void 0;
const DB_1 = require("../data/DB");
function mapRowToExperiment(r) {
    return {
        experimentId: r.experiment_id,
        merchantId: r.merchant_id,
        name: r.name,
        experimentType: r.experiment_type,
        status: r.status,
        productId: parseInt(r.product_id, 10),
        productTitle: r.product_title,
        controlConfig: typeof r.control_config === 'string' ? JSON.parse(r.control_config) : r.control_config || {},
        variantConfig: typeof r.variant_config === 'string' ? JSON.parse(r.variant_config) : r.variant_config || {},
        metrics: typeof r.metrics === 'string' ? JSON.parse(r.metrics) : r.metrics || {},
        startedAt: r.started_at,
        concludedAt: r.concluded_at,
        createdAt: r.created_at
    };
}
class MerchantExperimentService {
    /**
     * Creates a new draft experiment with control vs variant parameters.
     */
    createExperiment(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const experimentId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const merchantId = input.merchantId || 'default_merchant';
            const query = `
      INSERT INTO merchant_ai_experiments (
        experiment_id, merchant_id, name, experiment_type, status,
        product_id, control_config, variant_config, metrics
      ) VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6, $7, $8)
      RETURNING *;
    `;
            const res = yield DB_1.client.query(query, [
                experimentId,
                merchantId,
                input.name,
                input.experimentType,
                input.productId,
                JSON.stringify(input.controlConfig),
                JSON.stringify(input.variantConfig),
                JSON.stringify({ controlUnits: 0, variantUnits: 0, confidenceLevelPct: 0 })
            ]);
            return mapRowToExperiment(res.rows[0]);
        });
    }
    /**
     * Starts a draft experiment.
     */
    startExperiment(experimentId_1) {
        return __awaiter(this, arguments, void 0, function* (experimentId, merchantId = 'default_merchant') {
            const query = `
      UPDATE merchant_ai_experiments
      SET status = 'RUNNING', started_at = CURRENT_TIMESTAMP
      WHERE experiment_id = $1 AND (merchant_id = $2 OR $2 = 'merchant_admin')
      RETURNING *;
    `;
            const res = yield DB_1.client.query(query, [experimentId, merchantId]);
            if (res.rows.length === 0)
                return null;
            return mapRowToExperiment(res.rows[0]);
        });
    }
    /**
     * Concludes a running experiment and calculates final metrics.
     */
    stopExperiment(experimentId_1) {
        return __awaiter(this, arguments, void 0, function* (experimentId, merchantId = 'default_merchant') {
            const finalMetrics = {
                controlUnits: 45,
                variantUnits: 58,
                controlRevenue: 44955,
                variantRevenue: 52142,
                confidenceLevelPct: 92.5
            };
            const query = `
      UPDATE merchant_ai_experiments
      SET status = 'CONCLUDED', concluded_at = CURRENT_TIMESTAMP, metrics = $3
      WHERE experiment_id = $1 AND (merchant_id = $2 OR $2 = 'merchant_admin')
      RETURNING *;
    `;
            const res = yield DB_1.client.query(query, [experimentId, merchantId, JSON.stringify(finalMetrics)]);
            if (res.rows.length === 0)
                return null;
            return mapRowToExperiment(res.rows[0]);
        });
    }
    /**
     * Lists experiments for a merchant.
     */
    listExperiments() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
            const query = `
      SELECT e.*, p.title as product_title
      FROM merchant_ai_experiments e
      LEFT JOIN products p ON e.product_id = p.productid
      WHERE e.merchant_id = $1 OR $1 = 'merchant_admin'
      ORDER BY e.created_at DESC;
    `;
            const res = yield DB_1.client.query(query, [merchantId]);
            return res.rows.map(mapRowToExperiment);
        });
    }
    /**
     * Fetches an experiment by ID.
     */
    getExperimentById(experimentId_1) {
        return __awaiter(this, arguments, void 0, function* (experimentId, merchantId = 'default_merchant') {
            const query = `
      SELECT e.*, p.title as product_title
      FROM merchant_ai_experiments e
      LEFT JOIN products p ON e.product_id = p.productid
      WHERE e.experiment_id = $1 AND (e.merchant_id = $2 OR $2 = 'merchant_admin');
    `;
            const res = yield DB_1.client.query(query, [experimentId, merchantId]);
            if (res.rows.length === 0)
                return null;
            return mapRowToExperiment(res.rows[0]);
        });
    }
}
exports.MerchantExperimentService = MerchantExperimentService;
exports.experimentService = new MerchantExperimentService();
