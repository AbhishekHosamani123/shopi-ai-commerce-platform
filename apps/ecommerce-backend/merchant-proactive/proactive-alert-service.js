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
exports.generateAlertFingerprint = generateAlertFingerprint;
exports.createOrUpdateAlert = createOrUpdateAlert;
exports.getAlertSummary = getAlertSummary;
exports.listAlerts = listAlerts;
exports.acknowledgeAlert = acknowledgeAlert;
exports.dismissAlert = dismissAlert;
const DB_1 = require("../data/DB");
const merchant_actions_1 = require("../merchant-actions");
function mapRowToAlert(r) {
    return {
        alertId: r.alert_id,
        merchantId: r.merchant_id,
        alertType: r.alert_type,
        severity: r.severity,
        title: r.title,
        summary: r.summary,
        evidence: typeof r.evidence === 'string' ? JSON.parse(r.evidence) : r.evidence || {},
        fingerprint: r.fingerprint,
        relatedProductId: r.related_product_id ? parseInt(r.related_product_id, 10) : null,
        relatedCategory: r.related_category,
        recommendedAction: r.recommended_action,
        actionId: r.action_id,
        status: r.status,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        acknowledgedAt: r.acknowledged_at,
        resolvedAt: r.resolved_at
    };
}
/**
 * Generates deterministic alert fingerprint to prevent spamming duplicate alerts.
 */
function generateAlertFingerprint(merchantId, alertType, productId, category) {
    const dateWindow = new Date().toISOString().slice(0, 10); // 1-day deduplication window
    const key = `${merchantId}:${alertType}:${productId || 'none'}:${category || 'none'}:${dateWindow}`;
    return Buffer.from(key).toString('base64').replace(/=/g, '');
}
/**
 * Upserts a detected business event with deduplication and action linking.
 */
