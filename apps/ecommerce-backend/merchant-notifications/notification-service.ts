import {
  NotificationPayload,
  NotificationResult,
  NotificationChannel
} from './notification-types';
import {
  InAppNotificationProvider,
  EmailNotificationProvider,
  WebhookNotificationProvider,
  NotificationProvider
} from './notification-provider';

export class NotificationDispatcherService {
  private providers: Map<NotificationChannel, NotificationProvider>;

  constructor() {
    this.providers = new Map();
    this.providers.set('IN_APP', new InAppNotificationProvider());
    this.providers.set('EMAIL', new EmailNotificationProvider());
    this.providers.set('WEBHOOK', new WebhookNotificationProvider());
  }

  /**
   * Dispatches a notification across specified channels
   */
  async dispatch(payload: NotificationPayload): Promise<NotificationResult> {
    const provider = this.providers.get(payload.channel) || this.providers.get('IN_APP')!;
    return await provider.send(payload);
  }

  /**
   * Broadcasts a digest across all configured channels
   */
  async broadcastDigest(
    merchantId: string,
    digestTitle: string,
    digestSummary: string,
    data?: Record<string, any>
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    // 1. In-App Notification
    results.push(
      await this.dispatch({
        merchantId,
        channel: 'IN_APP',
        subject: digestTitle,
        body: digestSummary,
        data
      })
    );

    // 2. Email Notification (Safe dev fallback)
    results.push(
      await this.dispatch({
        merchantId,
        channel: 'EMAIL',
        subject: digestTitle,
        body: digestSummary,
        recipientEmail: `${merchantId}@store.local`,
        data
      })
    );

    return results;
  }
}

export const notificationDispatcher = new NotificationDispatcherService();
