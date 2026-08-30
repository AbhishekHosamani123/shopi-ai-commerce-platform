import { WhatsAppMessageInput } from './whatsapp-types';

/**
 * Builds the concise, conversational WhatsApp variant of a campaign message.
 *
 * CRITICAL CONSTRAINT: the WhatsApp copy must present EXACTLY the same
 * approved offer as the email variant. The builder renders the approved offer
 * text; it never derives, clamps or invents a discount. Personalization,
 * product, offer, coupon code, CTA and campaign identity are all preserved
 * from the same approved campaign object.
 */
export class WhatsAppMessageBuilderService {
  buildCampaignMessage(input: WhatsAppMessageInput): string {
    const {
      customerName,
      productTitle,
      offerText,
      couponCode,
      ctaText,
      ctaUrl,
      campaignId
    } = input;

    const lines: string[] = [];
    lines.push(`Hi ${customerName} 👋`);
    lines.push('');
    lines.push(`We noticed you were interested in the ${productTitle}.`);
    lines.push('');
    lines.push(`Here's a special offer for you:`);
    lines.push(offerText);
    if (couponCode) {
      lines.push('');
      lines.push(`Use code: ${couponCode}`);
    }
    lines.push('');
    lines.push(`${ctaText}: ${ctaUrl}`);
    lines.push('');
    lines.push('Offer valid while available.');

    // Campaign identity footer for attribution and audit traceability.
    lines.push(`(Ref: ${campaignId})`);

    return lines.join('\n');
  }
}

export const whatsAppMessageBuilderService = new WhatsAppMessageBuilderService();
