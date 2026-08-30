import crypto from 'crypto';
import { client } from '../data/DB';
import { WebhookProcessingResult, MessageExecutionStatus } from './communication-types';

export class WebhookHandler {
  /**
   * Verifies HMAC-SHA256 signature for inbound webhooks.
   */
  verifySignature(payload: string | Buffer, signature: string, secret: string): boolean {
    if (!signature || !secret) return false;
    try {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload);
      const expected = hmac.digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  /**
   * Verifies Resend / Svix standard webhook signatures (svix-id, svix-timestamp, svix-signature).
   */
  verifyResendSvixSignature(
    payload: string | Buffer,
    headers: { svixId?: string; svixTimestamp?: string; svixSignature?: string },
    secret: string
  ): boolean {
    const { svixId, svixTimestamp, svixSignature } = headers;
    if (!svixId || !svixTimestamp || !svixSignature || !secret) return false;

    try {
      const payloadStr = typeof payload === 'string' ? payload : payload.toString('utf8');
      const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
      let secretBytes: Buffer;
      try {
        secretBytes = Buffer.from(cleanSecret, 'base64');
      } catch {
        secretBytes = Buffer.from(cleanSecret, 'utf8');
      }

      const toSign = `${svixId}.${svixTimestamp}.${payloadStr}`;
      const hmac = crypto.createHmac('sha256', secretBytes.length > 0 ? secretBytes : cleanSecret);
      hmac.update(toSign);
      const computedBase64 = hmac.digest('base64');

      const signatures = svixSignature.split(' ');
      for (const sig of signatures) {
        const [version, signatureValue] = sig.split(',');
        if (version === 'v1' && signatureValue) {
          if (
            signatureValue.length === computedBase64.length &&
            crypto.timingSafeEqual(Buffer.from(signatureValue), Buffer.from(computedBase64))
          ) {
            return true;
          }
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Processes verified webhook event and updates message state in database.
   */
  async processEvent(params: {
    provider: string;
    messageId?: string;
    providerMessageId?: string;
    eventType: string;
    status: MessageExecutionStatus;
    timestamp?: string;
    rawPayload?: any;
  }): Promise<WebhookProcessingResult> {
    const timestamp = params.timestamp || new Date().toISOString();

    if (!params.messageId && !params.providerMessageId) {
      return {
        success: false,
        error: 'Missing message identifier in webhook payload',
        timestamp
      };
    }

    try {
      const updateQuery = `
        UPDATE merchant_campaign_messages
        SET 
          status = $1::varchar,
          delivered_at = CASE WHEN $1::varchar = 'DELIVERED' THEN $2::timestamptz ELSE delivered_at END,
          failed_at = CASE WHEN $1::varchar IN ('FAILED', 'BOUNCED') THEN $2::timestamptz ELSE failed_at END
        WHERE ($3::varchar IS NOT NULL AND message_id = $3)
           OR ($4::varchar IS NOT NULL AND provider_message_id = $4)
        RETURNING message_id, status;
      `;

      const res = await client.query(updateQuery, [
        params.status,
        timestamp,
        params.messageId || null,
        params.providerMessageId || null
      ]);

      if (res.rows.length === 0) {
        return {
          success: true,
          messageId: params.messageId,
          newStatus: params.status,
          eventType: params.eventType,
          timestamp,
          error: 'Message record not found in ledger (unregistered outbound message)'
        };
      }

      return {
        success: true,
        messageId: res.rows[0].message_id,
        newStatus: res.rows[0].status as MessageExecutionStatus,
        eventType: params.eventType,
        timestamp
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Database update failed: ${err.message}`,
        timestamp
      };
    }
  }
}

export const webhookHandler = new WebhookHandler();
