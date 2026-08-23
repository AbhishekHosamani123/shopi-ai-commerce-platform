/**
 * ACP Order Events — webhook ingestion for post-purchase truth.
 *
 * The Agentic Commerce Protocol delivers orders, refunds and fulfillment to the
 * agent via a merchant → agent webhook (`order_create` / `order_update`), not via
 * pull endpoints. See ADR 0009. This module verifies the `Merchant-Signature`
 * header, parses the event, and derives refund / fulfillment status from an Order.
 *
 * Signature scheme (spec 2026-04-17):
 *   Header:  Merchant-Signature: t=<unix_seconds>,v1=<64_hex>
 *   Signed:  HMAC-SHA256(`${timestamp}.${rawBody}`, secret)  (hex, lowercase)
 *   Replay:  reject if |now - t| > tolerance (default 300s)
 *
 * ACP spec: https://github.com/agentic-commerce-protocol/agentic-commerce-protocol
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AcpOrder, AcpOrderEvent } from '../types/index.js';

const SIGNATURE_RE = /^t=(\d+),v1=([a-fA-F0-9]{64})$/;
const DEFAULT_TOLERANCE_SECONDS = 300;

export class AcpSignatureError extends Error {
  constructor(
    message: string,
    /** Stable reason code for programmatic handling. */
    public readonly reason:
      | 'missing'
      | 'malformed'
      | 'timestamp_out_of_window'
      | 'verification_failed'
  ) {
    super(message);
    this.name = 'AcpSignatureError';
  }
}

export interface VerifyMerchantSignatureOptions {
  /** Shared HMAC secret configured with the merchant. */
  secret: string;
  /** Allowed clock skew / replay window in seconds (default 300). */
  toleranceSeconds?: number;
  /** Override "now" (unix seconds) — for deterministic testing. */
  nowSeconds?: number;
}

/**
 * Compute the `v1` HMAC value for an ACP order-event payload. Exposed so a mock
 * merchant (or a test) can produce a valid `Merchant-Signature` header.
 */
export function signOrderEventPayload(
  rawBody: string,
  secret: string,
  timestampSeconds: number
): string {
  return createHmac('sha256', secret)
    .update(`${timestampSeconds}.${rawBody}`)
    .digest('hex');
}

/** Build a complete `Merchant-Signature` header value. */
export function buildMerchantSignatureHeader(
  rawBody: string,
  secret: string,
  timestampSeconds: number = Math.floor(Date.now() / 1000)
): string {
  const v1 = signOrderEventPayload(rawBody, secret, timestampSeconds);
  return `t=${timestampSeconds},v1=${v1}`;
}

/**
 * Verify a `Merchant-Signature` header against the raw request body. Throws an
 * {@link AcpSignatureError} (with a `.reason`) on any failure — callers should
 * respond 401. Returns the verified timestamp on success.
 */
export function verifyMerchantSignature(
  rawBody: string,
  signatureHeader: string | undefined | null,
  options: VerifyMerchantSignatureOptions
): number {
  if (!signatureHeader) {
    throw new AcpSignatureError('Missing Merchant-Signature header.', 'missing');
  }

  const match = SIGNATURE_RE.exec(signatureHeader.trim());
  if (!match) {
    throw new AcpSignatureError(
      'Merchant-Signature must be t=<timestamp>,v1=<64_hex>.',
      'malformed'
    );
  }

  const timestamp = Number(match[1]);
  const provided = match[2].toLowerCase();
  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (Math.abs(now - timestamp) > tolerance) {
    throw new AcpSignatureError('Timestamp outside allowed window.', 'timestamp_out_of_window');
  }

  const expected = signOrderEventPayload(rawBody, options.secret, timestamp);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(provided, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AcpSignatureError('Webhook signature verification failed.', 'verification_failed');
  }

  return timestamp;
}

/**
 * Parse a raw order-event body into a typed {@link AcpOrderEvent}. Validates the
 * minimal envelope (`type` + `data` with `data.id`); tolerates unknown `type`
 * values per the spec. Throws on a structurally invalid payload.
 */
export function parseOrderEvent(rawBody: string): AcpOrderEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error('Order event body is not valid JSON.');
  }

  const obj = parsed as Partial<AcpOrderEvent> | null;
  if (!obj || typeof obj !== 'object' || typeof obj.type !== 'string' || !obj.data) {
    throw new Error('Order event must have a string `type` and an object `data`.');
  }
  const order = obj.data as Partial<AcpOrder>;
  if (typeof order.id !== 'string' || typeof order.checkout_session_id !== 'string') {
    throw new Error('Order event `data` must include `id` and `checkout_session_id`.');
  }
  return obj as AcpOrderEvent;
}

/**
 * Verify + parse in one step. Throws {@link AcpSignatureError} on signature
 * failure, or `Error` on a malformed body.
 */
export function receiveOrderEvent(
  rawBody: string,
  signatureHeader: string | undefined | null,
  options: VerifyMerchantSignatureOptions
): AcpOrderEvent {
  verifyMerchantSignature(rawBody, signatureHeader, options);
  return parseOrderEvent(rawBody);
}

// ─── Order-derived status helpers ───

export interface RefundSummary {
  /** Sum of completed refund adjustment amounts (minor units). */
  refundedAmount: number;
  /** True if any refund adjustment exists (any status). */
  hasRefund: boolean;
  /** True if any refund adjustment is still pending. */
  pending: boolean;
  /** All refund-type adjustments on the order. */
  refunds: AcpOrder['adjustments'];
}

/**
 * Summarise refund state from an Order's adjustments. ACP has no refund endpoint —
 * refunds are `adjustments[]` of `type: 'refund'`.
 */
export function getRefundStatus(order: AcpOrder): RefundSummary {
  const refunds = (order.adjustments ?? []).filter((a) => a.type === 'refund');
  const refundedAmount = refunds
    .filter((r) => r.status === 'completed')
    .reduce((sum, r) => sum + (r.amount ?? 0), 0);
  return {
    refundedAmount,
    hasRefund: refunds.length > 0,
    pending: refunds.some((r) => r.status === 'pending'),
    refunds,
  };
}

export interface FulfillmentSummary {
  /** Most-progressed fulfillment status across all fulfillments, if any. */
  overallStatus?: string;
  /** Tracking numbers across shipping fulfillments. */
  trackingNumbers: string[];
  /** True once every fulfillment reports a terminal delivered state. */
  allDelivered: boolean;
  fulfillments: AcpOrder['fulfillments'];
}

/** Summarise fulfillment state from an Order's `fulfillments[]`. */
export function getFulfillmentStatus(order: AcpOrder): FulfillmentSummary {
  const fulfillments = order.fulfillments ?? [];
  const trackingNumbers = fulfillments
    .map((f) => f.tracking_number)
    .filter((t): t is string => typeof t === 'string');
  const allDelivered =
    fulfillments.length > 0 && fulfillments.every((f) => f.status === 'delivered');
  return {
    overallStatus: fulfillments[fulfillments.length - 1]?.status,
    trackingNumbers,
    allDelivered,
    fulfillments,
  };
}

/** A flat, agent-friendly digest of an Order's post-purchase state. */
export function summarizeOrder(order: AcpOrder): {
  id: string;
  status: string;
  refund: RefundSummary;
  fulfillment: FulfillmentSummary;
} {
  return {
    id: order.id,
    status: order.status,
    refund: getRefundStatus(order),
    fulfillment: getFulfillmentStatus(order),
  };
}
