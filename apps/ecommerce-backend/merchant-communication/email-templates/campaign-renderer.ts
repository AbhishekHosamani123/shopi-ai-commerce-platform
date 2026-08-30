import {
  CampaignEmailTemplateProps,
  PromotionalCampaignData,
  RenderedEmailResult
} from './types';
import { escapeHtml, sanitizeUrl, formatCurrency } from './sanitization';
import { renderHeader } from './components/header';
import { renderBanner } from './components/banner';
import { renderProductCard, resolveCustomerFacingTitle } from './components/product-card';
import { renderOfferBlock } from './components/offer-block';
import { renderCouponBlock } from './components/coupon-block';
import { renderCtaButton } from './components/cta-button';
import { renderBenefits } from './components/benefits';
import { renderFooter } from './components/footer';

/**
 * Resolves a default high-contrast headline based on campaign type.
 */
function resolveDefaultHeadline(campaignType?: string): string {
  switch (campaignType) {
    case 'CART_RECOVERY':
      return 'Your cart is waiting for you';
    case 'CHECKOUT_RECOVERY':
      return 'Complete your checkout';
    case 'REPEAT_CUSTOMER_REWARD':
      return 'A special courtesy offer just for you';
    case 'VIP_RETENTION':
      return 'Exclusive VIP privilege reserved for you';
    case 'DORMANT_REACTIVATION':
      return 'We\'ve missed you — welcome back';
    case 'HIGH_INTENT_PRODUCT':
      return 'Special offer on your selected item';
    default:
      return 'An exclusive offer from Shopi';
  }
}

/**
 * Extracts a clean first name from full customer name.
 */
function extractFirstName(fullName?: string | null): string {
  if (!fullName) return 'Valued Customer';
  const trimmed = fullName.trim();
  const first = trimmed.split(/\s+/)[0];
  return first || trimmed;
}

/**
 * Strips duplicate leading greetings (e.g. "Hi Aarav,", "Hey Aarav,", "Hello Aarav Verma,") from message body copy.
 */
function cleanMessageBody(body?: string | null): string {
  if (!body) return '';
  return body
    .replace(/^(Hi|Hello|Hey|Dear)\s+[^,\n]+,?\s*\n*/i, '')
    .trim();
}

/**
 * Renders a production-quality, responsive HTML email for customer marketing campaigns.
 * 100% customer-facing: contains zero internal telemetry, SKUs, COGS, margins, or debug panels.
 * 
 * Order of structure:
 * 1. Shopi logo/header
 * 2. Static banner_img hero (karate illustration, torn paper texture)
 * 3. Personalized customer greeting & copy
 * 4. Dynamic product card & offer & coupon
 * 5. Dynamic CTA button
 * 6. Dynamic urgency / expiry message
 * 7. 3-column benefits section
 * 8. Clean compliant footer
 */
