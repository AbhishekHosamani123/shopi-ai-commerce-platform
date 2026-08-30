/**
 * Renders the clean 3-column commerce benefits section.
 * - Free Shipping (On eligible orders)
 * - Secure Checkout (Safe & secure)
 * - 24/7 Support (We're here to help)
 */
export function renderBenefits(): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #faf7f0; border-top: 1px solid #eadffb; border-bottom: 1px solid #eadffb; margin: 24px 0 0 0;">
      <tr>
        <td style="padding: 20px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <!-- Benefit 1: Free Shipping -->
              <td align="center" style="vertical-align: top; width: 33.33%; padding: 4px 8px;">
                <div style="font-size: 20px; line-height: 1; margin-bottom: 6px;">🚚</div>
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #3b1d5e; margin-bottom: 2px;">
                  Free Shipping
                </div>
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #8b76a8; line-height: 1.3;">
                  On eligible orders
                </div>
              </td>

              <!-- Benefit 2: Secure Checkout -->
              <td align="center" style="vertical-align: top; width: 33.33%; padding: 4px 8px; border-left: 1px solid #eadffb; border-right: 1px solid #eadffb;">
                <div style="font-size: 20px; line-height: 1; margin-bottom: 6px;">🔒</div>
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #3b1d5e; margin-bottom: 2px;">
                  Secure Checkout
                </div>
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #8b76a8; line-height: 1.3;">
                  Safe &amp; secure
                </div>
              </td>

              <!-- Benefit 3: 24/7 Support -->
              <td align="center" style="vertical-align: top; width: 33.33%; padding: 4px 8px;">
                <div style="font-size: 20px; line-height: 1; margin-bottom: 6px;">💬</div>
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #3b1d5e; margin-bottom: 2px;">
                  24/7 Support
                </div>
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #8b76a8; line-height: 1.3;">
                  We&apos;re here to help
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `.trim();
}
