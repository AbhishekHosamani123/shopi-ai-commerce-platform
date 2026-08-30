import crypto from 'crypto';
import { client } from '../data/DB';
import { MessageDeliveryRecord } from './communication-types';

export class IdempotencyService {
  /**
   * Generates a deterministic idempotency key for an intended outbound send.
   */
  generateKey(
    merchantId: string,
    campaignId: string,
    customerId: number,
    channel: string,
    campaignVersion: number
  ): string {
    const raw = `${merchantId}:${campaignId}:${customerId}:${channel.toUpperCase()}:${campaignVersion}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Checks if an outbound message has already been processed with this idempotency key.
   */
  async getExistingMessage(idempotencyKey: string): Promise<MessageDeliveryRecord | null> {
    const res = await client.query(`
      SELECT * FROM merchant_campaign_messages
      WHERE idempotency_key = $1
      LIMIT 1;
    `, [idempotencyKey]);

    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    return {
      messageId: r.message_id,
      merchantId: r.merchant_id,
      campaignId: r.campaign_id,
      recommendationId: r.recommendation_id,
      opportunityId: r.opportunity_id,
      customerId: r.customer_id,
      productId: r.product_id,
      channel: r.channel,
      provider: r.provider,
      idempotencyKey: r.idempotency_key,
      status: r.status,
      createdAt: r.created_at,
      queuedAt: r.queued_at,
      sentAt: r.sent_at,
      deliveredAt: r.delivered_at,
      failedAt: r.failed_at,
      failureReason: r.failure_reason,
      failureCategory: r.failure_category,
      providerMessageId: r.provider_message_id,
      campaignVersion: r.campaign_version,
      attribution: r.attribution || {
        campaignId: r.campaign_id,
        customerId: r.customer_id,
        trackingId: `trk_${r.message_id}`,
        utmSource: 'merchant_ai',
        utmMedium: r.channel.toLowerCase(),
        utmCampaign: r.campaign_id
      }
    };
  }
}

export const idempotencyService = new IdempotencyService();
