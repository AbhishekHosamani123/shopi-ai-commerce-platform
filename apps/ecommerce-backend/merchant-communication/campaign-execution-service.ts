import { client } from '../data/DB';
import { bannerGeneratorService } from '../banner-generator/banner-generator-service';
import type { InlineEmailAttachment } from './communication-types';
import { campaignBuilderService } from '../merchant-campaigns/campaign-builder-service';
import { CampaignDraft, EmailDraft } from '../merchant-campaigns/campaign-types';
import {
  CommunicationMode,
  CampaignExecutionResult,
  MessageDeliveryRecord,
  OutboundMessagePayload,
  ExecutionValidationResult,
  AttributionIdentifiers
} from './communication-types';
import { CommunicationProvider } from './providers/provider-interface';
import { DryRunCommunicationProvider } from './providers/dry-run-provider';
import { ProductionEmailProvider } from './providers/email-provider';
import { ResendEmailProvider } from './providers/resend-provider';
import { GmailEmailProvider } from './providers/gmail-provider';
import { ProductionWhatsAppProvider } from './providers/whatsapp-provider';
import { communicationEligibilityService } from './eligibility-service';
import { idempotencyService } from './idempotency-service';
import { rateLimiterService } from './rate-limiter';
import { renderCampaignEmail } from './email-templates';
import { whatsAppService } from '../whatsapp/whatsapp-service';
import { whatsAppMessageBuilderService } from '../whatsapp/whatsapp-message-builder';
import { client } from '../data/DB';

/** Valid delivery channels a merchant can select for a campaign. */
export type DeliveryChannel = 'EMAIL' | 'WHATSAPP';

/**
 * Normalizes and authorizes a requested channel selection. The backend
 * re-validates whatever the frontend sends — a manual/malicious request can
 * never smuggle an unauthorized channel into execution.
 *
 * `explicitEmpty` distinguishes "caller explicitly selected nothing" (block)
 * from "caller did not send a selection" (default to EMAIL, preserving the
 * legacy email-only workflow for older clients).
 */
export function normalizeDeliveryChannels(raw: unknown): { channels: DeliveryChannel[]; explicit: boolean } {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string' && raw.trim()
      ? raw.split(',')
      : null;
  if (list === null) return { channels: ['EMAIL'], explicit: false };
  const channels = new Set<DeliveryChannel>();
  for (const entry of list) {
    const c = String(entry || '').trim().toUpperCase();
    if (c === 'EMAIL' || c === 'WHATSAPP') channels.add(c);
  }
  return { channels: Array.from(channels), explicit: true };
}

export class CampaignExecutionService {
  private customEmailProvider?: CommunicationProvider;
  private customWhatsAppProvider?: CommunicationProvider;
  private tablesInitialized: boolean = false;

  constructor() {}

  /**
   * Allows injecting mock/fake providers for test isolation.
   */
  setCustomProviders(emailProvider?: CommunicationProvider, whatsAppProvider?: CommunicationProvider) {
    this.customEmailProvider = emailProvider;
    this.customWhatsAppProvider = whatsAppProvider;
  }

