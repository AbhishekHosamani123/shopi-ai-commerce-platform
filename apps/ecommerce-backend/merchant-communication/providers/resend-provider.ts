import axios from 'axios';
import { CommunicationProvider } from './provider-interface';
import {
  OutboundMessagePayload,
  ProviderSendResult,
  MessageExecutionStatus,
  WebhookProcessingResult
} from '../communication-types';

export class ResendEmailProvider implements CommunicationProvider {
  readonly name = 'PRODUCTION_EMAIL_RESEND';
  readonly channel = 'EMAIL';
  readonly isProductionReady = true;

  /**
   * Dispatches email via Resend REST API or fails closed safely.
   */
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
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey.trim().length === 0 || apiKey.includes('mock') || apiKey.includes('placeholder')) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: 'Resend provider credentials are not configured on server (RESEND_API_KEY).',
        failureCategory: 'PROVIDER_NOT_CONFIGURED'
      };
    }

    // 3. Domain verification check
    const fromAddress = message.sender || process.env.EMAIL_FROM || process.env.RESEND_EMAIL_FROM;
    const isDomainVerified = process.env.RESEND_DOMAIN_VERIFIED !== 'false' && Boolean(fromAddress);

    if (!isDomainVerified || !fromAddress) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: 'Verified sending domain is not configured for Resend (EMAIL_FROM / RESEND_DOMAIN_VERIFIED).',
        failureCategory: 'EMAIL_DOMAIN_NOT_VERIFIED'
      };
    }

    // 4. Recipient Validation
    if (!this.validateRecipient(message.recipient)) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: `Invalid email recipient address syntax: "${message.recipient}"`,
        failureCategory: 'INVALID_RECIPIENT'
      };
    }

    // 5. Build Resend API Payload
    const payload = {
      from: fromAddress,
      to: [message.recipient],
      reply_to: message.replyTo,
      subject: message.subject || 'Update from your favorite store',
      html: message.htmlBody || `<p>${message.textBody}</p>`,
      text: message.textBody,
      tags: [
        { name: 'campaign_id', value: message.campaignId },
        { name: 'customer_id', value: String(message.customerId) },
        { name: 'merchant_id', value: message.merchantId },
        { name: 'idempotency_key', value: message.idempotencyKey }
      ],
      headers: {
        'X-Campaign-ID': message.campaignId,
        'X-Customer-ID': String(message.customerId),
        'X-Merchant-ID': message.merchantId,
        'X-Idempotency-Key': message.idempotencyKey,
        'X-Tracking-ID': message.attribution?.trackingId || `trk_${message.messageId}`
      }
    };

    // 6. Execute HTTPS request to Resend API
    try {
      const response = await axios.post('https://api.resend.com/emails', payload, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.status === 200 || response.status === 201) {
        return {
          success: true,
          provider: this.name,
          providerMessageId: response.data?.id || `resend_${Date.now()}`,
          status: 'SENT',
          timestamp
        };
      }

      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: `Resend API rejected dispatch with HTTP ${response.status}`,
        failureCategory: 'PROVIDER_ERROR'
      };
    } catch (err: any) {
      const status = err.response?.status;
      let failureCategory: any = 'PROVIDER_ERROR';

      if (status === 401 || status === 403) {
        failureCategory = 'AUTHENTICATION_ERROR';
      } else if (status === 429) {
        failureCategory = 'RATE_LIMITED';
      } else if (status === 422) {
        failureCategory = 'VALIDATION_ERROR';
      }

      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: `Resend dispatch failed: ${err.response?.data?.message || err.message}`,
        failureCategory
      };
    }
  }

  /**
   * Queries delivery status for a given Resend message identifier.
   */
  async getStatus(providerMessageId: string): Promise<MessageExecutionStatus> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return 'SENT';

    try {
      const res = await axios.get(`https://api.resend.com/emails/${providerMessageId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 5000
      });
      const lastEvent = res.data?.last_event;
      if (lastEvent === 'delivered') return 'DELIVERED';
      if (lastEvent === 'bounced') return 'BOUNCED';
      if (lastEvent === 'opened') return 'OPENED';
      if (lastEvent === 'clicked') return 'CLICKED';
      return 'SENT';
    } catch {
      return 'SENT';
    }
  }

  /**
   * Strict email format validation.
   */
  validateRecipient(recipient: string): boolean {
    if (!recipient) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.trim());
  }

  /**
   * Processes inbound Resend webhook events.
   */
  async handleWebhook(event: any): Promise<WebhookProcessingResult> {
    const timestamp = new Date().toISOString();
    const eventType = event?.type;
    const emailData = event?.data;
    const messageId = emailData?.email_id || emailData?.id;

    let newStatus: MessageExecutionStatus = 'SENT';
    if (eventType === 'email.delivered') newStatus = 'DELIVERED';
    else if (eventType === 'email.bounced') newStatus = 'BOUNCED';
    else if (eventType === 'email.opened') newStatus = 'OPENED';
    else if (eventType === 'email.clicked') newStatus = 'CLICKED';
    else if (eventType === 'email.failed' || eventType === 'email.complained') newStatus = 'FAILED';

    return {
      success: true,
      messageId,
      newStatus,
      eventType,
      timestamp
    };
  }
}
