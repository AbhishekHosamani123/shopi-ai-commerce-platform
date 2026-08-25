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
exports.notificationCenterService = exports.NotificationCenterService = void 0;
const DB_1 = require("../data/DB");
class NotificationCenterService {
    /**
     * Lists system notifications with multi-status filtering and tenant isolation
     */
    listNotifications() {
        return __awaiter(this, arguments, void 0, function* (options = {}, merchantId = 'default_merchant') {
            var _a;
            const statusFilter = options.status && options.status !== 'ALL' ? options.status : null;
            const categoryFilter = options.category && options.category !== 'ALL' ? options.category : null;
            const severityFilter = options.severity && options.severity !== 'ALL' ? options.severity : null;
            const limit = options.limit || 30;
            let query = `
      SELECT 
        notification_id,
        merchant_id,
        severity,
        category,
        title,
        reason,
        evidence,
        recommended_action,
        action_id,
        status,
        created_at,
        read_at,
        dismissed_at,
        actioned_at
      FROM merchant_system_notifications
      WHERE (merchant_id = $1 OR merchant_id = 'default_merchant' OR merchant_id = 'merchant_admin')
    `;
            const params = [merchantId];
            let pIdx = 2;
            if (statusFilter) {
                query += ` AND status = $${pIdx++}`;
                params.push(statusFilter);
            }
            if (categoryFilter) {
                query += ` AND category = $${pIdx++}`;
                params.push(categoryFilter);
            }
            if (severityFilter) {
                query += ` AND severity = $${pIdx++}`;
                params.push(severityFilter);
            }
            query += ` ORDER BY created_at DESC LIMIT $${pIdx}`;
            params.push(limit);
            const res = yield DB_1.client.query(query, params);
            const unreadRes = yield DB_1.client.query(`
      SELECT COUNT(*)::int as unread_count
      FROM merchant_system_notifications
      WHERE (merchant_id = $1 OR merchant_id = 'default_merchant' OR merchant_id = 'merchant_admin')
        AND status = 'UNREAD';
    `, [merchantId]);
            const unreadCount = ((_a = unreadRes.rows[0]) === null || _a === void 0 ? void 0 : _a.unread_count) || 0;
            const notifications = res.rows.map(r => ({
                notificationId: r.notification_id,
                merchantId: r.merchant_id,
                severity: r.severity,
                category: r.category,
                title: r.title,
                reason: r.reason,
                evidence: r.evidence,
                recommendedAction: r.recommended_action,
                actionId: r.action_id,
                status: r.status,
                createdAt: r.created_at,
                readAt: r.read_at,
                dismissedAt: r.dismissed_at,
                actionedAt: r.actioned_at
            }));
            return {
                total: notifications.length,
                unreadCount,
                notifications
            };
        });
    }
    /**
     * Marks a notification as READ
     */
    markAsRead(notificationId_1) {
        return __awaiter(this, arguments, void 0, function* (notificationId, merchantId = 'default_merchant') {
            const res = yield DB_1.client.query(`
      UPDATE merchant_system_notifications
      SET status = 'READ', read_at = CURRENT_TIMESTAMP
      WHERE notification_id = $1 AND (merchant_id = $2 OR merchant_id = 'default_merchant' OR merchant_id = 'merchant_admin')
      RETURNING notification_id;
    `, [notificationId, merchantId]);
            return res.rows.length > 0;
        });
    }
    /**
     * Dismisses a notification
     */
    dismissNotification(notificationId_1) {
        return __awaiter(this, arguments, void 0, function* (notificationId, merchantId = 'default_merchant') {
            const res = yield DB_1.client.query(`
      UPDATE merchant_system_notifications
      SET status = 'DISMISSED', dismissed_at = CURRENT_TIMESTAMP
      WHERE notification_id = $1 AND (merchant_id = $2 OR merchant_id = 'default_merchant' OR merchant_id = 'merchant_admin')
      RETURNING notification_id;
    `, [notificationId, merchantId]);
            return res.rows.length > 0;
        });
    }
    /**
     * Actions a notification (e.g. approved linked action)
     */
    actionNotification(notificationId_1, actionId_1) {
        return __awaiter(this, arguments, void 0, function* (notificationId, actionId, merchantId = 'default_merchant') {
            const res = yield DB_1.client.query(`
      UPDATE merchant_system_notifications
      SET status = 'ACTIONED', actioned_at = CURRENT_TIMESTAMP, action_id = COALESCE($2, action_id)
      WHERE notification_id = $1 AND (merchant_id = $3 OR merchant_id = 'default_merchant' OR merchant_id = 'merchant_admin')
      RETURNING notification_id;
    `, [notificationId, actionId || null, merchantId]);
            return res.rows.length > 0;
        });
    }
    /**
     * Creates a new system notification
     */
    createNotification(notif_1) {
        return __awaiter(this, arguments, void 0, function* (notif, merchantId = 'default_merchant') {
            const notifId = notif.notificationId || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const res = yield DB_1.client.query(`
      INSERT INTO merchant_system_notifications (
        notification_id,
        merchant_id,
        severity,
        category,
        title,
        reason,
        evidence,
        recommended_action,
        action_id,
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'UNREAD', CURRENT_TIMESTAMP)
      ON CONFLICT (notification_id) DO NOTHING
      RETURNING *;
    `, [
                notifId,
                merchantId,
                notif.severity,
                notif.category,
                notif.title,
                notif.reason,
                notif.evidence,
                notif.recommendedAction,
                notif.actionId || null
            ]);
            const r = res.rows[0] || {
                notification_id: notifId,
                merchant_id: merchantId,
                severity: notif.severity,
                category: notif.category,
                title: notif.title,
                reason: notif.reason,
                evidence: notif.evidence,
                recommended_action: notif.recommendedAction,
                action_id: notif.actionId || null,
                status: 'UNREAD',
                created_at: new Date().toISOString()
            };
            return {
                notificationId: r.notification_id,
                merchantId: r.merchant_id,
                severity: r.severity,
                category: r.category,
                title: r.title,
                reason: r.reason,
                evidence: r.evidence,
                recommendedAction: r.recommended_action,
                actionId: r.action_id,
                status: r.status,
                createdAt: r.created_at
            };
        });
    }
}
exports.NotificationCenterService = NotificationCenterService;
exports.notificationCenterService = new NotificationCenterService();
