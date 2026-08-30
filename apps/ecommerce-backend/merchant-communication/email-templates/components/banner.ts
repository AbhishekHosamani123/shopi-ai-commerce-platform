import { sanitizeImageUrl, escapeHtml } from '../sanitization';

export interface BannerProps {
  bannerImage?: string | null;
  altText?: string;
}

/**
 * Renders the static promotional banner asset (`banner_img`).
 * Critical Design Principle:
 * - The banner image is completely static (karate illustration, purple/cream palette, torn paper texture).
 * - Zero dynamic text is baked into the image — all customer/offer text is real HTML below it.
 * - Displays with email-safe attributes and responsive max-width 600px.
 * - If explicitly null, omits the banner area entirely (email stays fully understandable without it).
 */
export function renderBanner(props?: BannerProps | null): string {
  if (props?.bannerImage === null) return '';

  const defaultBannerUrl = process.env.BANNER_IMG_URL || 'https://shopi.store/banner_img.png';
  const rawUrl = props?.bannerImage || defaultBannerUrl;
  const bannerUrl = sanitizeImageUrl(rawUrl) || defaultBannerUrl;
  const altText = escapeHtml(props?.altText || 'Special Shopi offer');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #ffffff;">
      <tr>
        <td align="center" style="padding: 0; line-height: 0; font-size: 0;">
          <img
            src="${bannerUrl}"
            alt="${altText}"
            width="600"
            style="display: block; width: 100%; max-width: 600px; height: auto; border: 0; outline: none; text-decoration: none;"
          />
        </td>
      </tr>
    </table>
  `.trim();
}

