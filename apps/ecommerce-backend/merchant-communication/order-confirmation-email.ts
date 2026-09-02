import nodemailer from 'nodemailer';

/**
 * Transactional order confirmation emails.
 *
 * Sent when a customer completes checkout (card / cash-on-delivery / Razorpay,
 * single product or full cart). Styled after the shipping-confirmation
 * reference: order status tracker, estimated delivery card, item list,
 * shipping address, and Shopi branding.
 *
 * This is a TRANSACTIONAL email — completely separate from the marketing
 * campaign pipeline (no DRY_RUN gating, no audience rules). It only goes to
 * the customer who placed the order, using the same Gmail SMTP transport.
 */

export interface OrderEmailItem {
  productId: number | string;
  title: string;
  imageUrl?: string | null;
  quantity: number;
  unitPrice: number;
  colorName?: string | null;
  sizeName?: string | null;
}

export interface OrderConfirmationEmailData {
  customerName: string;
  customerEmail: string;
  orderId: number | string;
  orderIds?: (number | string)[];
  items: OrderEmailItem[];
  totalAmount: number;
  shippingCharge: number;
  trackingNumber: string;
  carrier?: string;
  shippingMethod?: string;
  deliveryWindowStart?: Date;
  deliveryWindowEnd?: Date;
  address?: {
    fullName?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    phone?: string;
  } | null;
  storefrontUrl?: string;
}

const DEFAULT_CARRIER = 'Shopi Express';
const DEFAULT_SHIPPING_METHOD = 'Express (3–5 days)';

