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

/** Loads item data for a set of legacy order ids. */
async function loadLegacyOrderItems(orderIds: number[]): Promise<OrderEmailItem[]> {
  const res = await client.query(`
    SELECT oi.productid, oi.quantity,
           p.title, p.imgid, p.price, p.discount,
           pc.colorname, ps.sizename
    FROM orderitems oi
    JOIN products p ON p.productid = oi.productid
    LEFT JOIN productcolors pc ON pc.productid = oi.productid AND pc.colorid = oi.colorid
    LEFT JOIN productsizes ps ON ps.productid = oi.productid AND ps.sizeid = oi.sizeid
    WHERE oi.orderid = ANY($1::int[]);
  `, [orderIds]);

  const items: OrderEmailItem[] = [];
  for (const r of res.rows) {
    // discount holds the effective unit price in this schema
    const unitPrice = parseFloat(r.discount ?? r.price ?? 0) || 0;
    items.push({
      productId: r.productid,
      title: r.title || 'Shopi Product',
      imageUrl: r.imgid ? `https://picsum.photos/seed/${encodeURIComponent(String(r.imgid))}/160/160` : null,
      quantity: parseInt(r.quantity, 10) || 1,
      unitPrice,
      colorName: r.colorname || null,
      sizeName: r.sizename !== undefined && r.sizename !== null ? String(r.sizename) : null
    });
  }
  return items;
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
    const items = await loadLegacyOrderItems(numericIds);
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
      WHERE o.orderid = ANY($1::int[])
      ORDER BY o.orderid
    `, [numericIds]);
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
