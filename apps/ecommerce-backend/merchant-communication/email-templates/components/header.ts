import { escapeHtml, sanitizeImageUrl } from '../sanitization';

export interface HeaderProps {
  brandName?: string;
  brandSubtitle?: string;
  logoUrl?: string | null;
}

/**
 * Renders the top brand header component, aligned with the banner's purple/cream palette.
 */
export function renderHeader(props: HeaderProps): string {
  const brandName = escapeHtml(props.brandName || 'SHOPI');
  const brandSubtitle = escapeHtml(props.brandSubtitle || 'COMMERCE INTELLIGENCE');
  const sanitizedLogo = sanitizeImageUrl(props.logoUrl);

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-bottom: 1px solid #eadffb; background-color: #ffffff;">
      <tr>
        <td style="padding: 24px 32px; text-align: center;">
          ${sanitizedLogo ? `
            <img src="${sanitizedLogo}" alt="${brandName}" width="120" height="auto" style="display: block; margin: 0 auto; max-height: 40px; border: 0; outline: none; text-decoration: none;" />
          ` : `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
              <tr>
                <td style="vertical-align: middle; padding-right: 8px;">
                  <div style="background-color: #5b2d86; width: 28px; height: 28px; border-radius: 6px; text-align: center; line-height: 28px; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; font-weight: bold;">⚡</div>
                </td>
                <td style="vertical-align: middle; text-align: left;">
                  <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 800; color: #3b1d5e; letter-spacing: 0.5px; line-height: 1.2; display: block;">${brandName}</span>
                  <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 9px; font-weight: 600; color: #8b76a8; letter-spacing: 1.2px; text-transform: uppercase; display: block;">${brandSubtitle}</span>
                </td>
              </tr>
            </table>
          `}
        </td>
      </tr>
    </table>
  `.trim();
}

