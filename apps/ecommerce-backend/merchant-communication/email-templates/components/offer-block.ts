import { DynamicOffer, DynamicUrgency } from '../types';
import { escapeHtml } from '../sanitization';

export interface OfferBlockProps {
  offer?: DynamicOffer | null;
  urgency?: DynamicUrgency | null;
}

/**
 * Renders the prominent dynamic offer statement between the product card and the coupon.
 *
 * The Merchant AI / Offer Engine owns this decision — the renderer only presents it:
 *   "60% OFF"  ← { type: "percentage", value: 60,  displayText: "60% OFF" }
 *   "₹500 OFF" ← { type: "fixed",      value: 500, displayText: "₹500 OFF" }
 *
 * Both shapes flow through this same block; the template never branches on discount
 * type and never hardcodes a value. When the engine issues no incentive, the block
 * is omitted rather than inventing an offer.
 */
export function renderOfferBlock(props?: OfferBlockProps | null): string {
  if (!props) return '';

  const displayText = props.offer?.displayText;
  if (!displayText) return '';

  const offerText = escapeHtml(displayText);
  const urgencyText = props.urgency?.text ? escapeHtml(props.urgency.text) : null;

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 4px 0 12px 0;">
      <tr>
        <td align="center" style="background-color: #5b2d86; border-radius: 8px; padding: 18px 24px;">
          ${urgencyText ? `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 800; color: #e9d9ff; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 6px;">
              ⏰ ${urgencyText}
            </div>
          ` : ''}
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 30px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; line-height: 1.15;">
            ${offerText}
          </div>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; color: #e9d9ff; margin-top: 6px;">
            on your selected item
          </div>
        </td>
      </tr>
    </table>
  `.trim();
}
