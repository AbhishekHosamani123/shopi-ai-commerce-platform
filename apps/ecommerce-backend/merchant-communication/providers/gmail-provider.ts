import nodemailer from 'nodemailer';
import dns from 'dns';
import { CommunicationProvider } from './provider-interface';
import {
  OutboundMessagePayload,
  ProviderSendResult,
  MessageExecutionStatus,
  WebhookProcessingResult
} from '../communication-types';

/**
 * Resolve smtp.gmail.com to an IPv4 address. Render free instances have no
 * IPv6 egress; nodemailer uses dns.resolve internally (the global
 * dns.setDefaultResultOrder('ipv4first') only affects dns.lookup), so the
 * connection would dial the IPv6 AAAA record and fail ENETUNREACH. Passing
 * an explicit IPv4 address in the transport host forces IPv4 dialing.
 */
let gmailSmtpHost: string | null = null;
async function getGmailSmtpHost(): Promise<string> {
  if (gmailSmtpHost) return gmailSmtpHost;
  try {
    const lookupRes = await dns.promises.lookup('smtp.gmail.com', { family: 4 });
    if (lookupRes && lookupRes.address) {
      gmailSmtpHost = lookupRes.address;
      console.log(`[SMTP] Resolved smtp.gmail.com → ${gmailSmtpHost} (IPv4 force)`);
      return gmailSmtpHost;
    }
  } catch (err: any) {
    console.warn(`[SMTP] IPv4 lookup failed, falling back to hostname: ${err.message}`);
  }
  return 'smtp.gmail.com'; // fallback
}

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
      // The transport host is resolved to an explicit IPv4 address because
      // nodemailer uses dns.resolve internally — the global
      // dns.setDefaultResultOrder('ipv4first') only affects dns.lookup.
      // Port strategy: BOTH Gmail ports are intermittent from Render's
      // shared egress (587 STARTTLS timed out in prod; 465 implicit TLS
      // timed out in an earlier prod incident). sendMail tries 587 first
      // and, on connect failure, retries the same message over 465 — two
      // independent egress routes, three attempts each (mirrors the
      // order-confirmation email).
      // 1. Primary Render Bypass: Dispatch via Vercel HTTPS Email Relay (Port 443)
      const storefrontUrl = (process.env.STOREFRONT_BASE_URL || process.env.FRONTEND_SERVER_ORIGIN || 'https://shopi-ai-commerce-platform-shop-two.vercel.app').split(',')[0].trim().replace(/\/+$/, '');
      if (storefrontUrl.startsWith('http')) {
        try {
          console.log(`[GmailProvider] Attempting HTTPS email relay via ${storefrontUrl}/api/send-email...`);
          const relayAttachments = message.inlineAttachments && message.inlineAttachments.length > 0
            ? message.inlineAttachments.map(att => ({
                filename: att.filename,
                content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content,
                contentType: att.contentType,
                cid: att.cid
              }))
            : undefined;

          const relayRes = await fetch(`${storefrontUrl}/api/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-secret': process.env.API_SECRET || 'razorpay_ai_commerce_shared_secret_2026'
            },
            body: JSON.stringify({
              to: message.recipient,
              subject: message.subject || 'Special offer from your favorite store',
              text: message.textBody,
              html: message.htmlBody || `<p>${message.textBody}</p>`,
              fromName: process.env.SMTP_SENDERNAME || 'Razorpay AI Commerce',
              replyTo: message.replyTo || email,
              attachments: relayAttachments
            }),
            signal: AbortSignal.timeout(15000)
          });
          const relayBody: any = await relayRes.json().catch(() => ({}));
          if (relayRes.ok && relayBody.success && relayBody.messageId) {
            console.log(`[GmailProvider] Campaign email sent via HTTPS Relay to ${message.recipient} (${relayBody.messageId})`);
            return {
              success: true,
              provider: this.name,
              providerMessageId: relayBody.messageId,
              status: 'SENT',
              timestamp
            };
          }
          console.warn(`[GmailProvider] HTTPS relay returned non-ok:`, relayBody?.error || relayRes.status);
        } catch (relayErr: any) {
          console.warn(`[GmailProvider] HTTPS relay attempt failed: ${relayErr.message}`);
        }
      }

      // 2. Direct SMTP Transport (Local Dev / Unblocked egress)
      const smtpHost = await getGmailSmtpHost();
      const baseTransport = {
        host: smtpHost,
        auth: {
          user: email,
          pass: password
        },
        tls: {
          servername: 'smtp.gmail.com',
          rejectUnauthorized: true
        },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000
      };
      const portSequence: Array<{ port: number; secure: boolean }> = [
        { port: 587, secure: false }, // MSA + STARTTLS
        { port: 465, secure: true }   // implicit TLS
      ];

      const senderName = process.env.SMTP_SENDERNAME || 'Razorpay AI Commerce';
      const senderAddress = `"${senderName}" <${email}>`;

      const buildMail = () => ({
        from: senderAddress,
        to: message.recipient,
        replyTo: message.replyTo || email,
        subject: message.subject || 'Special offer from your favorite store',
        text: message.textBody,
        html: message.htmlBody || `<p>${message.textBody}</p>`,
        ...(message.inlineAttachments && message.inlineAttachments.length > 0
          ? {
              attachments: message.inlineAttachments.map((att) => ({
                filename: att.filename,
                content: att.content,
                contentType: att.contentType,
                cid: att.cid,
                contentDisposition: 'inline'
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
      outer: for (const { port, secure } of portSequence) {
        const transporter = nodemailer.createTransport({ ...baseTransport, port, secure });
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            info = await transporter.sendMail(buildMail() as any);
            break outer;
          } catch (e: any) {
            lastErr = e;
            if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
          }
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
