import { escapeHtml, sanitizeUrl } from '../sanitization';

export interface CtaButtonProps {
  text?: string;
  url: string;
  campaignType?: string;
}

/**
 * Resolves standard contextual CTA text if not explicitly provided.
 */
function resolveDefaultCtaText(campaignType?: string): string {
  switch (campaignType) {
    case 'CART_RECOVERY':
      return 'Complete Your Purchase';
    case 'CHECKOUT_RECOVERY':
      return 'Resume Checkout';
    case 'REPEAT_CUSTOMER_REWARD':
      return 'Claim Your Reward';
    case 'VIP_RETENTION':
      return 'Explore VIP Collection';
    case 'DORMANT_REACTIVATION':
      return 'See What\'s New';
    case 'HIGH_INTENT_PRODUCT':
      return 'Shop Now';
    default:
      return 'Complete Your Order';
  }
}

/**
 * Renders a bulletproof, table-based primary CTA button for HTML email clients.
 */
export function renderCtaButton(props: CtaButtonProps): string {
  const ctaText = escapeHtml(props.text || resolveDefaultCtaText(props.campaignType));
  const safeUrl = sanitizeUrl(props.url);

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" class="mobile-button" style="margin: 28px auto; text-align: center;">
      <tr>
        <td align="center" bgcolor="#5b2d86" style="border-radius: 6px; background-color: #5b2d86;">
          <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; display: inline-block; border: 1px solid #5b2d86; line-height: 1.2;">
            ${ctaText} &rarr;
          </a>
        </td>
      </tr>
    </table>
  `.trim();
}

