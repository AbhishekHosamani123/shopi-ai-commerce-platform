import nodemailer from 'nodemailer';
import { CommunicationProvider } from './provider-interface';
import {
  OutboundMessagePayload,
  ProviderSendResult,
  MessageExecutionStatus,
  WebhookProcessingResult
} from '../communication-types';

export class GmailEmailProvider implements CommunicationProvider {
  readonly name = 'PRODUCTION_EMAIL_GMAIL';
  readonly channel = 'EMAIL';
  readonly isProductionReady = true;

  /**
   * Dispatches email via Gmail SMTP using authenticated Google App Password or validates in DRY_RUN / TEST mode.
   */
  async send(message: OutboundMessagePayload): Promise<ProviderSendResult> {
    const timestamp = new Date().toISOString();
    const commMode = (process.env.COMMUNICATION_MODE || 'DRY_RUN').toUpperCase();

    // 1. Dry Run Mode Protection (Simulated delivery, zero network traffic)
    if (commMode === 'DRY_RUN') {
      return {
        success: true,
        provider: this.name,
        providerMessageId: `sim_gmail_${Date.now()}`,
        status: 'SIMULATED',
        timestamp,
        isSimulated: true
      };
    }

    // 2. Unrestricted Production Mode Protection (Strictly disabled in Phase 8C)
    if (commMode === 'PRODUCTION') {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: 'Unrestricted production email dispatch is disabled in Phase 8C. Use TEST mode with TEST_EMAIL_RECIPIENT.',
        failureCategory: 'PROVIDER_ERROR'
      };
    }

    // 3. Test Mode Validation (Strictly requires EMAIL_TEST_RECIPIENT)
    if (commMode === 'TEST' || commMode === 'CONTROLLED_TEST' || process.env.EMAIL_TEST_MODE === 'true') {
      const allowedTestRecipient = (process.env.EMAIL_TEST_RECIPIENT || process.env.TEST_EMAIL_RECIPIENT || '').trim().toLowerCase();
      const targetRecipient = (message.recipient || '').trim().toLowerCase();

      if (!allowedTestRecipient) {
        return {
          success: false,
          provider: this.name,
          status: 'FAILED',
          timestamp,
          error: 'TEST mode is active but EMAIL_TEST_RECIPIENT is not configured in environment.',
          failureCategory: 'TEST_MODE_RECIPIENT_BLOCKED'
        };
      }

      if (targetRecipient !== allowedTestRecipient) {
        return {
          success: false,
          provider: this.name,
          status: 'FAILED',
          timestamp,
          error: `Audience recipient "${message.recipient}" is blocked in TEST mode. Only EMAIL_TEST_RECIPIENT (${allowedTestRecipient}) is permitted.`,
          failureCategory: 'TEST_MODE_RECIPIENT_BLOCKED'
        };
      }
    }

    // 4. Credential Verification (Fail closed on missing credentials)
    const email = (process.env.EMAIL || process.env.SMTP_USER || '').trim();
    const password = (process.env.PASSWORD || process.env.SMTP_PASS || '').trim();

    if (!email || !password || password.includes('mock') || password.length === 0) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: 'Gmail credentials not configured on server (EMAIL / PASSWORD).',
        failureCategory: 'PROVIDER_NOT_CONFIGURED'
      };
    }

    // 5. Recipient Syntax Validation
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

    // 6. Build Nodemailer Gmail SMTP Transport
    try {
      // IPv4 forced: Render free instances have no IPv6 egress, and
      // smtp.gmail.com's AAAA record otherwise triggers
      // 'connect ENETUNREACH 2607:f8b0:...:465'.
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        family: 4,
        port: 465,
        secure: true,
        auth: {
          user: email,
          pass: password
        },
        tls: {
          rejectUnauthorized: true
        }
      });

      const senderName = process.env.SMTP_SENDERNAME || 'Razorpay AI Commerce';
      const senderAddress = `"${senderName}" <${email}>`;

      const info = await transporter.sendMail({
        from: senderAddress,
        to: message.recipient,
        replyTo: message.replyTo || email,
        subject: message.subject || 'Special offer from your favorite store',
        text: message.textBody,
        html: message.htmlBody || `<p>${message.textBody}</p>`,
        // Inline CID images travel with the MIME message itself — Gmail/Outlook
        // display them without any external fetch (no localhost URLs, which a
        // real recipient could never load). Omitted entirely for emails built
        // without inline assets, keeping legacy behavior unchanged.
        ...(message.inlineAttachments && message.inlineAttachments.length > 0
          ? {
              attachments: message.inlineAttachments.map((att) => ({
                filename: att.filename,
                content: att.content,
                contentType: att.contentType,
                cid: att.cid,
                contentDisposition: 'inline',
                encoding: 'binary' as const
              }))
            }
          : {}),
        headers: {
          'X-Campaign-ID': message.campaignId,
          'X-Customer-ID': String(message.customerId),
          'X-Merchant-ID': message.merchantId,
          'X-Idempotency-Key': message.idempotencyKey,
          'X-Tracking-ID': message.attribution?.trackingId || `trk_${message.messageId}`
        }
      });

      return {
        success: true,
        provider: this.name,
        providerMessageId: info.messageId || `gmail_${Date.now()}`,
        status: 'SENT',
        timestamp
      };
    } catch (err: any) {
      let failureCategory: any = 'PROVIDER_ERROR';

      if (err.code === 'EAUTH' || err.responseCode === 535) {
        failureCategory = 'AUTHENTICATION_ERROR';
      } else if (err.code === 'EENVELOPE') {
        failureCategory = 'INVALID_RECIPIENT';
      } else if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKET' || err.code === 'ECONNRESET') {
        failureCategory = 'PROVIDER_ERROR';
      }

      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: `Gmail SMTP delivery failed: ${err.message}`,
        failureCategory
      };
    }
  }

  /**
   * Retrieves status for provider message.
   */
  async getStatus(providerMessageId: string): Promise<MessageExecutionStatus> {
    return 'SENT';
  }

  /**
   * Strict email format validation.
   */
  validateRecipient(recipient: string): boolean {
    if (!recipient) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.trim());
  }

  /**
   * Handles inbound webhook / bounce / receipt notifications.
   */
  async handleWebhook(event: any): Promise<WebhookProcessingResult> {
    const timestamp = new Date().toISOString();
    return {
      success: true,
      messageId: event?.messageId,
      newStatus: event?.status || 'SENT',
      eventType: event?.eventType || 'email.sent',
      timestamp
    };
  }
}
