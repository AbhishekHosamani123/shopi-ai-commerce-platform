import { client } from '../data/DB';
import { sendOrderConfirmationEmail, OrderConfirmationEmailData, OrderEmailItem } from './order-confirmation-email';

/**
 * Gathers everything needed for the order-confirmation email from the
 * canonical tables (customer, items, prices, address, tracking) and sends it.
 * Fire-and-forget: NEVER blocks or fails a completed checkout.
 *
 * Queries match the REAL legacy schema:
 *   users(username, email) · addresses(username, addressline1/2, city, state,
 *   postalcode, country) · products(title, imgid, price, discount) ·
 *   productcolors(colorname) · productsizes(sizename)
 */

/** Loads item data for a set of legacy order ids (strings — orderid is VARCHAR). */
async function loadLegacyOrderItems(orderIds: string[]): Promise<OrderEmailItem[]> {
  // Read raw order items first; product enrichment happens per item so a
  // product missing from the legacy products table (live catalog only) still
  // shows in the email — the old INNER JOIN products dropped such orders
  // entirely ('No order items found for orders 13 — skipped' in production).
  const raw = await client.query(`
    SELECT oi.productid, oi.quantity, oi.colorid, oi.sizeid
    FROM orderitems oi
    WHERE oi.orderid = ANY($1::text[]);
  `, [orderIds]);

  const items: OrderEmailItem[] = [];
  for (const r of raw.rows) {
    let title = String(r.productid);
    let unitPrice = 0;
    let imgid: string | null = null;
    let colorName: string | null = null;
    let sizeName: string | null = null;

    // Legacy products row first (carries canonical price + variant names).
    try {
      const p = await client.query(`
        SELECT p.title, p.imgid, p.price, p.discount,
               pc.colorname, ps.sizename
        FROM products p
        LEFT JOIN productcolors pc ON pc.productid = p.productid AND pc.colorid = $2
        LEFT JOIN productsizes ps ON ps.productid = p.productid AND ps.sizeid = $3
        WHERE p.productid = $1
      `, [r.productid, r.colorid, r.sizeid]);
      if (p.rows.length > 0) {
        title = p.rows[0].title || title;
        unitPrice = parseFloat(p.rows[0].discount ?? p.rows[0].price ?? 0) || 0;
        imgid = p.rows[0].imgid;
        colorName = p.rows[0].colorname || null;
        sizeName = p.rows[0].sizename != null ? String(p.rows[0].sizename) : null;
      }
    } catch { /* per-item legacy lookup is best-effort */ }

    // Catalog fallback when the legacy row is absent.
    if (unitPrice === 0 || title === String(r.productid)) {
      try {
        const { default: ShopiCatalogService } = await import('../data/shopiCatalogService');
        const supProd = await ShopiCatalogService.getProduct(String(r.productid));
        if (supProd) {
          title = supProd.title || title;
          unitPrice = parseFloat(String(supProd.selling_price ?? supProd.discount ?? supProd.price ?? 0)) || unitPrice;
          const c = supProd.colors?.find((x: any) => Number(x.colorid) === Number(r.colorid));
          const s = supProd.sizes?.find((x: any) => Number(x.sizeid) === Number(r.sizeid));
          colorName = colorName || (c?.colorname ?? supProd.colors?.[0]?.colorname ?? null);
          sizeName = sizeName || (s?.sizename ?? supProd.sizes?.[0]?.sizename ?? null);
        }
      } catch { /* catalog fallback is best-effort */ }
    }

    items.push({
      productId: r.productid,
      title: title || 'Shopi Product',
      imageUrl: imgid ? `https://picsum.photos/seed/${encodeURIComponent(String(imgid))}/160/160` : null,
      quantity: parseInt(r.quantity, 10) || 1,
      unitPrice,
      colorName,
      sizeName
    });
  }
  return items;
}

/**
 * Resolves the active storefront URL prioritizing caller-provided URL,
 * environment config (STOREFRONT_BASE_URL / FRONTEND_SERVER_ORIGIN),
 * and the deployed Vercel domain.
 */