  /**
   * Initializes PostgreSQL audit tables if not existing.
   */
  private async ensureTablesExist() {
    if (this.tablesInitialized) return;

    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_communication_consents (
        customer_id INT NOT NULL,
        merchant_id VARCHAR(100) NOT NULL,
        email_consent VARCHAR(30) DEFAULT 'CONSENT_GRANTED',
        whatsapp_consent VARCHAR(30) DEFAULT 'CONSENT_GRANTED',
        is_email_unsubscribed BOOLEAN DEFAULT FALSE,
        is_whatsapp_opted_out BOOLEAN DEFAULT FALSE,
        is_global_opted_out BOOLEAN DEFAULT FALSE,
        last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (customer_id, merchant_id)
      );

      CREATE TABLE IF NOT EXISTS merchant_campaign_messages (
        message_id VARCHAR(100) PRIMARY KEY,
        merchant_id VARCHAR(100) NOT NULL,
        campaign_id VARCHAR(100) NOT NULL,
        recommendation_id VARCHAR(100),
        opportunity_id VARCHAR(100),
        customer_id INT NOT NULL,
        product_id INT,
        channel VARCHAR(30) NOT NULL,
        provider VARCHAR(100) NOT NULL,
        idempotency_key VARCHAR(100) UNIQUE NOT NULL,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        queued_at TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        failed_at TIMESTAMPTZ,
        failure_reason TEXT,
        failure_category VARCHAR(50),
        provider_message_id VARCHAR(200),
        campaign_version INT DEFAULT 1,
        attribution JSONB
      );

      CREATE INDEX IF NOT EXISTS idx_camp_msg_customer ON merchant_campaign_messages(customer_id, merchant_id);
      CREATE INDEX IF NOT EXISTS idx_camp_msg_campaign ON merchant_campaign_messages(campaign_id);
    `);
    await client.query(`ALTER TABLE merchant_campaign_messages ADD COLUMN IF NOT EXISTS recipient TEXT`);

    this.tablesInitialized = true;
  }

  /**
   * Resolves the active provider for the given channel and mode.
   */
  private getProvider(channel: 'EMAIL' | 'WHATSAPP', mode: CommunicationMode): CommunicationProvider {
    if (mode === 'DRY_RUN') {
      return new DryRunCommunicationProvider();
    }

    if (mode === 'TEST') {
      if (channel === 'EMAIL') {
        if (this.customEmailProvider) return this.customEmailProvider;
        const emailProviderEnv = (process.env.EMAIL_PROVIDER || '').toUpperCase();
        if (emailProviderEnv === 'GMAIL_SMTP') {
          return new GmailEmailProvider();
        }
        if (emailProviderEnv === 'RESEND') {
          return new ResendEmailProvider();
        }
        return new DryRunCommunicationProvider();
      }
      if (channel === 'WHATSAPP') {
        if (this.customWhatsAppProvider) return this.customWhatsAppProvider;
        return new DryRunCommunicationProvider();
      }
      return new DryRunCommunicationProvider();
    }

    // PRODUCTION mode
    if (channel === 'EMAIL') {
      if (this.customEmailProvider) return this.customEmailProvider;
      const emailProviderEnv = (process.env.EMAIL_PROVIDER || '').toUpperCase();
      if (emailProviderEnv === 'GMAIL_SMTP') {
        return new GmailEmailProvider();
      }
      if (emailProviderEnv === 'RESEND') {
        return new ResendEmailProvider();
      }
      return new ProductionEmailProvider();
    }
    return this.customWhatsAppProvider || new ProductionWhatsAppProvider();
  }

  /**
   * Pre-execution validation pass.
   *
   * `deliveryChannels` comes from the persisted campaign approval state and is
   * re-validated here. When provided, eligibility is evaluated per channel so
   * a customer can be EMAIL-eligible but WHATSAPP-skipped (missing phone),
   * and vice versa. Same audience, same rules — evaluated per channel.
   */
  async validateCampaignForExecution(
    campaign: CampaignDraft,
    merchantId: string,
    deliveryChannels?: DeliveryChannel[]
  ): Promise<ExecutionValidationResult> {
    await this.ensureTablesExist();

    // 1. Approval Gate: Only APPROVED campaigns can enter execution
    if (campaign.status !== 'APPROVED') {
      return {
        isValid: false,
        blockReason: 'VALIDATION_ERROR',
        blockExplanation: `Campaign status is "${campaign.status}". Only campaigns in "APPROVED" status can be executed.`,
        eligibleRecipients: [],
        suppressedRecipients: []
      };
    }

    // 2. Tenant isolation
    if (campaign.merchantId !== merchantId && merchantId !== 'merchant_admin') {
      return {
        isValid: false,
        blockReason: 'AUTHENTICATION_ERROR',
        blockExplanation: 'Merchant boundary violation: Cannot execute campaign belonging to another tenant.',
        eligibleRecipients: [],
        suppressedRecipients: []
      };
    }

    // 3. Expiration Check
    if (new Date(campaign.expiresAt).getTime() < Date.now()) {
      return {
        isValid: false,
        blockReason: 'CAMPAIGN_EXPIRED',
        blockExplanation: `Campaign expired at ${campaign.expiresAt}. Execution blocked.`,
        eligibleRecipients: [],
        suppressedRecipients: []
      };
    }

    // 4. Product Stock & Catalog Verification
    // Checks the canonical shopi_products catalog first; falls back to the
    // legacy products table so campaigns targeting either catalog still
    // enforce the out-of-stock block. NOTE: the legacy products.productid is
    // VARCHAR while shopi_products.product_id is INT — each query casts its
    // array to its column's type (a shared ::int[] made the legacy lookup
    // fail with 'operator does not exist: character varying = integer').
    const productIds = campaign.targetProducts.map(p => p.productId);
    if (productIds.length > 0) {
      const shopiRes = await client.query(`
        SELECT product_id as productid, title, selling_price as price, stock_quantity as stock
        FROM shopi_products WHERE product_id = ANY($1::int[])
      `, [productIds]);
      const legacyRes = await client.query(`
        SELECT productid, title, price, stock FROM products WHERE productid = ANY($1::text[])
      `, [productIds.map(String)]);
      const found = new Map<number, any>();
      for (const row of [...legacyRes.rows, ...shopiRes.rows]) {
        found.set(parseInt(row.productid, 10), row);
      }

      if (found.size === 0) {
        return {
          isValid: false,
          blockReason: 'INVENTORY_BLOCK',
          blockExplanation: 'Target products not found in catalog.',
          eligibleRecipients: [],
          suppressedRecipients: []
        };
      }

      const outOfStock = Array.from(found.values()).filter(r => parseInt(r.stock, 10) <= 0);
      if (outOfStock.length > 0) {
        return {
          isValid: false,
          blockReason: 'INVENTORY_BLOCK',
          blockExplanation: `Target product "${outOfStock[0].title}" is out of stock. Promotional campaign blocked.`,
          eligibleRecipients: [],
          suppressedRecipients: []
        };
      }
    }

    // 5. Financial Safety Revalidation
    if (campaign.financialAudit) {
      if (
        campaign.offer.discountType === 'PERCENTAGE' &&
        campaign.offer.discountValue > (campaign.financialAudit.maxSafeDiscount || 40)
      ) {
        return {
          isValid: false,
          blockReason: 'FINANCIAL_BLOCK',
          blockExplanation: `Proposed discount (${campaign.offer.discountValue}%) exceeds safe margin boundary (${campaign.financialAudit.maxSafeDiscount}%). Execution blocked.`,
          eligibleRecipients: [],
          suppressedRecipients: []
        };
      }
    }

    // 6. Audience Eligibility & Suppression Evaluation (per selected channel)
    const eligible: ExecutionValidationResult['eligibleRecipients'] = [];
    const suppressed: ExecutionValidationResult['suppressedRecipients'] = [];

    // Resolve the effective channel selection: merchant-selected channels when
    // provided (persisted at approval), otherwise the campaign's legacy channel.
    const effectiveChannels: DeliveryChannel[] =
      deliveryChannels && deliveryChannels.length > 0
        ? deliveryChannels
        : [campaign.channel === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL'];

    for (const member of campaign.targetAudience) {
      // Win-back campaign types target past buyers on purpose — historical purchases
      // must not disqualify recipients there.
      const isWinBackType = campaign.campaignType === 'DORMANT_REACTIVATION'
        || campaign.campaignType === 'VIP_RETENTION'
        || campaign.campaignType === 'REPEAT_CUSTOMER_REWARD';

      let anyChannelEligible = false;
      let lastIneligible: { reason: any; details: string } | null = null;

      for (const preferredChannel of effectiveChannels) {
        const evalResult = await communicationEligibilityService.evaluateCustomerEligibility(
          member.customerId,
          merchantId,
          preferredChannel,
          productIds,
          campaign.createdAt,
          { skipPurchaseSuppression: isWinBackType }
        );

        if (evalResult.isEligible) {
          const recipient = preferredChannel === 'EMAIL' ? (member.email || '') : (member.phone || '');
          eligible.push({
            customerId: member.customerId,
            email: member.email,
            phone: member.phone ?? null,
            channel: preferredChannel,
            recipient
          });
          anyChannelEligible = true;
        } else {
          lastIneligible = {
            reason: evalResult.suppressionReason || 'INELIGIBLE_SEGMENT',
            details: `${preferredChannel}: ${evalResult.explanation || 'Customer is ineligible for this campaign send.'}`
          };
        }
      }

      // Suppressed only when ineligible on every selected channel.
      if (!anyChannelEligible && lastIneligible) {
        suppressed.push({
          customerId: member.customerId,
          reason: lastIneligible.reason,
          details: lastIneligible.details
        });
      }
    }

    return {
      isValid: true,
      eligibleRecipients: eligible,
      suppressedRecipients: suppressed
    };
  }

  /**
   * Executes campaign through active provider pipeline with full idempotency and logging.
   *
   * `requestedChannels` reflects the merchant's channel selection persisted at
   * approval time; the backend validates it again here. Zero channels is a
   * hard block ("Select at least one delivery channel").
   */
  async executeCampaign(
    campaignId: string,
    merchantId: string = 'default_merchant',
    overrideMode?: CommunicationMode,
    requestedChannels?: DeliveryChannel[]
  ): Promise<CampaignExecutionResult> {
    await this.ensureTablesExist();

    const mode = overrideMode || (process.env.COMMUNICATION_MODE as CommunicationMode) || 'DRY_RUN';
    const executedAt = new Date().toISOString();

    // 0. Backend channel authorization (never trust frontend state alone).
    // A missing selection defaults to the legacy EMAIL workflow; an explicit
    // empty selection is a hard block.
    const channelSelection = normalizeDeliveryChannels(requestedChannels);
    const deliveryChannels = channelSelection.channels;
    if (deliveryChannels.length === 0) {
      throw new Error('Select at least one delivery channel.');
    }

    // 1. Load Campaign Draft
    const campaign = await campaignBuilderService.getCampaignById(campaignId, merchantId);
    if (!campaign) {
      throw new Error(`Campaign "${campaignId}" not found for merchant "${merchantId}".`);
    }

    // 2. Run Pre-Execution Validation
    const validation = await this.validateCampaignForExecution(campaign, merchantId, deliveryChannels);
    if (!validation.isValid) {
      return {
        campaignId,
        merchantId,
        status: 'BLOCKED',
        mode,
        totalAudienceCount: campaign.targetAudience.length,
        eligibleCount: 0,
        suppressedCount: campaign.targetAudience.length,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        messages: [],
        suppressionSummary: { [validation.blockReason || 'BLOCKED']: campaign.targetAudience.length },
        executedAt,
        isDryRun: mode === 'DRY_RUN'
      };
    }

    const messages: MessageDeliveryRecord[] = [];
    const suppressionSummary: Record<string, number> = {};

    // Record initial suppression reasons
    for (const sup of validation.suppressedRecipients) {
      suppressionSummary[sup.reason] = (suppressionSummary[sup.reason] || 0) + 1;
    }

    let sentCount = 0;
    let deliveredCount = 0;
    let failedCount = 0;

    const campaignVersion = campaign.approvalAudit?.approvalVersion || 1;

    // 3. Process Eligible Recipients
    for (const recipient of validation.eligibleRecipients) {
      const channel = recipient.channel;
      const provider = this.getProvider(channel, mode);

      // Compute deterministic Idempotency Key
      const idempotencyKey = idempotencyService.generateKey(
        merchantId,
        campaignId,
        recipient.customerId,
        channel,
        campaignVersion
      );

      // Check if message already exists with this idempotency key
      const existingMessage = await idempotencyService.getExistingMessage(idempotencyKey);
      if (existingMessage) {
        messages.push(existingMessage);
        if (existingMessage.status === 'SENT' || existingMessage.status === 'DELIVERED' || existingMessage.status === 'SIMULATED') {
          sentCount++;
        }
        continue;
      }

      // Check provider rate limit
      if (!rateLimiterService.checkProviderRateLimit(provider.name)) {
        failedCount++;
        suppressionSummary['RATE_LIMITED'] = (suppressionSummary['RATE_LIMITED'] || 0) + 1;
        continue;
      }

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const attribution: AttributionIdentifiers = {
        campaignId,
        customerId: recipient.customerId,
        couponCode: campaign.offer.couponSpec?.couponCode,
        trackingId: `trk_${messageId}`,
        recommendationId: campaign.recommendationId,
        opportunityId: campaign.opportunityId,
        utmSource: 'merchant_ai',
        utmMedium: channel.toLowerCase(),
        utmCampaign: campaignId
      };
      (attribution as any).recipient = recipient.recipient;

      const targetProduct = campaign.targetProducts[0];
      const targetAudienceMember = campaign.targetAudience.find(a => a.customerId === recipient.customerId);
      // Recipient's display name for the personalized banner + email body.
      const customerName = targetAudienceMember?.customerName || 'Valued Customer';
      const baseOrigin = (process.env.STOREFRONT_BASE_URL || process.env.FRONTEND_SERVER_ORIGIN || 'https://shopi-ai-commerce-platform-shop-two.vercel.app').split(',')[0].trim().replace(/\/+$/, '');
      const ctaUrl = campaign.message.email.ctaUrl || `${baseOrigin}/products/${targetProduct?.productId || 'shop'}`;

      // Offer presentation mirrors the engine's decision (type + value + display text).
      // This layer renders the decision; it never derives or clamps the discount itself.
      const isPercentageOffer = campaign.offer.offerType === 'PERCENTAGE_DISCOUNT';
      const engineDisplayText = campaign.offer.description
        || (isPercentageOffer ? `${campaign.offer.discountValue}% OFF` : `₹${campaign.offer.discountValue} OFF`);

      // ===== Personalized promotional banner (shared by EMAIL and WHATSAPP) =====
      // Generated per recipient from the SAME approved values the HTML body
      // renders (customerName + campaign.offer.discountValue). The generator
      // contains no discount logic; its output is validated against the offer
      // before the send. On failure the email still goes out — without the
      // banner rather than with a broken image. Percentage offers only: a
      // fixed-amount offer has no "<N>% OFF" visual to render.
      //
      // Requirement: the SAME generated image is used for BOTH channels —
      // EMAIL embeds it via CID, WHATSAPP attaches it via a public URL served
      // from /campaign-banners/<sha-filename> (the Evolution API cannot fetch
      // CID attachments or local filesystem paths, hence the public endpoint).
      let bannerCid: string | null = null;
      let bannerAttachment: InlineEmailAttachment | undefined;
      let bannerAudit: Record<string, unknown> | undefined;
      let bannerPublicUrl: string | undefined;
      if (isPercentageOffer) {
        const banner = await bannerGeneratorService.generateCampaignBanner(
          customerName,
          campaign.offer.discountValue,
          engineDisplayText
        );
        if (banner.ok && banner.cid && banner.content) {
          bannerCid = banner.cid;
          bannerAttachment = {
            cid: banner.cid,
            filename: banner.filename,
            contentType: 'image/png',
            content: banner.content
          };
          // Public URL for the WhatsApp provider (Evolution fetches it).
          // The /campaign-banners/:filename route is served by the BACKEND
          // (index.ts:62), NOT the Vercel storefront. Prefer the explicit
          // PUBLIC_BACKEND_URL / STOREFRONT_BASE_URL_FOR_BANNERS env vars
          // over the storefront URL so the WhatsApp image fetch resolves.
          // Fall back to the storefront only when nothing else is configured
          // (the Vercel project should have a /campaign-banners proxy route).
          const bannerOrigin = (process.env.PUBLIC_BACKEND_URL
            || process.env.STOREFRONT_BASE_URL_FOR_BANNERS
            || process.env.STOREFRONT_BASE_URL
            || process.env.FRONTEND_SERVER_ORIGIN
            || 'https://shopi-ai-commerce-platform-shop-two.vercel.app').split(',')[0].trim().replace(/\/+$/, '');
          bannerPublicUrl = `${bannerOrigin}/campaign-banners/${banner.filename}`;
          bannerAudit = {
            generated: true,
            fromCache: banner.fromCache,
            cid: banner.cid,
            file: banner.filename,
            sha256_16: banner.sha256_16,
            renderedGreeting: banner.renderedGreeting,
            baseDiscountPercent: banner.baseDiscountPercent,
            approvedOfferText: engineDisplayText,
            consistency: 'MATCH',
            whatsappImage: bannerPublicUrl
          };
        } else {
          console.warn(`[banner] omitted for ${recipient.recipient} (generation failed): ${banner.error}`);
          bannerAudit = { generated: false, reason: banner.error };
        }
      }

      const renderedEmail = renderCampaignEmail({
        merchantName: 'Shopi Store',
        brandName: 'SHOPI',
        brandSubtitle: 'COMMERCE INTELLIGENCE',
        bannerImage: bannerCid ? `cid:${bannerCid}` : null,
        recipientEmail: recipient.recipient,
        customerName,
        campaignType: campaign.campaignType,
        subject: campaign.message.email.subject,
        previewText: campaign.message.email.previewText || campaign.message.email.subject,
        headline: campaign.message.email.headline,
        personalizedMessage: campaign.message.email.body,
        product: targetProduct ? {
          productId: targetProduct.productId,
          title: targetProduct.title,
          originalPrice: targetProduct.price,
          discountedPrice: isPercentageOffer
            ? Math.round(targetProduct.price * (1 - campaign.offer.discountValue / 100))
            : Math.max(0, targetProduct.price - campaign.offer.discountValue),
          offerText: engineDisplayText,
          couponCode: campaign.offer.couponSpec?.couponCode
        } : null,
        offer: {
          type: isPercentageOffer ? 'percentage' : 'fixed',
          value: campaign.offer.discountValue,
          displayText: engineDisplayText
        },
        coupon: campaign.offer.couponSpec ? {
          code: campaign.offer.couponSpec.couponCode
        } : null,
        urgency: campaign.message.email.urgency || undefined,
        ctaText: campaign.message.email.ctaText || 'Complete Your Order',
        ctaUrl,
        isTestSend: false,
        supportEmail: process.env.SMTP_SUPPORT || 'support@shopi.store',
        preferencesUrl: campaign.message.email.preferencesUrl,
        unsubscribeUrl: campaign.message.email.unsubscribeUrl
      });

      const effectiveRecipient = (channel === 'EMAIL' && process.env.EMAIL_TEST_RECIPIENT)
        ? process.env.EMAIL_TEST_RECIPIENT.trim()
        : recipient.recipient;

      const payload: OutboundMessagePayload = {
        messageId,
        merchantId,
        campaignId,
        customerId: recipient.customerId,
        channel,
        recipient: effectiveRecipient,
        subject: campaign.message.email.subject,
        textBody: renderedEmail.text,
        htmlBody: renderedEmail.html,
        whatsAppMessage: campaign.message.whatsApp.message,
        templateVersion: 1,
        campaignVersion,
        idempotencyKey,
        attribution,
        inlineAttachments: bannerAttachment ? [bannerAttachment] : undefined
      };

      // ===== Channel-specific dispatch =====
      // WHATSAPP goes through the Evolution API integration: the QR-connected
      // sender account dispatches ONLY to Buildathon-allowlisted recipients
      // (structural validation + recipient allowlist + sender connection +
      // send-mode gates all live in whatsAppService.sendMessage). EMAIL keeps
      // its existing provider pipeline untouched.
      let sendResult: { success: boolean; status: any; providerMessageId?: string; error?: string; failureCategory?: any; providerName?: string };
      if (channel === 'WHATSAPP') {
        // Build the conversational WhatsApp copy from the SAME approved offer
        // object as the email variant — never a different discount.
        const waText = whatsAppMessageBuilderService.buildCampaignMessage({
          customerName,
          productTitle: targetProduct?.title || 'your selected item',
          offerText: engineDisplayText,
          couponCode: campaign.offer.couponSpec?.couponCode,
          ctaText: campaign.message.email.ctaText || 'Shop now',
          ctaUrl,
          campaignId,
          campaignType: campaign.campaignType
        });

        const waOutcome = await whatsAppService.sendMessage({
          campaignId,
          customerId: recipient.customerId,
          customerName,
          customerPhone: recipient.phone || recipient.recipient,
          text: waText,
          // SAME personalized banner image the email embedded (public URL —
          // Evolution cannot fetch CID/local paths). Falls back to text-only
          // when banner generation failed, so a send is never lost to a
          // broken image.
          imageUrl: bannerPublicUrl,
          // WhatsApp send gating is owned by WHATSAPP_SEND_MODE (LIVE needs
          // COMMUNICATION_MODE=PRODUCTION inside the service). Campaign modes
          // TEST/DRY_RUN stay simulated so email's TEST flow can run alongside.
          // The approve route passes 'PRODUCTION' — pass that through so the
          // WhatsApp service's own gates (sender-connected, allowlist,
          // isLiveSendEnabled) are the authority, not a silent DRY_RUN.
          mode: mode === 'DRY_RUN' ? 'DRY_RUN' : 'LIVE'
        });
        sendResult = {
          success: waOutcome.success,
          status: waOutcome.status,
          providerMessageId: waOutcome.providerMessageId,
          error: waOutcome.error,
          failureCategory: waOutcome.failureCategory,
          providerName: waOutcome.simulated ? 'EVOLUTION_WHATSAPP_DRY_RUN' : 'EVOLUTION_WHATSAPP'
        };
      } else {
        const providerSend = await provider.send(payload);
        sendResult = {
          success: providerSend.success,
          status: providerSend.status,
          providerMessageId: providerSend.providerMessageId,
          error: providerSend.error,
          failureCategory: providerSend.failureCategory,
          providerName: provider.name
        };
        // Never report a simulated provider response as a real PRODUCTION send.
        if (mode === 'PRODUCTION' && providerSend.isSimulated) {
          sendResult.success = false;
          sendResult.status = 'FAILED';
          sendResult.error = 'Email provider simulated the send instead of delivering. Real dispatch did not occur.';
          sendResult.failureCategory = 'PROVIDER_ERROR';
        }
      }

      const record: MessageDeliveryRecord = {
        messageId,
        merchantId,
        campaignId,
        recommendationId: campaign.recommendationId,
        opportunityId: campaign.opportunityId,
        customerId: recipient.customerId,
        productId: campaign.targetProducts[0]?.productId,
        channel,
        provider: sendResult.providerName || provider.name,
        recipient: recipient.recipient,
        idempotencyKey,
        status: sendResult.status,
        createdAt: executedAt,
        sentAt: sendResult.success ? executedAt : undefined,
        deliveredAt: sendResult.status === 'DELIVERED' || sendResult.status === 'SIMULATED' ? executedAt : undefined,
        failedAt: !sendResult.success ? executedAt : undefined,
        failureReason: sendResult.error,
        failureCategory: sendResult.failureCategory,
        providerMessageId: sendResult.providerMessageId,
        campaignVersion,
        attribution
      };

      // Attach the banner audit trail (rendered text + consistency verdict)
      // to the persisted attribution JSON so every send records exactly what
      // the banner displayed versus the approved offer — for BOTH channels
      // (email CID embed and the WhatsApp public-URL attachment).
      if (bannerAudit) {
        (record.attribution as any).banner = bannerAudit;
      }

      // Persist delivery audit log in PostgreSQL
      // merchant_campaign_messages.customer_id is an integer column (legacy schema):
      // canonical CUST-#### IDs are stored by their numeric part (e.g. CUST-0101 → 101).
      const recordCustomerId = typeof record.customerId === 'string' && /^CUST-\d+$/i.test(record.customerId)
        ? parseInt(record.customerId.replace(/\D/g, ''), 10)
        : record.customerId;
      await client.query(`
        INSERT INTO merchant_campaign_messages (
          message_id, merchant_id, campaign_id, recommendation_id, opportunity_id,
          customer_id, product_id, channel, provider, recipient, idempotency_key, status,
          created_at, sent_at, delivered_at, failed_at, failure_reason, failure_category,
          provider_message_id, campaign_version, attribution
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        ON CONFLICT (idempotency_key) DO NOTHING;
      `, [
        record.messageId,
        record.merchantId,
        record.campaignId,
        record.recommendationId || null,
        record.opportunityId || null,
        recordCustomerId,
        record.productId || null,
        record.channel,
        record.provider,
        record.recipient || null,
        record.idempotencyKey,
        record.status,
        record.createdAt,
        record.sentAt || null,
        record.deliveredAt || null,
        record.failedAt || null,
        record.failureReason || null,
        record.failureCategory || null,
        record.providerMessageId || null,
        record.campaignVersion,
        JSON.stringify(record.attribution)
      ]);

      messages.push(record);

      if (sendResult.success) {
        sentCount++;
        if (sendResult.status === 'DELIVERED' || sendResult.status === 'SIMULATED' || sendResult.status === 'SIMULATED_DELIVERED') deliveredCount++;
      } else {
        failedCount++;
      }
    }

    // 4. Determine final campaign aggregate status
    let finalStatus: CampaignExecutionResult['status'] = 'SENT';
    if (mode === 'DRY_RUN') {
      finalStatus = 'DRY_RUN_COMPLETED';
    } else if (failedCount > 0 && sentCount > 0) {
      finalStatus = 'PARTIALLY_SENT';
    } else if (failedCount > 0 && sentCount === 0) {
      finalStatus = 'FAILED';
    }

    // Update campaign status in database
    await client.query(`
      UPDATE merchant_marketing_campaigns
      SET status = $1
      WHERE campaign_id = $2 AND merchant_id = $3;
    `, [finalStatus, campaignId, merchantId]);

    // 5. Channel-level delivery summary (each channel keeps its own results;
    //    email status is never overwritten by WhatsApp status).
    const channelStats = await whatsAppService.getCampaignChannelStats(campaignId, merchantId);
    const summarize = (stats: Record<string, number>) => {
      const sentStatuses = ['SENT', 'DELIVERED', 'SIMULATED', 'SIMULATED_DELIVERED', 'ACCEPTED_BY_PROVIDER'];
      const sent = Object.entries(stats)
        .filter(([s]) => sentStatuses.includes(s))
        .reduce((acc, [, n]) => acc + n, 0);
      const failed = Object.entries(stats)
        .filter(([s]) => s === 'FAILED')
        .reduce((acc, [, n]) => acc + n, 0);
      const skipped = Object.entries(stats)
        .filter(([s]) => s === 'SKIPPED' || s === 'SUPPRESSED')
        .reduce((acc, [, n]) => acc + n, 0);
      return { sent, failed, skipped, byStatus: stats };
    };
    const emailSummary = summarize(channelStats.EMAIL || {});
    const whatsAppSummary = summarize(channelStats.WHATSAPP || {});

    return {
      campaignId,
      merchantId,
      status: finalStatus,
      mode,
      totalAudienceCount: campaign.targetAudience.length,
      eligibleCount: validation.eligibleRecipients.length,
      suppressedCount: validation.suppressedRecipients.length,
      sentCount,
      deliveredCount,
      failedCount,
      messages,
      suppressionSummary,
      executedAt,
      isDryRun: mode === 'DRY_RUN' || messages.some(m => m.status === 'SIMULATED' || m.status === 'SIMULATED_DELIVERED'),
      // Channel-level delivery results (email status never overwritten by WhatsApp)
      deliveryChannels,
      channelResults: {
        EMAIL: emailSummary,
        WHATSAPP: whatsAppSummary
      }
    };
  }

  /**
   * Phase 16: Executes exactly ONE controlled real email send to the authorized test recipient.
   */
  async executeControlledTestSend(
    campaignId: string,
    merchantId: string = 'default_merchant',
    options?: {
      testRecipient?: string;
      customProvider?: CommunicationProvider;
      overrideMode?: CommunicationMode;
      executionVersion?: number;
    }
  ): Promise<{
    success: boolean;
    error?: string;
    failureCategory?: string;
    deliveryRecord?: MessageDeliveryRecord;
    campaign?: any;
    provider?: string;
    isDryRun?: boolean;
  }> {
    await this.ensureTablesExist();

    const mode = options?.overrideMode || (process.env.COMMUNICATION_MODE as CommunicationMode) || 'DRY_RUN';
    const executedAt = new Date().toISOString();

    // 1. Load Campaign Proposal from database
    const campRes = await client.query(
      'SELECT * FROM merchant_marketing_campaigns WHERE campaign_id = $1 AND merchant_id = $2',
      [campaignId, merchantId]
    );

    if (campRes.rows.length === 0) {
      return {
        success: false,
        error: `Campaign "${campaignId}" not found for merchant "${merchantId}".`,
        failureCategory: 'INVALID_CAMPAIGN'
      };
    }

    const row = campRes.rows[0];
    const campaignStatus = row.status;
    const prodData = row.product_data || {};
    const audienceData = row.audience_data || {};
    const offerData = row.offer_data || {};
    const messagePreview: Partial<EmailDraft> = row.message_preview || {};
    const finSim = row.financial_simulation || {};

    // 2. Resolve Customer from Snapshot or Canonical Supabase DB
    const isTestMode = process.env.EMAIL_TEST_MODE === 'true';
    const authorizedTestRecipient = (process.env.EMAIL_TEST_RECIPIENT || '').toLowerCase().trim();
    
    let customer = audienceData.eligibleCustomers?.[0];
    if (!customer) {
      const custId = audienceData.customerId;
      const custLookup = await client.query('SELECT customer_id, first_name, last_name, email FROM shopi_customers WHERE customer_id = $1', [custId]);
      if (custLookup.rows.length > 0) {
        const cRow = custLookup.rows[0];
        customer = {
          customerId: cRow.customer_id,
          customerName: `${cRow.first_name} ${cRow.last_name}`.trim(),
          email: cRow.email
        };
      } else {
        return {
          success: false,
          error: 'Campaign has no target customer email in audience data or customer directory.',
          failureCategory: 'INVALID_RECIPIENT'
        };
      }
    }

    if (!customer || !customer.email) {
      return {
        success: false,
        error: 'Campaign has no valid target customer email.',
        failureCategory: 'INVALID_RECIPIENT'
      };
    }

    const targetRecipient = (customer.email || '').toLowerCase().trim();
    const execVersion = options?.executionVersion || 1;
    const idempotencyKey = `${campaignId}:${targetRecipient}:v${execVersion}`;

    const existingMsg = await idempotencyService.getExistingMessage(idempotencyKey);
    if (existingMsg && (existingMsg.status === 'SENT' || existingMsg.status === 'DELIVERED' || existingMsg.status === 'SIMULATED' || existingMsg.status === 'ACCEPTED_BY_PROVIDER')) {
      return {
        success: false,
        error: `Duplicate execution ignored: Message with idempotency key "${idempotencyKey}" was already dispatched.`,
        failureCategory: 'IDEMPOTENT_DUPLICATE_IGNORED',
        deliveryRecord: existingMsg
      };
    }

    // 3. Approval Gate: Only APPROVED campaigns can enter execution
    if (campaignStatus !== 'APPROVED') {
      return {
        success: false,
        error: `Campaign status is "${campaignStatus}". Only campaigns in "APPROVED" status can be executed.`,
        failureCategory: 'UNAPPROVED_CAMPAIGN'
      };
    }

    // 4. Expiration Check
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      return {
        success: false,
        error: `Campaign expired at ${row.expires_at}. Execution blocked.`,
        failureCategory: 'CAMPAIGN_EXPIRED'
      };
    }

    // 5. Test Mode Recipient Restriction (Server-side hard boundary)
    if (isTestMode) {
      if (!authorizedTestRecipient || authorizedTestRecipient.trim() === '') {
        return {
          success: false,
          error: 'Configuration error: EMAIL_TEST_RECIPIENT environment variable is missing on server. Controlled send blocked.',
          failureCategory: 'CONFIGURATION_ERROR'
        };
      }
      if (targetRecipient !== authorizedTestRecipient) {
        return {
          success: false,
          error: `Test mode security violation: Target recipient "${targetRecipient}" does not match configured authorized test recipient "${authorizedTestRecipient}".`,
          failureCategory: 'TEST_MODE_RECIPIENT_BLOCKED'
        };
      }
    }

    // 6. Single Real Email Limit (MAX_REAL_EMAILS_FOR_PHASE16 = 1)
    const MAX_REAL_EMAILS_FOR_PHASE16 = 1;
    const recipientCount = 1;
    if (recipientCount > MAX_REAL_EMAILS_FOR_PHASE16) {
      return {
        success: false,
        error: `Execution blocked: Phase 16 permits at most ${MAX_REAL_EMAILS_FOR_PHASE16} email.`,
        failureCategory: 'MAX_SEND_LIMIT_EXCEEDED'
      };
    }

    // 6. Pre-Send Revalidations (Live DB Checks)
    // 6a. Product verification & Economic Drift Gate (Requirement 11)
    const productId = prodData.productId;
    if (!productId) {
      return {
        success: false,
        error: 'Target product ID is missing from campaign proposal.',
        failureCategory: 'INVALID_PRODUCT'
      };
    }

    const prodCheck = await client.query('SELECT product_id, sku, title, selling_price FROM shopi_products WHERE product_id = $1', [productId]);
    if (prodCheck.rows.length === 0) {
      return {
        success: false,
        error: `Product ${productId} not found in catalog.`,
        failureCategory: 'INVENTORY_BLOCK'
      };
    }

    const cogsCheck = await client.query('SELECT total_unit_cost FROM shopi_product_cogs WHERE product_id = $1', [productId]);
    const livePrice = parseFloat(prodCheck.rows[0].selling_price);
    const liveCogs = cogsCheck.rows.length > 0 ? parseFloat(cogsCheck.rows[0].total_unit_cost) : null;
    const snapshotPrice = prodData.sellingPrice !== undefined ? parseFloat(prodData.sellingPrice) : null;
    const snapshotCogs = prodData.cogsUnitCost !== undefined ? parseFloat(prodData.cogsUnitCost) : null;

    if (snapshotPrice !== null && Math.abs(livePrice - snapshotPrice) > 0.01) {
      await client.query("UPDATE merchant_marketing_campaigns SET status = 'REVALIDATION_REQUIRED' WHERE campaign_id = $1", [campaignId]);
      return {
        success: false,
        error: `Economic drift detected: Product selling price changed from ₹${snapshotPrice} (approved snapshot) to ₹${livePrice} (live DB). Execution blocked; fresh merchant review required.`,
        failureCategory: 'REVALIDATION_CHANGED'
      };
    }

    if (snapshotCogs !== null && liveCogs !== null && Math.abs(liveCogs - snapshotCogs) > 0.01) {
      await client.query("UPDATE merchant_marketing_campaigns SET status = 'REVALIDATION_REQUIRED' WHERE campaign_id = $1", [campaignId]);
      return {
        success: false,
        error: `Economic drift detected: Product COGS changed from ₹${snapshotCogs} (approved snapshot) to ₹${liveCogs} (live DB). Execution blocked; fresh merchant review required.`,
        failureCategory: 'REVALIDATION_CHANGED'
      };
    }

    // 6b. Margin Floor Safety Revalidation (>= 15%)
    if (offerData.safetyStatus === 'BLOCKED' || (finSim.contributionMarginAfterPct !== undefined && finSim.contributionMarginAfterPct < 15.0)) {
      return {
        success: false,
        error: `Proposed offer violates the 15% contribution margin floor.`,
        failureCategory: 'FINANCIAL_BLOCK'
      };
    }

    // 6c. Subsequent Purchase Live Check
    const custId = customer.customerId;
    const subsqOrders = await client.query(`
      SELECT o.order_id, o.order_placed_at
      FROM shopi_orders o
      JOIN shopi_order_items oi ON o.order_id = oi.order_id
      WHERE o.customer_id = $1 AND oi.product_id = $2
        AND o.order_placed_at >= $3
        AND o.order_status NOT IN ('Cancelled', 'CANCELLED')
      LIMIT 1;
    `, [custId, productId, row.created_at]);

    if (subsqOrders.rows.length > 0) {
      return {
        success: false,
        error: `Customer ${custId} subsequently completed an order for product ${productId} after this opportunity was detected.`,
        failureCategory: 'SUBSEQUENT_PURCHASE_DETECTED'
      };
    }

    // 7. Resolve Provider
    const provider: CommunicationProvider = options?.customProvider || this.customEmailProvider || this.getProvider('EMAIL', mode);

    // 8. Reachable Storefront Cart URL & Test-Sanitized Identity (Requirements 4 & 8)
    const storefrontBaseUrl = (process.env.STOREFRONT_BASE_URL || process.env.FRONTEND_SERVER_ORIGIN || 'https://shopi-ai-commerce-platform-shop-two.vercel.app').split(',')[0].trim().replace(/\/+$/, '');
    const cartUrl = `${storefrontBaseUrl}/cart?utm_source=merchant_ai&utm_medium=email&utm_campaign=${campaignId}${offerData.couponCode ? `&coupon=${offerData.couponCode}` : ''}`;

    const customerFacingTitle = prodData.title === 'FORMAL-SHOE-006' || prodData.sku === 'FORMAL-SHOE-006'
      ? 'Classic Formal Oxford Shoe'
      : (prodData.title === 'SPORTS-SHOE-004' || prodData.sku === 'SPORTS-SHOE-004' ? 'Active Performance Sports Shoe' : prodData.title);

    // Only use productImageUrl if a valid, accessible image is verified in product catalog; otherwise null
    const productImageUrl = null;


    const isTestDispatch = isTestMode || mode !== 'PRODUCTION';
    const subject = row.campaign_type === 'CART_RECOVERY'
      ? `Your cart is waiting for you — Special offer on ${customerFacingTitle}`
      : (messagePreview.subject || `Special offer on ${customerFacingTitle}`);

    const customerName = customer.customerName || 'Valued Customer';
    const originalPrice = prodData.sellingPrice !== undefined ? parseFloat(prodData.sellingPrice) : null;
    const discountedPrice = offerData.discountedPrice !== undefined
      ? parseFloat(offerData.discountedPrice)
      : (originalPrice && offerData.offerValue ? Math.max(0, originalPrice - parseFloat(offerData.offerValue)) : null);

    const bannerImageUrl = process.env.BANNER_IMG_URL || `${storefrontBaseUrl}/banner_img.png`;

    // Personalized CID banner for the controlled test send: same approved
    // values the HTML body renders; omitted (never a broken URL) if the
    // generator fails.
    const controlledIsPercentage = (offerData.discountType || 'percentage').toLowerCase().startsWith('p');
    let controlledBannerCid: string | null = null;
    let controlledBannerAttachment: InlineEmailAttachment | undefined;
    if (controlledIsPercentage) {
      const banner = await bannerGeneratorService.generateCampaignBanner(
        customerName,
        parseFloat(offerData.offerValue || '5'),
        offerData.offerText || `${parseFloat(offerData.offerValue || '5')}% OFF`
      );
      if (banner.ok && banner.cid && banner.content) {
        controlledBannerCid = banner.cid;
        controlledBannerAttachment = {
          cid: banner.cid,
          filename: banner.filename,
          contentType: 'image/png',
          content: banner.content
        };
        console.log(`[banner] CID ${banner.cid} attached (base ${banner.baseDiscountPercent}% OFF, ${banner.fromCache ? 'cache' : 'fresh'})`);
      } else {
        console.warn(`[banner] omitted for controlled send (${banner.error})`);
      }
    }

    // Urgency is derived from the campaign's actual expiry, never hardcoded.
    const hoursLeft = row.expires_at
      ? Math.max(1, Math.round((new Date(row.expires_at).getTime() - Date.now()) / 3600000))
      : null;
    const urgency = messagePreview.urgency || {
      text: hoursLeft !== null && hoursLeft <= 48 ? `${hoursLeft} HOURS ONLY` : 'OFFER ENDS SOON',
      message: hoursLeft !== null && hoursLeft <= 48
        ? `Your exclusive offer is valid for the next ${hoursLeft} hours.`
        : 'Your personalized offer is available for a limited time.'
    };

    // Offer display text comes from the approved offer data; fallback derives from type/value only.
    const isPercentageOffer = (offerData.discountType || 'percentage').toLowerCase().startsWith('p');
    const offerDisplayText = offerData.offerText
      || (isPercentageOffer
        ? `${parseFloat(offerData.offerValue || '5')}% OFF`
        : `₹${parseFloat(offerData.offerValue || '100')} OFF`);
    const couponCode = offerData.couponCode || '';

    const renderedEmail = renderCampaignEmail({
      merchantName: 'Shopi Store',
      brandName: 'SHOPI',
      brandSubtitle: 'COMMERCE INTELLIGENCE',
      bannerImage: controlledBannerCid ? `cid:${controlledBannerCid}` : null,
      recipientEmail: targetRecipient,
      customerName,
      campaignType: row.campaign_type || 'CART_RECOVERY',
      subject,
      previewText: `Your cart is reserved with an exclusive courtesy offer on ${customerFacingTitle}.`,
      headline: row.campaign_type === 'CART_RECOVERY' ? 'Your cart is waiting for you' : 'Special offer on your selected item',
      personalizedMessage: `You left the ${customerFacingTitle} in your cart. We've reserved your selection and included a small courtesy offer to help you complete your purchase:`,
      product: {
        productId: prodData.productId,
        title: customerFacingTitle,
        imageUrl: productImageUrl,
        originalPrice,
        discountedPrice,
        discountAmount: offerData.offerValue ? parseFloat(offerData.offerValue) : null,
        offerText: offerDisplayText,
        couponCode: couponCode || undefined
      },
      offer: {
        type: isPercentageOffer ? 'percentage' : 'fixed',
        value: parseFloat(offerData.offerValue || '5'),
        displayText: offerDisplayText
      },
      coupon: couponCode ? {
        code: couponCode
      } : null,
      urgency,
      ctaText: 'Complete Your Purchase',
      ctaUrl: cartUrl,
      isTestSend: false,
      supportEmail: process.env.SMTP_SUPPORT || 'support@shopi.store'
    });