function createOrUpdateAlert(event_1) {
    return __awaiter(this, arguments, void 0, function* (event, merchantId = 'default_merchant') {
        const fingerprint = generateAlertFingerprint(merchantId, event.alertType, event.relatedProductId, event.relatedCategory);
        // 1. Check for existing alert with same fingerprint
        const existingRes = yield DB_1.client.query(`SELECT * FROM merchant_ai_alerts WHERE merchant_id = $1 AND fingerprint = $2 AND status NOT IN ('RESOLVED', 'EXPIRED') LIMIT 1`, [merchantId, fingerprint]);
        if (existingRes.rows.length > 0) {
            // Update existing alert with fresh evidence
            const existing = existingRes.rows[0];
            const updateRes = yield DB_1.client.query(`UPDATE merchant_ai_alerts 
       SET summary = $1, evidence = $2, recommended_action = $3
       WHERE alert_id = $4
       RETURNING *`, [event.summary, JSON.stringify(event.evidence), event.recommendedAction, existing.alert_id]);
            return { alert: mapRowToAlert(updateRes.rows[0]), isNew: false };
        }
        // 2. If this is a critical inventory risk or dead stock, link a Phase 3B action recommendation!
        let actionId = event.actionId || null;
        if (!actionId && event.relatedProductId) {
            if (event.alertType === 'STOCKOUT_IMMINENT' || event.alertType === 'LOW_STOCK_WARNING') {
                try {
                    const unitsToReorder = event.evidence.recommendedReorder || 50;
                    const actionRecord = yield (0, merchant_actions_1.createAction)({
                        merchantId,
                        actionType: 'RESTOCK',
                        productId: event.relatedProductId,
                        quantity: unitsToReorder,
                        reason: event.summary,
                        payload: {
                            stockAtRecommendation: event.evidence.currentStock,
                            dailyVelocity7d: event.evidence.dailyVelocity || 2.5,
                            estimatedCoverageDays: event.evidence.daysRemaining || 7,
                            reorderTargetUnits: unitsToReorder,
                            urgency: event.severity
                        },
                        expiresInMinutes: 60
                    });
                    actionId = actionRecord.actionId;
                }
                catch (err) {
                    console.error('Failed to link restock action to alert:', err);
                }
            }
            else if (event.alertType === 'DEAD_STOCK_ACCUMULATION') {
                try {
                    const actionRecord = yield (0, merchant_actions_1.createAction)({
                        merchantId,
                        actionType: 'DISCOUNT',
                        productId: event.relatedProductId,
                        reason: event.summary,
                        payload: {
                            originalPrice: event.evidence.price || 999,
                            recommendedDiscountPct: 10,
                            stockAtRecommendation: event.evidence.currentStock
                        },
                        expiresInMinutes: 60
                    });
                    actionId = actionRecord.actionId;
                }
                catch (err) {
                    console.error('Failed to link discount action to alert:', err);
                }
            }
        }
        // 3. Insert new alert
        const alertId = `alt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const expiresInHours = event.expiresInHours || 24;
        const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString();
        const insertQuery = `
    INSERT INTO merchant_ai_alerts (
      alert_id, merchant_id, alert_type, severity, title, summary, evidence,
      fingerprint, related_product_id, related_category, recommended_action,
      action_id, status, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'NEW', $13)
    RETURNING *;
  `;
        const insertRes = yield DB_1.client.query(insertQuery, [
            alertId,
            merchantId,
            event.alertType,
            event.severity,
            event.title,
            event.summary,
            JSON.stringify(event.evidence),
            fingerprint,
            event.relatedProductId || null,
            event.relatedCategory || null,
            event.recommendedAction || null,
            actionId,
            expiresAt
        ]);
        return { alert: mapRowToAlert(insertRes.rows[0]), isNew: true };
    });
}
/**
 * Returns proactive alert counts by severity and status.
 */
function getAlertSummary() {
    return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
        const query = `
    SELECT 
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE severity = 'CRITICAL' AND status NOT IN ('RESOLVED', 'EXPIRED'))::int as critical_count,
      COUNT(*) FILTER (WHERE severity = 'WARNING' AND status NOT IN ('RESOLVED', 'EXPIRED'))::int as warning_count,
      COUNT(*) FILTER (WHERE severity = 'OPPORTUNITY' AND status NOT IN ('RESOLVED', 'EXPIRED'))::int as opportunity_count,
      COUNT(*) FILTER (WHERE severity = 'INFO' AND status NOT IN ('RESOLVED', 'EXPIRED'))::int as info_count,
      COUNT(*) FILTER (WHERE status = 'NEW')::int as new_count,
      COUNT(*) FILTER (WHERE status = 'ACKNOWLEDGED')::int as acknowledged_count
    FROM merchant_ai_alerts
    WHERE merchant_id = $1 OR $1 = 'merchant_admin';
  `;
        const res = yield DB_1.client.query(query, [merchantId]);
        const row = res.rows[0];
        return {
            totalAlerts: parseInt(row.total || '0', 10),
            criticalCount: parseInt(row.critical_count || '0', 10),
            warningCount: parseInt(row.warning_count || '0', 10),
            opportunityCount: parseInt(row.opportunity_count || '0', 10),
            infoCount: parseInt(row.info_count || '0', 10),
            newCount: parseInt(row.new_count || '0', 10),
            acknowledgedCount: parseInt(row.acknowledged_count || '0', 10)
        };
    });
}
/**
 * Lists alerts with filtering by severity, status, and tenant.
 */
function listAlerts() {
    return __awaiter(this, arguments, void 0, function* (options = {}) {
        const merchantId = options.merchantId || 'default_merchant';
        const limit = Math.min(Math.max(options.limit || 50, 1), 100);
        const whereClauses = [];
        const params = [];
        if (merchantId !== 'merchant_admin') {
            params.push(merchantId);
            whereClauses.push(`merchant_id = $${params.length}`);
        }
        if (options.status && options.status !== 'ALL') {
            params.push(options.status.toUpperCase());
            whereClauses.push(`status = $${params.length}`);
        }
        if (options.severity && options.severity !== 'ALL') {
            params.push(options.severity.toUpperCase());
            whereClauses.push(`severity = $${params.length}`);
        }
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        params.push(limit);
        const limitParam = params.length;
        const query = `
    SELECT * FROM merchant_ai_alerts
    ${whereSql}
    ORDER BY 
      CASE severity 
        WHEN 'CRITICAL' THEN 1 
        WHEN 'WARNING' THEN 2 
        WHEN 'OPPORTUNITY' THEN 3 
        ELSE 4 
      END,
      created_at DESC
    LIMIT $${limitParam};
  `;
        const [listRes, summary] = yield Promise.all([
            DB_1.client.query(query, params),
            getAlertSummary(merchantId)
        ]);
        return {
            alerts: listRes.rows.map(mapRowToAlert),
            summary
        };
    });
}
/**
 * Acknowledges an alert.
 */
function acknowledgeAlert(alertId_1) {
    return __awaiter(this, arguments, void 0, function* (alertId, merchantId = 'default_merchant') {
        const res = yield DB_1.client.query(`UPDATE merchant_ai_alerts 
     SET status = 'ACKNOWLEDGED', acknowledged_at = CURRENT_TIMESTAMP
     WHERE alert_id = $1 AND (merchant_id = $2 OR $2 = 'merchant_admin')
     RETURNING *`, [alertId, merchantId]);
        if (res.rows.length === 0)
            return null;
        return mapRowToAlert(res.rows[0]);
    });
}
/**
 * Dismisses / Resolves an alert.
 */
function dismissAlert(alertId_1) {
    return __awaiter(this, arguments, void 0, function* (alertId, merchantId = 'default_merchant') {
        const res = yield DB_1.client.query(`UPDATE merchant_ai_alerts 
     SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP
     WHERE alert_id = $1 AND (merchant_id = $2 OR $2 = 'merchant_admin')
     RETURNING *`, [alertId, merchantId]);
        if (res.rows.length === 0)
            return null;
        return mapRowToAlert(res.rows[0]);
    });
}