export function renderCampaignHtml(props: CampaignEmailTemplateProps): string {
  const firstName = extractFirstName(props.customerName);
  const headline = escapeHtml(props.headline || resolveDefaultHeadline(props.campaignType));
  const previewText = escapeHtml(props.previewText || props.subject || '');
  
  // 1. Header
  const headerHtml = renderHeader({
    brandName: props.brandName,
    brandSubtitle: props.brandSubtitle,
    logoUrl: props.logoUrl
  });

  // 2. Static Banner Asset (banner_img)
  const bannerHtml = renderBanner({
    bannerImage: props.bannerImage
  });

  // 3. Product Card (dynamic title, prices, strikethrough)
  const productCardHtml = props.product ? renderProductCard({
    ...props.product,
    offer: props.offer,
    coupon: props.coupon,
    urgency: props.urgency
  }) : '';

  // 4. Dynamic Offer Block ("60% OFF" / "₹500 OFF" — decided by the Offer Engine)
  const fallbackOfferText = props.product?.offerText;
  const offerBlockHtml = renderOfferBlock({
    offer: props.offer || (fallbackOfferText ? { type: 'percentage', displayText: fallbackOfferText } : null),
    urgency: props.urgency
  });

  // 5. Dynamic Coupon Block (dashed-border container, engine-issued code)
  const couponBlockHtml = renderCouponBlock({
    coupon: props.coupon,
    couponCode: props.product?.couponCode
  });

  // 6. CTA Button
  const ctaButtonHtml = renderCtaButton({
    text: props.ctaText || 'Complete Your Purchase',
    url: props.ctaUrl,
    campaignType: props.campaignType
  });

  // 7. Benefits Section
  const benefitsHtml = renderBenefits();

  // 8. Footer
  const footerHtml = renderFooter({
    merchantName: props.merchantName,
    supportEmail: props.supportEmail,
    storeUrl: props.storeUrl,
    preferencesUrl: props.preferencesUrl,
    unsubscribeUrl: props.unsubscribeUrl
  });

  // Dynamic Personalized Copy
  const rawCleanedBody = cleanMessageBody(props.personalizedMessage);
  const personalizedMessage = rawCleanedBody
    ? `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #4a3a63; line-height: 1.6; margin: 12px 0 16px 0;">${escapeHtml(rawCleanedBody).replace(/\n/g, '<br/>')}</div>`
    : `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #4a3a63; line-height: 1.6; margin: 12px 0 16px 0;">You&apos;re so close! We saved your selection in your cart and included an exclusive offer to help you complete your purchase:</div>`;

  // Dynamic Urgency Message below CTA
  const urgencyMessageText = props.urgency?.message || props.supportingMessage;
  const urgencyMessageHtml = urgencyMessageText
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 14px;">
        <tr>
          <td align="center">
            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #d93187; font-weight: 600; line-height: 1.4; display: inline-block;">
              ⏳ ${escapeHtml(urgencyMessageText)}
            </span>
          </td>
        </tr>
      </table>
    `
    : '';

  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <!--[if !mso]><!-->
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--<![endif]-->
  <title>${escapeHtml(props.subject)}</title>
  <style type="text/css">
    /* Reset styles */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: #f4f0e6;
    }
    /* Responsive styles */
    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .mobile-padding {
        padding-left: 20px !important;
        padding-right: 20px !important;
      }
      .mobile-button {
        width: 100% !important;
        display: block !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f0e6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <!-- Hidden preheader text for inbox snippet -->
  <div style="display: none; font-size: 1px; color: #f4f0e6; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${previewText}
  </div>

  <!-- Email Wrapper Canvas -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f4f0e6" style="background-color: #f4f0e6; padding: 32px 12px;">
    <tr>
      <td align="center" style="padding: 0;">
        <!-- Email Container Card (Max 600px) -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="email-container" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #eadffb; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(91, 45, 134, 0.08); overflow: hidden;">
          
          <!-- 1. Header -->
          <tr>
            <td style="padding: 0;">
              ${headerHtml}
            </td>
          </tr>

          <!-- 2. Static Hero Banner (banner_img) -->
          <tr>
            <td style="padding: 0;">
              ${bannerHtml}
            </td>
          </tr>

          <!-- 3. Main Content Body -->
          <tr>
            <td class="mobile-padding" style="padding: 28px 36px 20px 36px;">

              <!-- Headline -->
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 22px; font-weight: 800; color: #3b1d5e; line-height: 1.25; margin-bottom: 14px;">
                ${headline}
              </div>

              <!-- Greeting (Appears exactly once) -->
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 600; color: #3b1d5e; line-height: 1.4; margin-bottom: 8px;">
                Hey ${escapeHtml(firstName)},
              </div>

              <!-- Personalized Body Copy -->
              ${personalizedMessage}

              <!-- Dynamic Product Card & Offer -->
              ${productCardHtml}

              <!-- Dynamic Offer Statement (engine-decided, never hardcoded) -->
              ${offerBlockHtml}

              <!-- Dynamic Coupon (dashed-border container) -->
              ${couponBlockHtml}

              <!-- Call To Action Button -->
              ${ctaButtonHtml}

              <!-- Dynamic Urgency / Expiry Message -->
              ${urgencyMessageHtml}
            </td>
          </tr>

          <!-- 4. Three-Column Benefits Section -->
          <tr>
            <td style="padding: 0;">
              ${benefitsHtml}
            </td>
          </tr>

          <!-- 5. Footer -->
          <tr>
            <td style="padding: 0;">
              ${footerHtml}
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generates formatted plain-text fallback content for clients that do not render HTML.
 * Strictly customer-facing with zero internal debug or telemetry text.
 */
export function renderCampaignPlainText(props: CampaignEmailTemplateProps): string {
  const lines: string[] = [];
  const firstName = extractFirstName(props.customerName);
  const headline = props.headline || resolveDefaultHeadline(props.campaignType);

  lines.push(`Hey ${firstName},`);
  lines.push('');

  if (headline) {
    lines.push(headline);
    lines.push('');
  }

  const rawCleanedBody = cleanMessageBody(props.personalizedMessage);
  if (rawCleanedBody) {
    lines.push(rawCleanedBody);
    lines.push('');
  } else {
    lines.push("You're so close! We saved the items in your cart.");
    lines.push('');
  }

  if (props.product) {
    const displayTitle = resolveCustomerFacingTitle(props.product.title);
    lines.push('--- Product Details ---');
    lines.push(`Product: ${displayTitle}`);
    if (props.product.originalPrice && props.product.discountedPrice && props.product.discountedPrice !== props.product.originalPrice) {
      lines.push(`Original Price: ${props.product.originalPrice}`);
      lines.push(`Offer Price:    ${props.product.discountedPrice}`);
    } else if (props.product.originalPrice) {
      lines.push(`Price:          ${props.product.originalPrice}`);
    }
    if (props.offer?.displayText || props.product.offerText) {
      lines.push(`Special Offer:  ${props.offer?.displayText || props.product.offerText}`);
    }
    if (props.coupon?.code || props.product.couponCode) {
      lines.push(`Promo Code:     ${props.coupon?.code || props.product.couponCode}`);
    }
    lines.push('');
  } else {
    // Image-blocked / sparse-payload fallback: offer and coupon must still be legible.
    if (props.offer?.displayText) {
      lines.push(`Special Offer:  ${props.offer.displayText}`);
      lines.push('');
    }
    if (props.coupon?.code) {
      lines.push(`Promo Code:     ${props.coupon.code}`);
      lines.push('');
    }
  }

  const ctaLabel = props.ctaText || 'Complete Your Purchase';
  lines.push(`${ctaLabel}:`);
  lines.push(props.ctaUrl);
  lines.push('');

  const urgencyMessageText = props.urgency?.message || props.supportingMessage;
  if (urgencyMessageText) {
    lines.push(`Note: ${urgencyMessageText}`);
    lines.push('');
  }

  lines.push('--- Benefits ---');
  lines.push('• Free Shipping on eligible orders');
  lines.push('• Secure Checkout');
  lines.push('• 24/7 Support');
  lines.push('');

  lines.push('---');
  lines.push(`${props.merchantName || 'Shopi'} • Commerce Intelligence`);
  if (props.supportEmail) {
    lines.push(`Need help? Contact: ${props.supportEmail}`);
  }
  lines.push(`Manage Preferences: ${props.preferencesUrl || props.unsubscribeUrl || 'https://shopi.store/account/preferences'}`);
  lines.push(`Unsubscribe: ${props.unsubscribeUrl || 'https://shopi.store/account/preferences'}`);

  return lines.join('\n').trim();
}

/**
 * Builds both HTML and plain-text representations for a campaign message.
 */
export function renderCampaignEmail(props: CampaignEmailTemplateProps): RenderedEmailResult {
  return {
    subject: props.subject,
    previewText: props.previewText,
    html: renderCampaignHtml(props),
    text: renderCampaignPlainText(props)
  };
}

/**
 * High-level builder function for cart recovery and promotional campaigns.
 * Converts structured `PromotionalCampaignData` into a complete `RenderedEmailResult`.
 *
 * All offer, coupon, urgency, and product values come from the Merchant AI /
 * Offer Engine campaign object — this layer only presents them, never decides them.
 */
export function buildCartRecoveryEmail(campaignData: PromotionalCampaignData): RenderedEmailResult {
  const customerName = campaignData.customerName || 'Valued Customer';
  const firstName = customerName.split(/\s+/)[0];
  const subject = campaignData.subject || `${firstName}, your cart is waiting 👀`;
  const headline = campaignData.headline || 'Your cart is waiting for you';
  const previewText = campaignData.previewText || `Exclusive ${campaignData.offer?.displayText || 'offer'} reserved for you on ${campaignData.product?.name || 'your selection'}`;

  // The offer engine may omit coupon or urgency for NO_INCENTIVE / merchandising campaigns.
  // The renderer degrades gracefully rather than throwing on sparse payloads.
  const offer = campaignData.offer || null;
  const coupon = campaignData.coupon || null;
  const urgency = campaignData.urgency || null;
  const product = campaignData.product
    ? {
        title: campaignData.product.name,
        imageUrl: campaignData.product.image,
        originalPrice: campaignData.product.originalPrice,
        discountedPrice: campaignData.product.currentPrice,
        offerText: offer?.displayText,
        couponCode: coupon?.code
      }
    : null;

  const props: CampaignEmailTemplateProps = {
    brandName: 'SHOPI',
    brandSubtitle: 'COMMERCE INTELLIGENCE',
    merchantName: campaignData.shop?.name || 'Shopi Store',
    logoUrl: campaignData.shop?.logoUrl,
    bannerImage: campaignData.bannerImage,
    customerName: campaignData.customerName,
    campaignType: 'CART_RECOVERY',
    subject,
    previewText,
    headline,
    personalizedMessage: campaignData.personalizedMessage,
    product,
    offer,
    coupon,
    urgency,
    ctaText: 'Complete Your Purchase',
    ctaUrl: campaignData.checkoutUrl,
    supportEmail: campaignData.shop?.supportEmail,
    storeUrl: campaignData.shop?.storeUrl,
    preferencesUrl: campaignData.shop?.preferencesUrl,
    unsubscribeUrl: campaignData.shop?.unsubscribeUrl
  };

  return renderCampaignEmail(props);
}

/**
 * Alias for buildCartRecoveryEmail for general promotional campaigns.
 */
export const buildPromotionalCampaignEmail = buildCartRecoveryEmail;