    const textBody = renderedEmail.text;
    const htmlBody = renderedEmail.html;



    // 9. Structured Outbound Message Payload (Zero Internal Analytics)
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const trackingId = `trk_${messageId}`;

    const payload: OutboundMessagePayload = {
      messageId,
      merchantId,
      campaignId,
      customerId: parseInt(custId.replace(/\D/g, ''), 10) || 1,
      channel: 'EMAIL',
      recipient: targetRecipient,
      subject,
      textBody,
      htmlBody,
      templateVersion: 1,
      campaignVersion: execVersion,
      idempotencyKey,
      inlineAttachments: controlledBannerAttachment ? [controlledBannerAttachment] : undefined,
      attribution: {
        campaignId,
        customerId: parseInt(custId.replace(/\D/g, ''), 10) || 1,
        couponCode: offerData.couponCode,
        trackingId,
        recommendationId: row.recommendation_id,
        opportunityId: row.opportunity_id,
        utmSource: 'merchant_ai',
        utmMedium: 'email',
        utmCampaign: campaignId
      }
    };

    // 10. Log PHASE16_TEST_SEND safely (Zero Secrets Logged)
    console.log(`[PHASE16_TEST_SEND] Campaign: ${campaignId}, Recipient: ${targetRecipient}, Provider: ${provider.name}, Mode: ${mode}, Status: ${campaignStatus}`);

