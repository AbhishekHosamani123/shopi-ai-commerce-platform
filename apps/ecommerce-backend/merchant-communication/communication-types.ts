import { FinancialSafetyAnalysis } from '../merchant-recommendation-engine/recommendation-types';
import { ConfidenceLevel } from '../merchant-opportunity-engine/opportunity-types';
import { CampaignType, CampaignStatus, CampaignChannel, CampaignOfferType } from '../merchant-campaigns/campaign-types';

export type CommunicationMode = 'DRY_RUN' | 'TEST' | 'PRODUCTION';

export type ConsentStatus = 'CONSENT_GRANTED' | 'CONSENT_DENIED' | 'CONSENT_UNKNOWN';

export type SuppressionReason =
  | 'EMAIL_UNSUBSCRIBED'
  | 'WHATSAPP_OPTED_OUT'
  | 'GLOBAL_MARKETING_OPT_OUT'
  | 'COMMUNICATION_COOLDOWN'
  | 'SUPPRESSED_ALREADY_PURCHASED'
  | 'INVALID_RECIPIENT'
  | 'CONSENT_DENIED'
  | 'CONSENT_UNKNOWN'
  | 'RATE_LIMITED'
  | 'INELIGIBLE_SEGMENT'
  | 'TEST_MODE_RECIPIENT_BLOCKED'
  | 'RECIPIENT_NOT_ALLOWED';

export type MessageExecutionStatus =
  | 'QUEUED'
  | 'VALIDATING'
  | 'READY_TO_SEND'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'BOUNCED'
  | 'FAILED'
  | 'SUPPRESSED'
  | 'SIMULATED'
  | 'OPENED'
  | 'CLICKED';

export type CampaignExecutionStatus =
  | 'READY_FOR_REVIEW'
  | 'APPROVED'
  | 'QUEUED'
  | 'VALIDATING'
  | 'READY_TO_SEND'
  | 'SENDING'
  | 'SENT'
  | 'PARTIALLY_SENT'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'BLOCKED'
  | 'DRY_RUN_COMPLETED'
  | 'REAPPROVAL_REQUIRED';

export type FailureCategory =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'PROVIDER_ERROR'
  | 'RATE_LIMITED'
  | 'INVALID_RECIPIENT'
  | 'CONSENT_BLOCKED'
  | 'COOLDOWN_BLOCKED'
  | 'ALREADY_PURCHASED'
  | 'CAMPAIGN_EXPIRED'
  | 'FINANCIAL_BLOCK'
  | 'INVENTORY_BLOCK'
  | 'APPROVAL_STALE'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'EMAIL_DOMAIN_NOT_VERIFIED'
  | 'BOUNCED'
  | 'TEST_MODE_RECIPIENT_BLOCKED'
  | 'RECIPIENT_NOT_ALLOWED'
  | 'UNKNOWN_ERROR';

export interface AttributionIdentifiers {
  campaignId: string;
  customerId: number;
  couponCode?: string;
  trackingId: string;
  recommendationId?: string;
  opportunityId?: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
}

export interface OutboundMessagePayload {
  messageId: string;
  merchantId: string;
  campaignId: string;
  customerId: number;
  channel: 'EMAIL' | 'WHATSAPP';
  recipient: string;
  sender?: string;
  replyTo?: string;
  subject?: string;
  htmlBody?: string;
  textBody?: string;
  whatsAppMessage?: string;
  templateId?: string;
  templateVersion?: number;
  campaignVersion: number;
  idempotencyKey: string;
  attribution: AttributionIdentifiers;
  metadata?: Record<string, any>;
}

export interface ProviderSendResult {
  success: boolean;
  providerMessageId?: string;
  status: MessageExecutionStatus;
  provider: string;
  timestamp: string;
  error?: string;
  failureCategory?: FailureCategory;
  isSimulated?: boolean;
}

export interface MessageDeliveryRecord {
  messageId: string;
  merchantId: string;
  campaignId: string;
  recommendationId?: string;
  opportunityId?: string;
  customerId: number;
  productId?: number;
  channel: 'EMAIL' | 'WHATSAPP';
  provider: string;
  idempotencyKey: string;
  status: MessageExecutionStatus;
  createdAt: string;
  queuedAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  failureReason?: string;
  failureCategory?: FailureCategory;
  providerMessageId?: string;
  campaignVersion: number;
  attribution: AttributionIdentifiers;
}

export interface CustomerConsentRecord {
  customerId: number;
  merchantId: string;
  emailConsent: ConsentStatus;
  whatsAppConsent: ConsentStatus;
  isEmailUnsubscribed: boolean;
  isWhatsAppOptedOut: boolean;
  isGlobalOptedOut: boolean;
  lastUpdated: string;
}

export interface RateLimitConfig {
  maxCampaignRecipients: number;
  maxMessagesPerCustomerPerWeek: number;
  maxMessagesPerMerchantPerDay: number;
  maxProviderRequestsPerMinute: number;
}

export interface ExecutionValidationResult {
  isValid: boolean;
  blockReason?: FailureCategory;
  blockExplanation?: string;
  eligibleRecipients: {
    customerId: number;
    email: string | null;
    phone: string | null;
    channel: 'EMAIL' | 'WHATSAPP';
    recipient: string;
  }[];
  suppressedRecipients: {
    customerId: number;
    reason: SuppressionReason;
    details: string;
  }[];
}

export interface ChannelDeliverySummary {
  sent: number;
  failed: number;
  skipped: number;
  byStatus: Record<string, number>;
}

export interface CampaignExecutionResult {
  campaignId: string;
  merchantId: string;
  status: CampaignExecutionStatus;
  mode: CommunicationMode;
  totalAudienceCount: number;
  eligibleCount: number;
  suppressedCount: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  messages: MessageDeliveryRecord[];
  suppressionSummary: Record<string, number>;
  executedAt: string;
  isDryRun: boolean;
  /** Merchant-approved delivery channels, re-validated by the backend. */
  deliveryChannels?: ('EMAIL' | 'WHATSAPP')[];
  /** Per-channel delivery results; email status is never overwritten by WhatsApp. */
  channelResults?: {
    EMAIL: ChannelDeliverySummary;
    WHATSAPP: ChannelDeliverySummary;
  };
}

export interface WebhookProcessingResult {
  success: boolean;
  messageId?: string;
  newStatus?: MessageExecutionStatus;
  eventType?: string;
  timestamp: string;
  error?: string;
}
