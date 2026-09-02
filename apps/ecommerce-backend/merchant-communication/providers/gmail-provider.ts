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
   * Dispatches email via Gmail SMTP to `message.recipient`.
   *
   * DRY_RUN simulation is owned by DryRunCommunicationProvider — if this
   * provider is selected, a real send is intended. Never rewrite the
   * recipient to EMAIL_TEST_RECIPIENT and never report a simulated success
   * as a real delivery.
   */
  async send(message: OutboundMessagePayload): Promise<ProviderSendResult> {
    const timestamp = new Date().toISOString();

    // Credential Verification (Fail closed on missing credentials)
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
      // IPv4-first dialing is enforced globally at startup (Render free
      // instances have no IPv6 egress). Port 587 + STARTTLS: the implicit-TLS
      // 465 route timed out from Render's egress; 587 is the Gmail MSA port.
      // The 587 dial is INTERMITTENT on Render's free egress, so sendMail is
      // retried with backoff (mirrors the order-confirmation email).
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        connectionTimeout: 20000,
        greetingTimeout: 20000,
        socketTimeout: 30000,
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

      const buildMail = () => ({
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

      let info: any = null;
      let lastErr: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          info = await transporter.sendMail(buildMail() as any);
          break;
        } catch (e: any) {
          lastErr = e;
          if (attempt < 3) await new Promise(r => setTimeout(r, 5000 * attempt));
        }
      }
      if (!info) throw lastErr;

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
