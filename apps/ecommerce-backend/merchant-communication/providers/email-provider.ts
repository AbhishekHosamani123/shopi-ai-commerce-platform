import { CommunicationProvider } from './provider-interface';
import {
  OutboundMessagePayload,
  ProviderSendResult,
  MessageExecutionStatus,
  WebhookProcessingResult
} from '../communication-types';
import { SMTP } from '../../data/SMTP';

export class ProductionEmailProvider implements CommunicationProvider {
  readonly name = 'PRODUCTION_EMAIL_SMTP';
  readonly channel = 'EMAIL';
  readonly isProductionReady = true;

  async send(message: OutboundMessagePayload): Promise<ProviderSendResult> {
    const timestamp = new Date().toISOString();

    // 1. Environmental safety guard: fail closed unless explicit PRODUCTION mode
    const commMode = process.env.COMMUNICATION_MODE || 'DRY_RUN';
    if (commMode !== 'PRODUCTION') {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: `Production email dispatch is blocked in current "${commMode}" mode. Must configure COMMUNICATION_MODE=PRODUCTION.`,
        failureCategory: 'PROVIDER_ERROR'
      };
    }

    // 2. Credential verification (fail closed on missing credentials)
    const hasConfig = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && !process.env.SMTP_PASS.includes('mock');
    if (!hasConfig) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: 'Email provider credentials are not configured on server (SMTP_HOST / SMTP_USER / SMTP_PASS).',
        failureCategory: 'PROVIDER_NOT_CONFIGURED'
      };
    }

    // 3. Recipient Validation
    if (!this.validateRecipient(message.recipient)) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: `Invalid email recipient address: "${message.recipient}"`,
        failureCategory: 'INVALID_RECIPIENT'
      };
    }

    // 4. Dispatch email via configured Nodemailer transport
    try {
      const info = await SMTP.sendMail({
        from: message.sender || process.env.SMTP_FROM || '"Shopi Store" <no-reply@store.local>',
        to: message.recipient,
        replyTo: message.replyTo,
        subject: message.subject || 'Special update from your favorite store',
        text: message.textBody,
        html: message.htmlBody || `<p>${message.textBody}</p>`,
        headers: {
          'X-Campaign-ID': message.campaignId,
          'X-Customer-ID': String(message.customerId),
          'X-Merchant-ID': message.merchantId,
          'X-Idempotency-Key': message.idempotencyKey
        }
      });

      return {
        success: true,
        provider: this.name,
        providerMessageId: info.messageId || `msg_${Date.now()}`,
        status: 'SENT',
        timestamp
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: `SMTP delivery error: ${err.message}`,
        failureCategory: 'PROVIDER_ERROR'
      };
    }
  }

  async getStatus(providerMessageId: string): Promise<MessageExecutionStatus> {
    return 'SENT';
  }

  validateRecipient(recipient: string): boolean {
    if (!recipient) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.trim());
  }

  async handleWebhook(event: any): Promise<WebhookProcessingResult> {
    const timestamp = new Date().toISOString();
    return {
      success: true,
      messageId: event?.messageId,
      newStatus: event?.event === 'delivered' ? 'DELIVERED' : event?.event === 'open' ? 'OPENED' : 'SENT',
      eventType: event?.event,
      timestamp
    };
  }
}
