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
exports.notificationDispatcher = exports.NotificationDispatcherService = void 0;
const notification_provider_1 = require("./notification-provider");
class NotificationDispatcherService {
    constructor() {
        this.providers = new Map();
        this.providers.set('IN_APP', new notification_provider_1.InAppNotificationProvider());
        this.providers.set('EMAIL', new notification_provider_1.EmailNotificationProvider());
        this.providers.set('WEBHOOK', new notification_provider_1.WebhookNotificationProvider());
    }
    /**
     * Dispatches a notification across specified channels
     */
    dispatch(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const provider = this.providers.get(payload.channel) || this.providers.get('IN_APP');
            return yield provider.send(payload);
        });
    }
    /**
     * Broadcasts a digest across all configured channels
     */
    broadcastDigest(merchantId, digestTitle, digestSummary, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = [];
            // 1. In-App Notification
            results.push(yield this.dispatch({
                merchantId,
                channel: 'IN_APP',
                subject: digestTitle,
                body: digestSummary,
                data
            }));
            // 2. Email Notification (Safe dev fallback)
            results.push(yield this.dispatch({
                merchantId,
                channel: 'EMAIL',
                subject: digestTitle,
                body: digestSummary,
                recipientEmail: `${merchantId}@store.local`,
                data
            }));
            return results;
        });
    }
}
exports.NotificationDispatcherService = NotificationDispatcherService;
exports.notificationDispatcher = new NotificationDispatcherService();
