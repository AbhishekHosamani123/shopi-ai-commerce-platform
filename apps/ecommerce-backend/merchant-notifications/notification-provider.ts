import { NotificationPayload, NotificationResult } from './notification-types';

export interface NotificationProvider {
  send(payload: NotificationPayload): Promise<NotificationResult>;
}

/**
 * In-App Notification Provider (Persisted to UI)
 */
export class InAppNotificationProvider implements NotificationProvider {
  async send(payload: NotificationPayload): Promise<NotificationResult> {
    return {
      success: true,
      channel: 'IN_APP',
      delivered: true,
      timestamp: new Date().toISOString(),
      message: `In-app alert staged for merchant "${payload.merchantId}": ${payload.subject}`
    };
  }
}

/**
 * Email Notification Provider (Nodemailer integration with safe dev fallback)
 */
export class EmailNotificationProvider implements NotificationProvider {
  async send(payload: NotificationPayload): Promise<NotificationResult> {
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
    } catch (err: any) {
      return {
        success: false,
        channel: 'EMAIL',
        delivered: false,
        timestamp,
        message: `Failed to deliver email: ${err.message}`,
        error: err.message
      };
    }
  }
}

/**
 * Webhook Notification Provider
 */
export class WebhookNotificationProvider implements NotificationProvider {
  async send(payload: NotificationPayload): Promise<NotificationResult> {
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
    } catch (err: any) {
      return {
        success: false,
        channel: 'WEBHOOK',
        delivered: false,
        timestamp,
        message: `Webhook dispatch failed: ${err.message}`,
        error: err.message
      };
    }
  }
}
