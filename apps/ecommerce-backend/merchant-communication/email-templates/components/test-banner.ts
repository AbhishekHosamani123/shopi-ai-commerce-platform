import { EmailTestMetadata } from '../types';
import { escapeHtml, sanitizeUrl } from '../sanitization';

/**
 * Renders the test quarantine banner when an email is executed in TEST / CONTROLLED_TEST mode.
 */
export function renderTestBanner(meta?: EmailTestMetadata | null): string {
  if (!meta) return '';

  const custName = escapeHtml(meta.simulatedCustomerName || 'Valued Customer');
  const custId = escapeHtml(meta.simulatedCustomerId || 'CUST-0021');
  const prodTitle = escapeHtml(meta.targetProductTitle || 'Catalog Product');
  const offer = escapeHtml(meta.approvedIncentive || 'Special Offer');
  const coupon = escapeHtml(meta.couponCode || 'SAVE50');
  const cartUrl = meta.cartUrl ? sanitizeUrl(meta.cartUrl) : '';

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 14px 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #92400e; line-height: 1.5;">
          <div style="font-weight: 800; font-size: 13px; margin-bottom: 4px; display: flex; align-items: center;">
            <span style="margin-right: 6px;">🛡️</span> MERCHANT AI CONTROLLED TEST SEND
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size: 12px; color: #78350f; margin-top: 6px;">
            <tr>
              <td style="font-weight: 700; padding-right: 8px; vertical-align: top;">Target Customer:</td>
              <td>${custName} (${custId})</td>
            </tr>
            <tr>
              <td style="font-weight: 700; padding-right: 8px; vertical-align: top;">Target Product:</td>
              <td>${prodTitle}</td>
            </tr>
            <tr>
              <td style="font-weight: 700; padding-right: 8px; vertical-align: top;">Approved Offer:</td>
              <td>${offer} (Code: <code style="font-family: ui-monospace, monospace; background: #fde68a; padding: 1px 4px; border-radius: 3px;">${coupon}</code>)</td>
            </tr>
            ${cartUrl ? `
              <tr>
                <td style="font-weight: 700; padding-right: 8px; vertical-align: top;">Storefront URL:</td>
                <td><a href="${cartUrl}" style="color: #0066cc; text-decoration: underline; word-break: break-all;">${cartUrl}</a></td>
              </tr>
            ` : ''}
          </table>
        </td>
      </tr>
    </table>
  `.trim();
}

