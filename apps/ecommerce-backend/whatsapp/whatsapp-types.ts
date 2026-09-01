/**
 * WhatsApp channel types (Evolution API / Baileys integration).
 *
 * The WhatsApp layer is a DELIVERY channel only: audience selection, offer
 * generation and margin validation remain owned by the existing campaign
 * intelligence stack. These types describe channel plumbing, not marketing
 * decisions.
 *
 * BUILDATHON SECURITY MODEL (critical):
 * - SENDER: the single WhatsApp account connected via QR scan through the
 *   Evolution API instance (WHATSAPP_SENDER_INSTANCE). Whatever account the
 *   merchant physically scans becomes the sender. It is NOT one of the
 *   recipient numbers.
 * - RECIPIENTS: the ONLY numbers permitted to receive WhatsApp messages in
 *   this Buildathon demo, enforced by a hard backend allowlist
 *   (WHATSAPP_ALLOWED_RECIPIENTS). Any other number is refused.
 */

export type WhatsAppSendMode = 'DRY_RUN' | 'LIVE';

/** Live connection state resolved from Evolution API (never faked). */
export type WhatsAppSenderConnectionState = {
  instanceName: string;
  /** 'open' | 'connecting' | 'close' | 'unknown' — raw Evolution state */
  state: string;
  isConnected: boolean;
  /** True when the instance exists in Evolution API */
  instanceExists: boolean;
};

/** Pre-send sender authorization (QR-connected instance must be open). */
export type WhatsAppSenderAuthorization = {
  authorized: boolean;
  reason?: string;
  failureCategory?: 'INSTANCE_NOT_FOUND' | 'INSTANCE_DISCONNECTED' | 'PROVIDER_UNAVAILABLE';
};

/** Result of the recipient-allowlist check (Buildathon hard constraint). */
export type WhatsAppRecipientCheck = {
  allowed: boolean;
  canonicalNumber?: string;
  reason?: string;
};

/** Input for the conversational WhatsApp message builder. */
export interface WhatsAppMessageInput {
  customerName: string;
  productTitle: string;
  offerText: string;
  couponCode?: string;
  ctaText: string;
  ctaUrl: string;
  campaignId: string;
  campaignType: string;
  expiresAt?: string;
}

/** Raw Evolution API call result wrapper. */
export type EvolutionCallResult<T> = {
  ok: boolean;
  data?: T;
  status?: number;
  /** True when the failure is a Render cold-start (service waking up) — retryable. */
  waking?: boolean;
  error?: string;
};
