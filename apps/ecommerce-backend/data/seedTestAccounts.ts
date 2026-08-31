import { client } from './DB';
import bcrypt from 'bcryptjs';

/**
 * Idempotent bootstrap of development/test accounts.
 *
 * Fresh Render-managed databases start empty — the demo customer and the
 * merchant admin account only existed in the local database. This ensures a
 * newly provisioned database always has the documented test credentials so
 * the app is immediately usable after deploy.
 *
 * Passwords may be overridden per environment:
 *   TEST_MERCHANT_PASSWORD  (default: Merchant@123)
 *   TEST_CUSTOMER_PASSWORD  (default: 12345678)
 *
 * These are DEVELOPMENT/TEST credentials only — never reuse for production.
 */
export async function seedTestAccounts(): Promise<void> {
  try {
    const saltRounds = 10;
    const merchantPassword = process.env.TEST_MERCHANT_PASSWORD || 'Merchant@123';
    const customerPassword = process.env.TEST_CUSTOMER_PASSWORD || '12345678';

    const merchantHash = await bcrypt.hash(merchantPassword, saltRounds);
    const customerHash = await bcrypt.hash(customerPassword, saltRounds);

    // Merchant/Admin account (role-gated: merchant_login only accepts these)
    await client.query(
      `INSERT INTO users (username, email, password, mobile_number, dob, role, creation_ip)
       VALUES ('merchant_admin', 'merchant@shopi.com', $1, '9812345670', '1990-01-01', 'merchant_admin', '127.0.0.1')
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role;`,
      [merchantHash]
    );

    // Demo Customer account
    await client.query(
      `INSERT INTO users (username, email, password, mobile_number, dob, role, creation_ip)
       VALUES ('Demo Account', 'demo@demo.com', $1, '5345244353', '2024-07-16', 'customer', '127.0.0.1')
       ON CONFLICT (email) DO NOTHING;`,
      [customerHash]
    );

    console.log('[DB Info] Test accounts verified (merchant_admin + demo customer).');
  } catch (e: any) {
    console.warn('[DB Info] Test account bootstrap skipped:', e.message);
  }
}
