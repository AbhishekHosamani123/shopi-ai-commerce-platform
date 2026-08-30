import { client } from '../data/DB';

export type EventType =
  | 'PRODUCT_VIEW'
  | 'SEARCH'
  | 'ADD_TO_CART'
  | 'REMOVE_FROM_CART'
  | 'CHECKOUT_STARTED'
  | 'CHECKOUT_PROGRESS'
  | 'CHECKOUT_COMPLETED'
  | 'PURCHASE'
  | 'WISHLIST_ADD'
  | 'WISHLIST_REMOVE'
  | 'COUPON_APPLIED';

export const ALLOWED_EVENT_TYPES: Set<string> = new Set([
  'PRODUCT_VIEW',
  'SEARCH',
  'ADD_TO_CART',
  'REMOVE_FROM_CART',
  'CHECKOUT_STARTED',
  'CHECKOUT_PROGRESS',
  'CHECKOUT_COMPLETED',
  'PURCHASE',
  'WISHLIST_ADD',
  'WISHLIST_REMOVE',
  'COUPON_APPLIED'
]);

export interface IngestEventInput {
  merchantId?: string;
  customerId?: number | string | null;
  sessionId: string;
  eventType: EventType | string;
  productId?: number | string | null;
  variantId?: string | number | null;
  metadata?: Record<string, any>;
}

export interface StoredCustomerEvent {
  eventId: string;
  merchantId: string;
  customerId: number | null;
  sessionId: string;
  eventType: string;
  productId: number | null;
  variantId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export class TelemetryService {
  // In-memory cache to prevent duplicate client emissions within 2 seconds
  private dedupeCache: Map<string, number> = new Map();

  /**
   * Sanitizes metadata payload to prevent PII, credit cards, or large blobs from entering the telemetry lake.
   */
  private sanitizeMetadata(rawMetadata?: any): Record<string, any> {
    if (!rawMetadata || typeof rawMetadata !== 'object' || Array.isArray(rawMetadata)) {
      return {};
    }

    const sanitized: Record<string, any> = {};
    const disallowedKeys = ['password', 'token', 'jwt', 'secret', 'card_number', 'cardnumber', 'cvv', 'card_cvv', 'pin', 'otp'];

    for (const [k, v] of Object.entries(rawMetadata)) {
      const lowerKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (disallowedKeys.some(dis => lowerKey.includes(dis))) {
        continue; // drop sensitive data
      }

      // Value type checks
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        sanitized[k] = v;
      } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        sanitized[k] = this.sanitizeMetadata(v);
      }
    }

    // Guard payload size (max 10KB JSON string)
    const jsonStr = JSON.stringify(sanitized);
    if (jsonStr.length > 10240) {
      return { truncated: true, reason: 'Payload exceeded 10KB limit' };
    }

