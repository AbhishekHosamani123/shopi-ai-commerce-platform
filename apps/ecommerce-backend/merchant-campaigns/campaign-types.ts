import { FinancialSafetyAnalysis, ExpectedImpactEstimate } from '../merchant-recommendation-engine/recommendation-types';
import { ConfidenceLevel } from '../merchant-opportunity-engine/opportunity-types';

export type CampaignType =
  | 'CART_RECOVERY'
  | 'CHECKOUT_RECOVERY'
  | 'HIGH_INTENT_PRODUCT'
  | 'VIP_RETENTION'
  | 'DORMANT_REACTIVATION'
  | 'REPEAT_CUSTOMER_REWARD'
  | 'PRODUCT_INTEREST_REENGAGEMENT';

export type CampaignStatus =
  | 'DRAFT'
  | 'READY_FOR_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SCHEDULED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED';

export type CampaignOfferType =
  | 'NO_INCENTIVE'
  | 'PERCENTAGE_DISCOUNT'
  | 'FIXED_AMOUNT_DISCOUNT'
  | 'COUPON'
  | 'LOYALTY_REWARD'
  | 'MERCHANDISING_ACTION'
  | 'CONTENT_IMPROVEMENT'
  | 'RESTOCK_ACTION';

export type CampaignChannel = 'EMAIL' | 'WHATSAPP' | 'MULTI_CHANNEL';

export type CampaignRejectionReason =
  | 'TOO_RISKY'
  | 'WRONG_AUDIENCE'
  | 'WRONG_OFFER'
  | 'WRONG_TIMING'
  | 'NOT_RELEVANT'
  | 'ALREADY_HANDLED'
  | 'OTHER';

export interface TargetAudienceMember {
  customerId: number;
  customerName: string;
  email: string | null;
  phone: string | null;
  segment: string;
  targetReason: string;
  evidence: {
    productViews: number;
    cartAdds: number;
    checkoutStarts: number;
    hasPurchasedProduct: boolean;
    lastActivityAt: string;
  };
  isEligible: boolean;
  ineligibilityReason?: string;
}

export interface EmailDraft {
  subject: string;
  previewText: string;
  body: string;
  offer: string;
  cta: string;
  expiry: string;
  // Extended fields written by the campaign builder and read by the execution
  // service's email renderer. Optional so legacy drafts without them still type-check.
  headline?: string;
  ctaText?: string;
  ctaUrl?: string;
  urgency?: {
    text?: string;
    message?: string;
  };
  preferencesUrl?: string;
  unsubscribeUrl?: string;
}

export interface WhatsAppDraft {
  message: string;
  offer: string;
  cta: string;
  expiry: string;
  templateName?: string;
}

export interface CampaignMessageDraft {
  email: EmailDraft;
  whatsApp: WhatsAppDraft;
}

export interface CouponSpecification {
  couponCode: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  minOrderValue: number;
  maxDiscountAmount: number | null;
  eligibleProducts: number[];
  eligibleCustomerIds: number[];
  validFrom: string;
  validUntil: string;
  usageLimit: number;
  perCustomerLimit: number;
}

export interface TargetProductSnapshot {
  productId: number;
  title: string;
  price: number;
  stock: number;
}

export interface CampaignOfferDetails {
  offerType: CampaignOfferType;
  discountValue: number;
  description: string;
  isFinanciallySafe: boolean;
  couponSpec?: CouponSpecification;
}

export interface CampaignApprovalAudit {
  approvedBy: string;
  approvedAt: string;
  approvalVersion: number;
}

export interface CampaignRejectionDetails {
  rejectedBy: string;
  rejectedAt: string;
  reason: CampaignRejectionReason;
  notes?: string;
}

export interface CampaignDraft {
  campaignId: string;
  merchantId: string;
  recommendationId: string;
  opportunityId: string;
  campaignType: CampaignType;
  status: CampaignStatus;
  title: string;
  targetProducts: TargetProductSnapshot[];
  targetAudience: TargetAudienceMember[];
  activeAudienceCount: number;
  offer: CampaignOfferDetails;
  message: CampaignMessageDraft;
  channel: CampaignChannel;
  financialAnalysis: FinancialSafetyAnalysis;
  expectedImpact: ExpectedImpactEstimate;
  confidence: ConfidenceLevel;
  explanation: {
    observation: string;
    proposedActionRationale: string;
    financialTradeoff: string;
    risks: string[];
    assumptions: string[];
  };
  approvalAudit?: CampaignApprovalAudit;
  rejectionDetails?: CampaignRejectionDetails;
  createdAt: string;
  expiresAt: string;
  isDryRunOnly: boolean; // Strictly true in Phase 6
}

export interface EditCampaignDraftInput {
  title?: string;
  channel?: CampaignChannel;
  offerType?: CampaignOfferType;
  discountValue?: number;
  emailSubject?: string;
  emailBody?: string;
  whatsAppMessage?: string;
}

export interface CampaignDryRunResult {
  campaignId: string;
  status: 'DRY_RUN_COMPLETED';
  isDryRun: true;
  simulatedAudienceCount: number;
  simulatedDeliveries: {
    customerId: number;
    channel: 'EMAIL' | 'WHATSAPP';
    recipient: string;
    status: 'SIMULATED_DELIVERED' | 'SKIPPED';
    reason?: string;
  }[];
  /** Channels the dry run simulated. */
  deliveryChannels?: ('EMAIL' | 'WHATSAPP')[];
  /** Per-channel simulated result counts. */
  channelResults?: {
    EMAIL: { sent: number; skipped: number };
    WHATSAPP: { sent: number; skipped: number };
  };
  financialProtectionConfirmed: boolean;
  message: string;
}
