import { CampaignType } from '../../merchant-campaigns/campaign-types';

export interface DynamicOffer {
  type: 'percentage' | 'fixed' | string;
  value?: number;
  displayText: string; // e.g. "60% OFF", "20% OFF", "₹100 OFF", "₹500 OFF"
}

export interface DynamicCoupon {
  code: string; // e.g. "SHOPI60", "SHOPI19", "SAVE500"
}

export interface DynamicUrgency {
  text?: string; // e.g. "12 HOURS ONLY", "ENDS TONIGHT", "OFFER ENDS SOON"
  message?: string; // e.g. "Your exclusive offer is valid for the next 12 hours."
}

export interface DynamicProduct {
  name: string;
  image?: string | null;
  currentPrice: string | number; // e.g. "₹1,600", "₹380", 1600
  originalPrice?: string | number | null; // e.g. "₹4,000", "₹399", 4000
}

export interface DynamicShopConfig {
  name?: string;
  logoUrl?: string;
  preferencesUrl?: string;
  unsubscribeUrl?: string;
  supportEmail?: string;
  storeUrl?: string;
}

export interface PromotionalCampaignData {
  customerName: string;
  bannerImage?: string; // URL or path to static banner_img
  product: DynamicProduct;
  offer: DynamicOffer;
  coupon: DynamicCoupon;
  urgency?: DynamicUrgency;
  checkoutUrl: string;
  shop?: DynamicShopConfig;
  subject?: string;
  previewText?: string;
  headline?: string;
  personalizedMessage?: string;
}

export interface ProductCardProps {
  productId?: number;
  title: string;
  imageUrl?: string | null;
  originalPrice?: number | string | null;
  discountedPrice?: number | string | null;
  discountAmount?: number | string | null;
  discountPercent?: number | string | null;
  offerText?: string | null;
  couponCode?: string | null;
}

export interface EmailTestMetadata {
  simulatedCustomerId?: string;
  simulatedCustomerName?: string;
  targetProductTitle?: string;
  approvedIncentive?: string;
  couponCode?: string;
  cartUrl?: string;
}

export interface CampaignEmailTemplateProps {
  // Brand & Header
  merchantName?: string;
  brandName?: string;
  brandSubtitle?: string;
  logoUrl?: string | null;

  // Banner
  bannerImage?: string | null;

  // Recipient & Campaign
  recipientEmail?: string;
  customerName: string;
  campaignType?: CampaignType | string;
  subject: string;
  previewText?: string;
  headline?: string;
  personalizedMessage?: string;
  supportingMessage?: string;

  // Target Product & Incentive
  product?: ProductCardProps | null;
  offer?: DynamicOffer | null;
  coupon?: DynamicCoupon | null;
  urgency?: DynamicUrgency | null;

  // Call To Action
  ctaText?: string;
  ctaUrl: string;

  // Test Mode Metadata
  isTestSend?: boolean;
  testMetadata?: EmailTestMetadata | null;

  // Footer & Compliance
  supportEmail?: string;
  storeUrl?: string;
  preferencesUrl?: string;
  unsubscribeUrl?: string;
}

export interface RenderedEmailResult {
  subject: string;
  html: string;
  text: string;
  previewText?: string;
}