function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inr(amount: number): string {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Renders the Shopi order-confirmation email (reference-styled, all inline CSS). */
export function renderOrderConfirmationEmail(data: OrderConfirmationEmailData): { html: string; text: string } {
  let storefront = data.storefrontUrl || process.env.STOREFRONT_BASE_URL || process.env.FRONTEND_SERVER_ORIGIN || 'https://shopi-ai-commerce-platform-shop-two.vercel.app';
  if (storefront.includes(',')) {
    storefront = storefront.split(',')[0].trim();
  }
  storefront = storefront.trim().replace(/\/+$/, '');
  const carrier = data.carrier || DEFAULT_CARRIER;
  const shippingMethod = data.shippingMethod || DEFAULT_SHIPPING_METHOD;

  const now = new Date();
  const winStart = data.deliveryWindowStart || new Date(now.getTime() + 3 * 24 * 3600 * 1000);
  const winEnd = data.deliveryWindowEnd || new Date(now.getTime() + 5 * 24 * 3600 * 1000);

  const primaryOrder = String(data.orderId);
  const multiNote = (data.orderIds && data.orderIds.length > 1)
    ? `<p style="font-size: 14px; color: #4a4a4a; margin-bottom: 24px">Order numbers: ${data.orderIds.map(o => '#' + escapeHtml(o)).join(', ')}</p>`
    : `<p style="font-size: 14px; color: #4a4a4a; margin-bottom: 24px">Order number: #${escapeHtml(primaryOrder)}</p>`;

  const itemRows = data.items.map(item => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px">
      <tbody><tr>
        <td width="80">
          ${item.imageUrl
            ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" width="80" height="80" style="width: 80px; height: 80px; border-radius: 8px; object-fit: cover; border: 1px solid #e8e8e8">`
            : `<div style="width: 80px; height: 80px; border-radius: 8px; background: #eff6ff; text-align: center; line-height: 80px; font-size: 32px">📦</div>`}
        </td>
        <td style="padding-left: 16px; font-size: 14px; color: #4a4a4a; line-height: 1.5">
          <strong style="color: #1a1a1a">${escapeHtml(item.title)}</strong><br>
          ${item.colorName ? `Color: ${escapeHtml(item.colorName)}<br>` : ''}
          ${item.sizeName ? `Size: ${escapeHtml(item.sizeName)}<br>` : ''}
          Quantity: ${escapeHtml(item.quantity)}
        </td>
        <td style="text-align: right; font-weight: 600; color: #1a1a1a">
          ${inr(item.unitPrice * item.quantity)}
        </td>
      </tr></tbody>
    </table>`).join('');

  const addressHtml = data.address ? `
      <h3 style="font-size: 16px; font-weight: 600; color: #1a1a1a; margin-bottom: 8px">Shipping to</h3>
      <p style="font-size: 14px; color: #4a4a4a; line-height: 1.5">
        ${escapeHtml(data.address.fullName || data.customerName)}<br>
        ${escapeHtml(data.address.line1 || '')}${data.address.line2 ? '<br>' + escapeHtml(data.address.line2) : ''}<br>
        ${escapeHtml(data.address.city || '')}, ${escapeHtml(data.address.state || '')} ${escapeHtml(data.address.pincode || '')}<br>
        ${escapeHtml(data.address.country || 'India')}
      </p>` : '';

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Your Shopi order is confirmed</title>
<style type="text/css">
  body, p, h1, h2, h3 { margin: 0; padding: 0; }
  body { background-color: #eff6ff; -webkit-text-size-adjust: 100%; }
  .ExternalClass { width: 100%; }
  table { border-collapse: collapse; }
  img { -ms-interpolation-mode: bicubic; }
</style></head>
<body style="margin: 0; padding: 32px 16px; background-color: #eff6ff">
  <div style="display: none; font-size: 1px; color: #eff6ff; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all">
    Your Shopi order has been confirmed and is on its way. Track your package below.
  </div>
  <table role="presentation" align="center" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border-collapse: separate; border-spacing: 0; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
    <tbody>
      <!-- Header -->
      <tr>
        <td style="padding: 24px 32px; text-align: center; border-bottom: 1px solid #e8e8e8">
          <span style="font-size: 22px; font-weight: 700; letter-spacing: 2px; color: #2563eb; font-family: Arial, sans-serif">SHOPI</span><br>
          <span style="font-size: 10px; letter-spacing: 2px; color: #94a3b8; font-family: Arial, sans-serif">AI-POWERED COMMERCE</span>
        </td>
      </tr>
      <!-- Main -->
      <tr>
        <td style="padding: 48px 32px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tbody>
              <tr>
                <td style="text-align: center; padding-bottom: 32px">
                  <div style="font-size: 40px; margin-bottom: 16px">🚚</div>
                  <h1 style="font-size: 28px; font-weight: 600; color: #1a1a1a; margin-bottom: 16px">Your order is confirmed, ${escapeHtml(data.customerName)}!</h1>
                  <p style="font-size: 15px; line-height: 1.5; color: #4a4a4a">
                    We've received your payment and your order is on its way. Track it every step below.
                  </p>
                </td>
              </tr>
              <!-- Progress tracker -->
              <tr>
                <td align="center">
                  <table cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; width: 100%; padding: 20px">
                    <tbody><tr>
                      <td align="center" style="width: 30%; text-align: center">
                        <div style="width: 40px; height: 40px; background-color: #2563eb; border-radius: 50%; text-align: center; line-height: 40px; color: #ffffff; font-size: 18px; font-weight: 700; display: inline-block">✓</div><br>
                        <span style="font-family: Arial, sans-serif; font-size: 13px; color: #333333">Confirmed</span>
                      </td>
                      <td align="center" style="vertical-align: middle"><div style="border-top: 2px solid #2563eb; width: 100%; height: 2px; margin-top: 20px"></div></td>
                      <td align="center" style="width: 30%; text-align: center">
                        <div style="width: 40px; height: 40px; background-color: #2563eb; border-radius: 50%; text-align: center; line-height: 40px; display: inline-block"><span style="font-size: 18px">📦</span></div><br>
                        <span style="font-family: Arial, sans-serif; font-size: 13px; font-weight: 600; color: #2563eb">Shipped</span>
                      </td>
                      <td align="center" style="vertical-align: middle"><div style="border-top: 2px solid #cbd5e1; width: 100%; height: 2px; margin-top: 20px"></div></td>
                      <td align="center" style="width: 30%; text-align: center">
                        <div style="width: 40px; height: 40px; border: 2px solid #cbd5e1; border-radius: 50%; text-align: center; line-height: 40px; display: inline-block"><span style="font-size: 16px; opacity: 0.5">🏠</span></div><br>
                        <span style="font-family: Arial, sans-serif; font-size: 13px; color: #94a3b8">Delivered</span>
                      </td>
                    </tr></tbody>
                  </table>
                </td>
              </tr>
              <!-- Delivery + tracking card -->
              <tr>
                <td style="padding-top: 24px">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 12px; border-collapse: separate; border-spacing: 0; overflow: hidden">
                    <tbody>
                      <tr>
                        <td style="padding: 24px 24px 8px; text-align: center">
                          <p style="font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; color: #2563eb; margin-bottom: 8px">Estimated delivery</p>
                          <p style="font-size: 22px; font-weight: 600; color: #1a1a1a">${fmtDate(winStart)} – ${fmtDate(winEnd)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 16px 24px 0">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #dbeafe">
                            <tbody>
                              <tr>
                                <td style="padding-top: 16px; font-size: 14px; color: #4a4a4a">Carrier</td>
                                <td style="padding-top: 16px; text-align: right; font-size: 14px; font-weight: 600; color: #1a1a1a">${escapeHtml(carrier)}</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0 24px; font-size: 14px; color: #4a4a4a">Tracking number</td>
                                <td style="padding: 8px 0 24px; text-align: right; font-size: 14px; font-weight: 600; color: #1a1a1a">${escapeHtml(data.trackingNumber)}</td>
                              </tr>
                              <tr>
                                <td style="padding: 0 0 24px; font-size: 14px; color: #4a4a4a">Amount paid</td>
                                <td style="padding: 0 0 24px; text-align: right; font-size: 14px; font-weight: 600; color: #1a1a1a">${inr(data.totalAmount)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 24px 28px; text-align: center">
                          <a href="${escapeHtml(storefront)}/orders" style="display: inline-block; padding: 12px 32px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 24px; font-size: 15px; font-weight: 500">Track Package</a>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              <!-- Items -->
              <tr>
                <td style="padding-top: 48px">
                  <h2 style="font-size: 22px; font-weight: 600; color: #1a1a1a; margin-bottom: 8px">What's in this shipment</h2>
                  ${multiNote}
                  ${itemRows}
                </td>
              </tr>
              <!-- Address -->
              ${addressHtml ? `
              <tr>
                <td>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e8e8e8">
                    <tbody><tr>
                      <td style="text-align: left; padding-top: 16px; vertical-align: top">${addressHtml}</td>
                      <td style="text-align: right; padding-top: 16px; vertical-align: top">
                        <h3 style="font-size: 16px; font-weight: 600; color: #1a1a1a; margin-bottom: 8px">Shipping method</h3>
                        <p style="font-size: 14px; color: #4a4a4a; line-height: 1.5">${escapeHtml(shippingMethod)}<br>${data.items.length} item${data.items.length === 1 ? '' : 's'}</p>
                      </td>
                    </tr></tbody>
                  </table>
                </td>
              </tr>` : ''}
            </tbody>
          </table>
        </td>
      </tr>
      <!-- Contact -->
      <tr>
        <td style="padding: 32px; background-color: #f8f8f8">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tbody><tr>
              <td width="33%" style="text-align: center">
                <div style="font-size: 24px; margin-bottom: 8px">💬</div>
                <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 4px">Chat</h3>
                <p style="font-size: 13px; color: #4a4a4a">${escapeHtml(storefront.replace(/^https?:\/\//, ''))}</p>
              </td>
              <td width="33%" style="text-align: center">
                <div style="font-size: 24px; margin-bottom: 8px">📞</div>
                <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 4px">Call</h3>
                <p style="font-size: 13px; color: #4a4a4a">1800-123-4567</p>
              </td>
              <td width="33%" style="text-align: center">
                <div style="font-size: 24px; margin-bottom: 8px">✉️</div>
                <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 4px">Email</h3>
                <p style="font-size: 13px; color: #4a4a4a">${escapeHtml(process.env.SMTP_SUPPORT || 'support@shopi.store')}</p>
              </td>
            </tr></tbody>
          </table>
        </td>
      </tr>
      <!-- Shop more -->
      <tr>
        <td style="padding: 40px 32px; text-align: center">
          <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin-bottom: 12px">While you wait, discover what's new</h2>
          <p style="font-size: 15px; line-height: 1.5; color: #4a4a4a; margin-bottom: 20px">Explore our latest arrivals — your AI shopping assistant can help you find your next favourite.</p>
          <a href="${escapeHtml(storefront)}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 24px; font-size: 15px; font-weight: 500">Continue Shopping</a>
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="padding: 32px; text-align: center; background-color: #1a1a1a; border-bottom-left-radius: 16px; border-bottom-right-radius: 16px">
          <span style="color: #ffffff; text-decoration: none; margin: 0 10px; font-size: 13px">SHOPI</span>
          <span style="color: #999999; font-size: 12px">·</span>
          <span style="color: #ffffff; text-decoration: none; margin: 0 10px; font-size: 13px">AI-Powered Commerce</span>
          <p style="text-align: center; color: #999999; font-size: 12px; line-height: 1.5; margin-top: 16px">
            © Shopi Store. All Rights Reserved.<br>
            This is a transactional order confirmation for order #${escapeHtml(primaryOrder)}.
          </p>
        </td>
      </tr>
    </tbody>
  </table>
</body></html>`;

  const text = `SHOPI — Order Confirmed (#${primaryOrder})

Hi ${data.customerName},

Your order is confirmed and on its way!
Estimated delivery: ${fmtDate(winStart)} – ${fmtDate(winEnd)}
Carrier: ${carrier}
Tracking number: ${data.trackingNumber}
Amount paid: ${inr(data.totalAmount)}

What's in this shipment:
${data.items.map(i => `- ${i.title} x${i.quantity} — ${inr(i.unitPrice * i.quantity)}`).join('\n')}

Track your order: ${storefront}/orders
Questions? ${process.env.SMTP_SUPPORT || 'support@shopi.store'}

Thank you for shopping with Shopi!`;

  return { html, text };
}

/**
 * Sends the order confirmation email. Fire-and-forget safe: failures are
 * logged but NEVER block or fail the checkout — the order is already placed.
 */
export async function sendOrderConfirmationEmail(data: OrderConfirmationEmailData): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  try {
    const email = String(process.env.EMAIL || process.env.SMTP_USER || '').trim();
    const password = String(process.env.PASSWORD || process.env.SMTP_PASS || '').trim();

    if (!email || !password) {
      console.warn('[OrderEmail] SMTP credentials not configured — order confirmation email skipped.');
      return { sent: false, error: 'SMTP not configured' };
    }
    if (!data.customerEmail || !/.+@.+\..+/.test(data.customerEmail)) {
      console.warn(`[OrderEmail] No valid customer email for order #${data.orderId} — confirmation skipped.`);
      return { sent: false, error: 'No valid recipient email' };
    }

    // service:'gmail' resolves smtp.gmail.com, whose AAAA record can make
    // Node dial IPv6 first — hosts without IPv6 egress (Render free tier)
    // then fail with 'connect ENETUNREACH 2607:f8b0:...:465'. IPv4-first
    // dialing is enforced globally at startup (dns.setDefaultResultOrder).
    // Port 587 + STARTTLS: the implicit-TLS 465 route timed out from Render's
    // egress ('Connection timeout' in logs); 587 is the Gmail MSA port.
    // The 587 dial is INTERMITTENT on Render's free egress (one observed
    // success among timeouts), so sendMail is retried with backoff.
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 30000,
      auth: { user: email, pass: password },
      tls: { rejectUnauthorized: true }
    });

    const { html, text } = renderOrderConfirmationEmail(data);

    const mail = {
      from: `"${process.env.SMTP_SENDERNAME || 'Shopi Store'}" <${email}>`,
      to: data.customerEmail,
      subject: `Order confirmed #${data.orderId} — your Shopi package is on its way 🚚`,
      text,
      html
    };

    let info: any = null;
    let lastErr: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        info = await transporter.sendMail(mail);
        break;
      } catch (e: any) {
        lastErr = e;
        console.warn(`[OrderEmail] order #${data.orderId} send attempt ${attempt}/3 failed: ${e.message}`);
        if (attempt < 3) await new Promise(r => setTimeout(r, 5000 * attempt));
      }
    }
    if (!info) throw lastErr;

    console.log(`[OrderEmail] Confirmation sent for order #${data.orderId} to ${data.customerEmail} (${info.messageId})`);
    return { sent: true, messageId: info.messageId };
  } catch (err: any) {
    console.error(`[OrderEmail] Failed to send confirmation for order #${data.orderId}:`, err.message);
    return { sent: false, error: err.message };
  }
}

export const orderEmailService = {
  sendOrderConfirmationEmail,
  renderOrderConfirmationEmail
};
