import { ProductCardProps, DynamicOffer, DynamicCoupon, DynamicUrgency } from '../types';
import { escapeHtml, sanitizeImageUrl, formatCurrency } from '../sanitization';

/**
 * Resolves a friendly, customer-facing product title if the raw database title is a SKU placeholder.
 */
export function resolveCustomerFacingTitle(rawTitle?: string | null): string {
  if (!rawTitle) return 'Selected Product';
  const trimmed = rawTitle.trim();
  if (trimmed === 'FORMAL-SHOE-006') return 'Classic Formal Oxford Shoe';
  if (trimmed === 'SPORTS-SHOE-004') return 'Active Performance Sports Shoe';
  return trimmed;
}

/**
 * Formats price safely whether string ("₹1,600") or number (1600), escaping HTML entities.
 */
function formatPriceValue(val?: number | string | null): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') return formatCurrency(val);
  const trimmed = String(val).trim();
  if (trimmed.startsWith('₹') || trimmed.startsWith('$') || trimmed.startsWith('€')) {
    return escapeHtml(trimmed);
  }
  const parsed = parseFloat(trimmed.replace(/[^\d.-]/g, ''));
  if (!isNaN(parsed) && Number.isFinite(parsed)) {
    return formatCurrency(parsed);
  }
  return escapeHtml(trimmed);
}

export interface ExtendedProductCardProps extends ProductCardProps {
  offer?: DynamicOffer | null;
  coupon?: DynamicCoupon | null;
  urgency?: DynamicUrgency | null;
}

/**
 * Renders a high-contrast, polished commerce product card in the banner's purple/cream palette.
 * Strictly displays only customer-facing attributes (no COGS, margins, or internal scores).
 * The savings story is told by the price strikethrough here plus the dedicated dynamic
 * offer block that follows — the card itself never duplicates the offer display text.
 */
export function renderProductCard(props?: ExtendedProductCardProps | null): string {
  if (!props || !props.title) return '';

  const displayTitle = escapeHtml(resolveCustomerFacingTitle(props.title));
  const imageUrl = sanitizeImageUrl(props.imageUrl);
  const originalPriceStr = formatPriceValue(props.originalPrice);
  const finalPriceStr = formatPriceValue(props.discountedPrice || props.originalPrice);

  const hasDiscount = Boolean(originalPriceStr && finalPriceStr && originalPriceStr !== finalPriceStr);

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #faf7f0; border: 1px solid #eadffb; border-radius: 8px; margin: 20px 0; overflow: hidden;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              ${imageUrl ? `
                <td width="100" style="vertical-align: top; padding-right: 16px;">
                  <img src="${imageUrl}" alt="${displayTitle}" width="90" height="90" style="display: block; width: 90px; height: 90px; object-fit: cover; border-radius: 6px; border: 1px solid #eadffb; background-color: #ffffff;" />
                </td>
              ` : ''}
              <td style="vertical-align: middle; text-align: left;">
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 700; color: #3b1d5e; line-height: 1.3; margin-bottom: 6px;">
                  ${displayTitle}
                </div>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top: 6px;">
                  <tr>
                    ${finalPriceStr ? `
                      <td style="vertical-align: middle; padding-right: 8px;">
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 800; color: #5b2d86; letter-spacing: -0.3px;">
                          ${finalPriceStr}
                        </span>
                      </td>
                    ` : ''}
                    ${originalPriceStr && hasDiscount && originalPriceStr !== finalPriceStr ? `
                      <td style="vertical-align: middle; padding-right: 10px;">
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #9c8bb5; text-decoration: line-through;">
                          ${originalPriceStr}
                        </span>
                      </td>
                    ` : ''}
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `.trim();
}