    return sanitized;
  }

  /**
   * Records a single customer telemetry event with server-side validation and deduplication.
   */
  async recordEvent(input: IngestEventInput): Promise<{ success: boolean; eventId?: string; error?: string; deduplicated?: boolean }> {
    try {
      if (!input.sessionId || typeof input.sessionId !== 'string' || input.sessionId.trim().length === 0) {
        return { success: false, error: 'Valid session_id is required' };
      }

      const cleanSessionId = input.sessionId.trim().slice(0, 128);
      const cleanEventType = (input.eventType || '').toUpperCase().trim();

      if (!ALLOWED_EVENT_TYPES.has(cleanEventType)) {
        return { success: false, error: `Invalid event_type: ${input.eventType}. Allowed: ${Array.from(ALLOWED_EVENT_TYPES).join(', ')}` };
      }

      const merchantId = (input.merchantId && typeof input.merchantId === 'string' && input.merchantId.trim().length > 0)
        ? input.merchantId.trim().slice(0, 64)
        : 'default_merchant';

      const customerId = input.customerId !== undefined && input.customerId !== null && !isNaN(Number(input.customerId))
        ? Number(input.customerId)
        : null;

      const productId = input.productId !== undefined && input.productId !== null && !isNaN(Number(input.productId))
        ? Number(input.productId)
        : null;

      const variantId = (input.variantId !== undefined && input.variantId !== null)
        ? String(input.variantId).trim().slice(0, 64)
        : null;

      // Deduplication Guard: Check if identical event was emitted within 2000ms
      const dedupeKey = `${merchantId}:${cleanSessionId}:${cleanEventType}:${productId || 'null'}:${variantId || 'null'}`;
      const now = Date.now();
      const lastEmitted = this.dedupeCache.get(dedupeKey);

      if (lastEmitted && now - lastEmitted < 2000) {
        return { success: true, deduplicated: true };
      }
      this.dedupeCache.set(dedupeKey, now);

      // Clean old dedupe entries every 500 records
      if (this.dedupeCache.size > 500) {
        for (const [key, ts] of this.dedupeCache.entries()) {
          if (now - ts > 10000) this.dedupeCache.delete(key);
        }
      }

      const eventId = `ev_${now}_${Math.random().toString(36).substring(2, 9)}`;
      const cleanMetadata = this.sanitizeMetadata(input.metadata);

      await client.query(`
        INSERT INTO customer_event_stream (
          event_id,
          merchant_id,
          customer_id,
          session_id,
          event_type,
          product_id,
          variant_id,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      `, [
        eventId,
        merchantId,
        customerId,
        cleanSessionId,
        cleanEventType,
        productId,
        variantId,
        JSON.stringify(cleanMetadata)
      ]);

      return { success: true, eventId };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to persist telemetry event' };
    }
  }

  /**
   * Ingests a batch of events (e.g. flushed from client queue).
   */
  async recordBatch(events: IngestEventInput[]): Promise<{ success: boolean; recorded: number; errors: string[] }> {
    if (!Array.isArray(events) || events.length === 0) {
      return { success: true, recorded: 0, errors: [] };
    }

    const errors: string[] = [];
    let recorded = 0;

    for (const ev of events.slice(0, 50)) { // limit batch size to 50 max
      const res = await this.recordEvent(ev);
      if (res.success) {
        if (!res.deduplicated) recorded++;
      } else if (res.error) {
        errors.push(res.error);
      }
    }

    return { success: errors.length === 0, recorded, errors };
  }

  /**
   * Retrieves an immutable chronological timeline of customer events for a given session or customer ID.
   */
  async getCustomerTimeline(
    identifier: { sessionId?: string; customerId?: number },
    merchantId: string = 'default_merchant'
  ): Promise<StoredCustomerEvent[]> {
    let query = `
      SELECT 
        event_id as "eventId",
        merchant_id as "merchantId",
        customer_id as "customerId",
        session_id as "sessionId",
        event_type as "eventType",
        product_id as "productId",
        variant_id as "variantId",
        metadata,
        created_at as "createdAt"
      FROM customer_event_stream
      WHERE merchant_id = $1
    `;
    const params: any[] = [merchantId];

    if (identifier.customerId) {
      params.push(identifier.customerId);
      query += ` AND customer_id = $${params.length}`;
    } else if (identifier.sessionId) {
      params.push(identifier.sessionId);
      query += ` AND session_id = $${params.length}`;
    } else {
      return [];
    }

    query += ` ORDER BY created_at ASC LIMIT 100;`;

    const res = await client.query(query, params);
    return res.rows.map(r => ({
      ...r,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata
    }));
  }

  /**
   * Retrieves aggregated event metrics for Merchant AI observability.
   */
  async getEventStats(merchantId: string = 'default_merchant'): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    uniqueSessions: number;
  }> {
    const res = await client.query(`
      SELECT 
        event_type,
        COUNT(*)::int as count,
        COUNT(DISTINCT session_id)::int as unique_sessions
      FROM customer_event_stream
      WHERE merchant_id = $1
      GROUP BY event_type;
    `, [merchantId]);

    const eventsByType: Record<string, number> = {};
    let totalEvents = 0;
    let uniqueSessions = 0;

    for (const row of res.rows) {
      eventsByType[row.event_type] = row.count;
      totalEvents += row.count;
      uniqueSessions = Math.max(uniqueSessions, row.unique_sessions);
    }

    return { totalEvents, eventsByType, uniqueSessions };
  }
}

export const telemetryService = new TelemetryService();
