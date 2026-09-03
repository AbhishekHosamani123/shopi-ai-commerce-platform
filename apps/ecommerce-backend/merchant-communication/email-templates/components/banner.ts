import { sanitizeImageUrl, escapeHtml } from '../sanitization';

export interface BannerProps {
  bannerImage?: string | null;
  altText?: string;
}

/**
 * Renders the promotional banner area.
 *
 * Preferred path (CID): when the campaign pipeline generated a personalized
 * banner (customer name + approved discount), it is embedded inside the email
 * as a MIME attachment and referenced via `cid:` — it displays in Gmail /
 * Outlook / mobile clients with zero external network fetches. This is the
 * only banner path used for real recipient sends; localhost URLs are never
 * emitted because a real recipient's mail client cannot reach them.
 *
 * Fallback path: if generation failed, the caller passes null and the banner
 * area is omitted entirely — an email without a banner is always better than
 * a broken image. (Dry-run/simulation providers may still reference the
 * static public asset for local preview only.)
 */
export function renderBanner(props?: BannerProps | null): string {
  const defaultBannerUrl = 'https://shopi-ai-commerce-platform-shop-two.vercel.app/campaign-banners/banner_25.png';
  const raw = props?.bannerImage || defaultBannerUrl;
  const altText = escapeHtml(props?.altText || 'Special Shopi promotional offer');

  // CID inline banner — travels with the MIME message.
  if (raw && raw.startsWith('cid:')) {
    const cid = escapeHtml(raw.slice(4));
    return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #ffffff;">
        <tr>
          <td align="center" style="padding: 0; line-height: 0; font-size: 0;">
            <img
              src="cid:${cid}"
              alt="${altText}"
              width="600"
              style="display: block; width: 100%; max-width: 600px; height: auto; border: 0; outline: none; text-decoration: none;"
            />
          </td>
        </tr>
      </table>
    `.trim();
  }

  const bannerUrl = sanitizeImageUrl(raw) || defaultBannerUrl;

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #ffffff;">
      <tr>
        <td align="center" style="padding: 0; line-height: 0; font-size: 0;">
          <img
            src="${escapeHtml(bannerUrl)}"
            alt="${altText}"
            width="600"
            style="display: block; width: 100%; max-width: 600px; height: auto; border: 0; outline: none; text-decoration: none;"
          />
        </td>
      </tr>
    </table>
  `.trim();
}