    // 11. Provider Network Dispatch
    const sendResult = await provider.send(payload);

    // Determine canonical execution status
    let deliveryStatus: MessageExecutionStatus = sendResult.status;
    if (sendResult.success && mode === 'PRODUCTION') {
      deliveryStatus = 'ACCEPTED_BY_PROVIDER';
    } else if (sendResult.success && mode === 'DRY_RUN') {
      deliveryStatus = 'SIMULATED';
    }

    const deliveryRecord: MessageDeliveryRecord = {
      messageId,
      merchantId,
      campaignId,
      recommendationId: row.recommendation_id,
      opportunityId: row.opportunity_id,
      customerId: parseInt(custId.replace(/\D/g, ''), 10) || 1,
      productId,
      channel: 'EMAIL',
      provider: provider.name,
      idempotencyKey,
      status: deliveryStatus,
      createdAt: executedAt,
      sentAt: sendResult.success ? executedAt : undefined,
      deliveredAt: deliveryStatus === 'DELIVERED' || deliveryStatus === 'SIMULATED' ? executedAt : undefined,
      failedAt: !sendResult.success ? executedAt : undefined,
      failureReason: sendResult.error,
      failureCategory: sendResult.failureCategory,
      providerMessageId: sendResult.providerMessageId || `msg_${Date.now()}`,
      campaignVersion: execVersion,
      attribution: payload.attribution
    };