export function resolveStorefrontUrl(explicitUrl?: string): string {
  if (explicitUrl && /^https?:\/\//i.test(explicitUrl.trim())) {
    return explicitUrl.trim().replace(/\/+$/, '');
  }
  const envUrl = process.env.STOREFRONT_BASE_URL || process.env.FRONTEND_SERVER_ORIGIN;
  if (envUrl) {
    const firstOrigin = envUrl.split(',')[0].trim();
    if (/^https?:\/\//i.test(firstOrigin)) {
      return firstOrigin.replace(/\/+$/, '');
    }
  }
  return 'https://shopi-ai-commerce-platform-shop-two.vercel.app';
}

/**
 * Builds and sends the confirmation email for one or more legacy orders.
 * Call AFTER the transaction commits so the order rows exist.
 */
export async function dispatchOrderConfirmationEmail(
  userid: number | string,
  orderIds: (number | string)[],
  extra?: Partial<OrderConfirmationEmailData>
): Promise<void> {
  try {
    if (!orderIds || orderIds.length === 0) return;
    const numericIds = orderIds.map(o => parseInt(String(o), 10)).filter(n => Number.isFinite(n));
    if (numericIds.length === 0) return;
    // orderid columns are VARCHAR — pass string ids for ::text[] comparison.
    const idStrings = numericIds.map(String);

    // Customer email + name
    const custRes = await client.query(
      `SELECT email, username FROM users WHERE userid = $1`,
      [userid]
    );
    const customerEmail = custRes.rows[0]?.email;
    const customerName = (custRes.rows[0]?.username || '').trim() || 'Valued Customer';
    if (!customerEmail || !/.+@.+\..+/.test(customerEmail)) {
      console.warn(`[OrderEmail] User ${userid} has no valid email — confirmation skipped.`);
      return;
    }

    // Items
    const items = await loadLegacyOrderItems(idStrings);
    if (items.length === 0) {
      console.warn(`[OrderEmail] No order items found for orders ${numericIds.join(',')} — skipped.`);
      return;
    }

    // Totals + tracking + address from the shipping row
    const ordRes = await client.query(`
      SELECT o.orderid, o.totalamount, s.trackingnumber, s.shippingmethod, s.shippingcost,
             s.addressid
      FROM orders o
      JOIN shipping s ON s.orderid = o.orderid
      WHERE o.orderid = ANY($1::text[])
      ORDER BY o.orderid
    `, [idStrings]);
    if (ordRes.rows.length === 0) return;

    const totalAmount = ordRes.rows.reduce((sum: number, r: any) => sum + parseFloat(r.totalamount || 0), 0);
    const first = ordRes.rows[0];

    // Shipping address
    const addrRes = await client.query(
      `SELECT username, contactnumber, addressline1, addressline2, city, state, postalcode, country
       FROM addresses WHERE addressid = $1`,
      [first.addressid]
    ).catch(() => ({ rows: [] as any[] }));
    const a = addrRes.rows[0];

    const data: OrderConfirmationEmailData = {
      customerName,
      customerEmail,
      orderId: orderIds[0],
      orderIds,
      items,
      totalAmount,
      shippingCharge: parseFloat(first.shippingcost || 0) || 0,
      trackingNumber: first.trackingnumber || `IN-${orderIds[0]}`,
      shippingMethod: first.shippingmethod || undefined,
      storefrontUrl: resolveStorefrontUrl(extra?.storefrontUrl),
      address: a ? {
        fullName: a.username,
        line1: a.addressline1,
        line2: a.addressline2,
        city: a.city,
        state: a.state,
        pincode: a.postalcode,
        country: a.country,
        phone: a.contactnumber ? String(a.contactnumber) : undefined
      } : null,
      ...extra
    };

    void sendOrderConfirmationEmail(data);
  } catch (err: any) {
    console.error('[OrderEmail] dispatchOrderConfirmationEmail failed (checkout unaffected):', err.message);
  }
}
