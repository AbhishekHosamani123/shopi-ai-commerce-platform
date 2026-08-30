import { DynamicCoupon } from '../types';
import { escapeHtml } from '../sanitization';

export interface CouponBlockProps {
  coupon?: DynamicCoupon | null;
  couponCode?: string | null;
}

/**
 * Renders the dynamic promo code inside a prominent dashed-border container.
 * The code itself is never hardcoded: "SHOPI60", "SAVE500", "SHOPI100" all render
 * through this single block, and it is omitted entirely when no coupon was issued
 * (e.g. NO_INCENTIVE / merchandising-only campaigns).
 */
export function renderCouponBlock(props?: CouponBlockProps | null): string {
  if (!props) return '';

  const rawCode = props.coupon?.code || props.couponCode;
  if (!rawCode) return '';

  const code = escapeHtml(String(rawCode).trim().toUpperCase());

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 18px 0 4px 0;">
      <tr>
        <td align="center" style="border: 1px dashed #a67cd6; border-radius: 8px; padding: 14px 20px; background-color: #ffffff;">
          <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 600; color: #6b5790; letter-spacing: 0.3px; display: block; margin-bottom: 6px;">
            Use code
          </span>
          <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 22px; font-weight: 800; color: #5b2d86; letter-spacing: 2px; display: inline-block;">
            ${code}
          </span>
          <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 600; color: #6b5790; display: block; margin-top: 6px;">
            at checkout
          </span>
        </td>
      </tr>
    </table>
  `.trim();
}