    // 12. Persist Delivery Record into PostgreSQL
    // merchant_campaign_messages.customer_id is an integer column (legacy schema):
    // canonical CUST-#### IDs are stored by their numeric part (e.g. CUST-0101 → 101).
    const deliveryRecordCustomerId = typeof deliveryRecord.customerId === 'string' && /^CUST-\d+$/i.test(deliveryRecord.customerId)
      ? parseInt(deliveryRecord.customerId.replace(/\D/g, ''), 10)
      : deliveryRecord.customerId;
    await client.query(`
      INSERT INTO merchant_campaign_messages (
        message_id, merchant_id, campaign_id, recommendation_id, opportunity_id,
        customer_id, product_id, channel, provider, idempotency_key, status,
        created_at, sent_at, delivered_at, failed_at, failure_reason, failure_category,
        provider_message_id, campaign_version, attribution
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      ON CONFLICT (idempotency_key) DO UPDATE SET
        status = EXCLUDED.status,
        provider_message_id = EXCLUDED.provider_message_id,
        delivered_at = EXCLUDED.delivered_at;
    `, [
      deliveryRecord.messageId,
      deliveryRecord.merchantId,
      deliveryRecord.campaignId,
      deliveryRecord.recommendationId || null,
      deliveryRecord.opportunityId || null,
      deliveryRecordCustomerId,
      deliveryRecord.productId || null,
      deliveryRecord.channel,
      deliveryRecord.provider,
      deliveryRecord.idempotencyKey,
      deliveryRecord.status,
      deliveryRecord.createdAt,
      deliveryRecord.sentAt || null,
      deliveryRecord.deliveredAt || null,
      deliveryRecord.failedAt || null,
      deliveryRecord.failureReason || null,
      deliveryRecord.failureCategory || null,
      deliveryRecord.providerMessageId || null,
      deliveryRecord.campaignVersion,
      JSON.stringify(deliveryRecord.attribution)
    ]);

