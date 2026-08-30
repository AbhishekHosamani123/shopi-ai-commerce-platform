import { escapeHtml, sanitizeUrl } from '../sanitization';

export interface FooterProps {
  merchantName?: string;
  supportEmail?: string;
  storeUrl?: string;
  preferencesUrl?: string;
  unsubscribeUrl?: string;
}

/**
 * Renders the email footer component with compliance, brand identity, and unsubscribe details.
 * Strictly avoids exposing raw localhost URLs or internal development paths.
 * "Manage preferences" and "Unsubscribe" route to their own dedicated URLs,
 * each falling back to the other's value when only one is configured.
 */
export function renderFooter(props: FooterProps): string {
  const supportEmail = escapeHtml(props.supportEmail || 'support@shopi.store');
  const preferencesUrl = sanitizeUrl(
    props.preferencesUrl || props.unsubscribeUrl || 'https://shopi.store/account/preferences'
  );
  const unsubscribeUrl = sanitizeUrl(
    props.unsubscribeUrl || props.preferencesUrl || 'https://shopi.store/account/unsubscribe'
  );

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top: 1px solid #eadffb; background-color: #faf7f0; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
      <tr>
        <td style="padding: 24px 32px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #8b76a8; line-height: 1.6;">
          <div style="font-weight: 700; color: #3b1d5e; margin-bottom: 4px;">
            Shopi &bull; Commerce Intelligence
          </div>
          <div style="margin-bottom: 10px; color: #8b76a8;">
            You are receiving this email because you interacted with Shopi.
          </div>
          <div style="font-size: 11px; color: #9c8bb5;">
            Need help? Contact <a href="mailto:${supportEmail}" style="color: #7a3fb0; text-decoration: none;">support</a>.
            <br />
            <a href="${preferencesUrl}" style="color: #9c8bb5; text-decoration: underline;">Manage preferences</a> &bull; <a href="${unsubscribeUrl}" style="color: #9c8bb5; text-decoration: underline;">Unsubscribe</a>
          </div>
        </td>
      </tr>
    </table>
  `.trim();
}
