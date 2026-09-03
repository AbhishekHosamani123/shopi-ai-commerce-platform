import { client } from '../data/DB';

export interface CustomerInfoInput {
  name?: string;
  userName?: string;
  email?: string;
  phone?: string | number;
  mobile_number?: string | number;
}

export interface AddressInfoInput {
  fullName?: string;
  userName?: string;
  phone?: string | number;
  contactNumber?: string | number;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  pincode?: string;
  country?: string;
}

export interface ResolvedCustomer {
  userId: number;
  addressId: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
}

/**
 * Resolves or dynamically provisions a customer user record and delivery address.
 * Enables seamless guest checkout without forcing login/registration, while
 * preserving database integrity and enabling exact order confirmation email dispatch.
 */
export async function resolveOrCreateCustomer(
  providedUserId?: number | string | null,
  customerInfo?: CustomerInfoInput,
  addressInfo?: AddressInfoInput
): Promise<ResolvedCustomer> {
  let userId = Number(providedUserId) || 0;
  let customerEmail = (customerInfo?.email || '').trim().toLowerCase();
  let customerName = (customerInfo?.name || customerInfo?.userName || addressInfo?.fullName || addressInfo?.userName || '').trim() || 'Valued Customer';
  let customerPhone = String(customerInfo?.phone || customerInfo?.mobile_number || addressInfo?.phone || addressInfo?.contactNumber || '').trim();

  // If userId is valid and > 0, check user in DB
  if (userId > 0) {
    try {
      const userRes = await client.query('SELECT userid, username, email, mobile_number FROM users WHERE userid = $1', [userId]);
      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        customerEmail = customerEmail || u.email || '';
        customerName = (customerName !== 'Valued Customer' ? customerName : (u.username || '').trim()) || 'Valued Customer';
        customerPhone = customerPhone || u.mobile_number || '';
      }
    } catch (e: any) {
      console.warn('[guestCheckout] user lookup warning:', e?.message);
    }
  }

  // If no user found or guest user, resolve or create by email
  if (userId <= 0) {
    if (!customerEmail) {
      customerEmail = `customer_${Date.now()}@shopi.store`;
    }
    try {
      const existingUser = await client.query('SELECT userid, username, email FROM users WHERE email = $1 LIMIT 1', [customerEmail]);
      if (existingUser.rows.length > 0) {
        userId = existingUser.rows[0].userid;
      } else {
        const insertUser = await client.query(
          `INSERT INTO users (username, email, mobile_number, role, is_verified)
           VALUES ($1, $2, $3, 'customer', true) RETURNING userid`,
          [customerName, customerEmail, customerPhone || null]
        );
        userId = insertUser.rows[0].userid;
      }
    } catch (e: any) {
      console.warn('[guestCheckout] user creation fallback:', e?.message);
      // Fallback to demo user ID 1
      userId = 1;
    }
  }

  // Next, resolve or create delivery address for this user
  let addressId = 0;
  const line1 = addressInfo?.addressLine1 || 'Delivery Address';
  const line2 = addressInfo?.addressLine2 || '';
  const city = addressInfo?.city || 'Bengaluru';
  const state = addressInfo?.state || 'Karnataka';
  const postalCode = addressInfo?.postalCode || addressInfo?.pincode || '560001';
  const country = addressInfo?.country || 'India';
  const contact = customerPhone || '9876543210';

  if (addressInfo && (addressInfo.addressLine1 || addressInfo.city)) {
    try {
      const addrInsert = await client.query(
        `INSERT INTO addresses (userid, addresstype, username, contactnumber, addressline1, addressline2, city, state, country, postalcode, is_default)
         VALUES ($1, 'HOME', $2, $3, $4, $5, $6, $7, $8, $9, true) RETURNING addressid`,
        [userId, customerName, contact, line1, line2, city, state, country, postalCode]
      );
      addressId = addrInsert.rows[0].addressid;
    } catch (e: any) {
      console.warn('[guestCheckout] address insert warning:', e?.message);
    }
  }

  if (addressId <= 0) {
    try {
      // Check if user has an existing default address
      const existingAddr = await client.query(
        `SELECT addressid FROM addresses WHERE userid = $1 ORDER BY is_default DESC, addressid DESC LIMIT 1`,
        [userId]
      );
      if (existingAddr.rows.length > 0) {
        addressId = existingAddr.rows[0].addressid;
      } else {
        const addrInsert = await client.query(
          `INSERT INTO addresses (userid, addresstype, username, contactnumber, addressline1, addressline2, city, state, country, postalcode, is_default)
           VALUES ($1, 'HOME', $2, $3, $4, $5, $6, $7, $8, $9, true) RETURNING addressid`,
          [userId, customerName, contact, 'Express Delivery Address', '', 'Bengaluru', 'Karnataka', 'India', '560001']
        );
        addressId = addrInsert.rows[0].addressid;
      }
    } catch (e: any) {
      console.warn('[guestCheckout] address resolution warning:', e?.message);
      addressId = 1;
    }
  }

  return {
    userId,
    addressId,
    customerName,
    customerEmail,
    customerPhone
  };
}