    // 13. Update Campaign Status
    const campaignFinalStatus = sendResult.success ? (mode === 'DRY_RUN' ? 'DRY_RUN_COMPLETED' : 'EXECUTED') : 'FAILED';
    await client.query(`
      UPDATE merchant_marketing_campaigns
      SET status = $1
      WHERE campaign_id = $2 AND merchant_id = $3
    `, [campaignFinalStatus, campaignId, merchantId]);

    return {
      success: sendResult.success,
      error: sendResult.error,
      failureCategory: sendResult.failureCategory,
      deliveryRecord,
      campaign: { ...row, status: campaignFinalStatus },
      provider: provider.name,
      isDryRun: mode === 'DRY_RUN'
    };
  }

  /**
   * Returns exact runtime provider selection and credential presence flags (Zero Secrets Logged).
   */
  public getActiveEmailProviderInfo(): {
    providerName: string;
    isProductionReady: boolean;
    credentialsConfigured: boolean;
    testRecipientConfigured: boolean;
    testRecipient: string | null;
  } {
    const emailProviderEnv = (process.env.EMAIL_PROVIDER || 'GMAIL_SMTP').toUpperCase();
    let providerName = 'GMAIL_SMTP (GmailEmailProvider)';
    let credsConfigured = false;

    if (emailProviderEnv === 'RESEND') {
      providerName = 'RESEND (ResendEmailProvider)';
      credsConfigured = Boolean(process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes('mock'));
    } else if (emailProviderEnv === 'SMTP' || emailProviderEnv === 'PRODUCTION_SMTP') {
      providerName = 'SMTP (ProductionEmailProvider)';
      credsConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && !process.env.SMTP_PASS.includes('mock'));
    } else {
      providerName = 'GMAIL_SMTP (GmailEmailProvider)';
      credsConfigured = Boolean((process.env.GMAIL_USER || process.env.EMAIL) && (process.env.GMAIL_APP_PASSWORD || process.env.PASSWORD));
    }

    const testRecipient = process.env.EMAIL_TEST_RECIPIENT || null;

    return {
      providerName,
      isProductionReady: true,
      credentialsConfigured: credsConfigured,
      testRecipientConfigured: Boolean(testRecipient && testRecipient.trim().length > 0),
      testRecipient
    };
  }
}

export const campaignExecutionService = new CampaignExecutionService();

