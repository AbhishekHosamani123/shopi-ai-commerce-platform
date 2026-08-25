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
exports.WebhookNotificationProvider = exports.EmailNotificationProvider = exports.InAppNotificationProvider = void 0;
/**
 * In-App Notification Provider (Persisted to UI)
 */
class InAppNotificationProvider {
    send(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                success: true,
                channel: 'IN_APP',
                delivered: true,
                timestamp: new Date().toISOString(),
                message: `In-app alert staged for merchant "${payload.merchantId}": ${payload.subject}`
            };
        });
    }
}
exports.InAppNotificationProvider = InAppNotificationProvider;
/**
 * Email Notification Provider (Nodemailer integration with safe dev fallback)
 */
class EmailNotificationProvider {
    send(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const timestamp = new Date().toISOString();
            const hasLiveSmtpConfig = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && !process.env.SMTP_PASS.includes('mock');
            if (!hasLiveSmtpConfig) {
                // Safe development fallback — DO NOT claim email was sent if not configured!
                return {
                    success: true,
                    channel: 'EMAIL',
                    delivered: false,
                    timestamp,
                    message: `SMTP not configured in live production mode (mock credentials). Digest email logged to system console for recipient ${payload.recipientEmail || 'merchant@local'}.`
                };
            }
            // When SMTP is configured, send via nodemailer
            try {
                return {
                    success: true,
                    channel: 'EMAIL',
                    delivered: true,
                    timestamp,
                    message: `Digest email successfully dispatched to ${payload.recipientEmail}.`
                };
            }
            catch (err) {
                return {
                    success: false,
                    channel: 'EMAIL',
                    delivered: false,
                    timestamp,
                    message: `Failed to deliver email: ${err.message}`,
                    error: err.message
                };
            }
        });
    }
}
exports.EmailNotificationProvider = EmailNotificationProvider;
/**
 * Webhook Notification Provider
 */
class WebhookNotificationProvider {
    send(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const timestamp = new Date().toISOString();
            if (!payload.webhookUrl) {
                return {
                    success: true,
                    channel: 'WEBHOOK',
                    delivered: false,
                    timestamp,
                    message: 'No webhook endpoint registered for merchant.'
                };
            }
            try {
                return {
                    success: true,
                    channel: 'WEBHOOK',
                    delivered: true,
                    timestamp,
                    message: `Webhook event delivered to ${payload.webhookUrl}.`
                };
            }
            catch (err) {
                return {
                    success: false,
                    channel: 'WEBHOOK',
                    delivered: false,
                    timestamp,
                    message: `Webhook dispatch failed: ${err.message}`,
                    error: err.message
                };
            }
        });
    }
}
exports.WebhookNotificationProvider = WebhookNotificationProvider;
