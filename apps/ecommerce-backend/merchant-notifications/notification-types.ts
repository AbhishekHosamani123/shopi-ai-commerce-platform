/**
 * ⚡ Merchant AI Multi-Channel Notification Types (Phase 3C)
 */

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'WEBHOOK';

export interface NotificationPayload {
  merchantId: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
  data?: Record<string, any>;
  recipientEmail?: string;
  webhookUrl?: string;
}

export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  delivered: boolean;
  timestamp: string;
  message: string;
  error?: string;
}
