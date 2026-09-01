import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';

// Resolve .env from ecommerce-backend directory as well as process cwd
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const isRemoteDb =
  (process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1') ||
  (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1'));

const poolConfig: any = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
    }
  : {
      user: String(process.env.DB_USER || 'postgres'),
      password: String(process.env.DB_PASS || '1234'),
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'razorpay_ecommerce',
      ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
    };

poolConfig.max = 10;
poolConfig.idleTimeoutMillis = 30000;
poolConfig.connectionTimeoutMillis = 10000;

const client = new Pool(poolConfig);

const CORE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
    userid SERIAL PRIMARY KEY,
    username VARCHAR(100),
    email VARCHAR(255),
    password VARCHAR(255),
    mobile_number VARCHAR(30),
    dob VARCHAR(30),
    is_verified BOOLEAN DEFAULT true,
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Idempotent backfill of columns the auth flows rely on (role, otp, IP
-- tracking, promotional flag).  Fresh databases (Render) create the base
-- table above with only the core columns; these ALTERs bring it up to the
-- full shape the signup/signin/merchant-login code expects without failing
-- on databases that already have them.
ALTER TABLE users ADD COLUMN IF NOT EXISTS creation_ip INET;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'customer';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS update_ip INET;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp VARCHAR(4);
ALTER TABLE users ADD COLUMN IF NOT EXISTS promotional BOOLEAN;

-- PostgreSQL has no "ADD CONSTRAINT IF NOT EXISTS"; use a DO block so the
-- unique keys are created only on fresh databases (Render) and never error
-- on databases that already have them.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key') THEN
        ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_mobile_number_key') THEN
        ALTER TABLE users ADD CONSTRAINT users_mobile_number_key UNIQUE (mobile_number);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS categories (
    categoryid SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    maincategory VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
    productid VARCHAR(100) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    categoryid INT,
    price NUMERIC(10,2) DEFAULT 0,
    discount NUMERIC(10,2) DEFAULT 0,
    stock INT DEFAULT 100,
    tags VARCHAR(255),
    imgid VARCHAR(100),
    seller_id INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS productimages (
    imageid VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    productid VARCHAR(100),
    imglink TEXT,
    imgalt VARCHAR(255),
    isprimary BOOLEAN DEFAULT false,
    color VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS productcolors (
    colorid SERIAL PRIMARY KEY,
    productid VARCHAR(100),
    colorname VARCHAR(100),
    colorclass VARCHAR(100),
    imglink TEXT
);

CREATE TABLE IF NOT EXISTS productsizes (
    sizeid SERIAL PRIMARY KEY,
    productid VARCHAR(100),
    sizename VARCHAR(50),
    instock BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS productparams (
    productid VARCHAR(100) PRIMARY KEY,
    stars NUMERIC(3,2) DEFAULT 4.5,
    issale BOOLEAN DEFAULT false,
    isnew BOOLEAN DEFAULT false,
    isdiscount BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS cartitems (
    cartitemid SERIAL PRIMARY KEY,
    userid INT NOT NULL,
    productid VARCHAR(100) NOT NULL,
    quantity INT DEFAULT 1,
    sizeid INT,
    colorid INT,
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wishlistitems (
    wishlistid SERIAL PRIMARY KEY,
    userid INT NOT NULL,
    productid VARCHAR(100) NOT NULL,
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS addresses (
    addressid SERIAL PRIMARY KEY,
    userid INT NOT NULL,
    name VARCHAR(100),
    phonenumber VARCHAR(30),
    pincode VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    landmark VARCHAR(100),
    isdefault BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS banners (
    bannerid SERIAL PRIMARY KEY,
    title VARCHAR(255),
    subtitle VARCHAR(255),
    imageurl TEXT,
    link VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS coupons (
    couponid SERIAL PRIMARY KEY,
    couponcode VARCHAR(50) UNIQUE,
    discountpercentage NUMERIC(5,2) DEFAULT 10,
    minorderamount NUMERIC(10,2) DEFAULT 500,
    maxdiscount NUMERIC(10,2) DEFAULT 1000,
    isactive BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS orders (
    orderid VARCHAR(100) PRIMARY KEY,
    userid INT NOT NULL,
    totalamount NUMERIC(10,2) NOT NULL,
    paymentid VARCHAR(100),
    paymentstatus VARCHAR(50),
    addressid INT,
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orderitems (
    orderitemid SERIAL PRIMARY KEY,
    orderid VARCHAR(100) NOT NULL,
    productid VARCHAR(100) NOT NULL,
    quantity INT DEFAULT 1,
    price NUMERIC(10,2) NOT NULL,
    sizeid INT,
    colorid INT
);

CREATE TABLE IF NOT EXISTS reviews (
    reviewid SERIAL PRIMARY KEY,
    productid VARCHAR(100) NOT NULL,
    userid INT,
    rating NUMERIC(2,1) DEFAULT 5.0,
    title VARCHAR(255),
    comment TEXT,
    username VARCHAR(100),
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_daily_metrics (
    metric_date DATE PRIMARY KEY,
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_units_sold INTEGER NOT NULL DEFAULT 0,
    gross_revenue NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    total_discounts NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    total_refunds NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    net_revenue NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    total_cancellations INTEGER NOT NULL DEFAULT 0,
    total_returns INTEGER NOT NULL DEFAULT 0,
    average_order_value NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    source VARCHAR(64) DEFAULT 'merchant_ai_demo_seed',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_product_daily_metrics (
    metric_id SERIAL PRIMARY KEY,
    metric_date DATE NOT NULL,
    productid VARCHAR(100) NOT NULL,
    units_sold INTEGER NOT NULL DEFAULT 0,
    gross_revenue NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    orders_count INTEGER NOT NULL DEFAULT 0,
    returns_count INTEGER NOT NULL DEFAULT 0,
    refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    closing_stock INTEGER NOT NULL DEFAULT 0,
    sales_velocity_7d NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    source VARCHAR(64) DEFAULT 'merchant_ai_demo_seed',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    movement_id SERIAL PRIMARY KEY,
    productid VARCHAR(100) NOT NULL,
    sizeid INTEGER,
    movement_type VARCHAR(32) NOT NULL,
    quantity INTEGER NOT NULL,
    stock_before INTEGER NOT NULL,
    stock_after INTEGER NOT NULL,
    reference_type VARCHAR(32),
    reference_id VARCHAR(64),
    notes TEXT,
    source VARCHAR(64) DEFAULT 'merchant_ai_demo_seed',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_returns (
    return_id SERIAL PRIMARY KEY,
    orderid VARCHAR(100) NOT NULL,
    orderitemid INTEGER,
    productid VARCHAR(100) NOT NULL,
    userid INTEGER,
    quantity INTEGER NOT NULL DEFAULT 1,
    return_reason VARCHAR(64) NOT NULL,
    refund_amount NUMERIC(12,2) NOT NULL,
    return_status VARCHAR(32) NOT NULL DEFAULT 'Completed',
    is_restocked BOOLEAN NOT NULL DEFAULT TRUE,
    source VARCHAR(64) DEFAULT 'merchant_ai_demo_seed',
    createdat TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_cancellations (
    cancellation_id SERIAL PRIMARY KEY,
    orderid VARCHAR(100) NOT NULL,
    userid INTEGER,
    reason VARCHAR(128) NOT NULL,
    refund_status VARCHAR(32) NOT NULL DEFAULT 'Refunded',
    source VARCHAR(64) DEFAULT 'merchant_ai_demo_seed',
    cancelled_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_campaigns (
    campaign_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(64),
    target_segment VARCHAR(64),
    channel VARCHAR(32),
    status VARCHAR(32) DEFAULT 'Draft',
    budget NUMERIC(10,2) DEFAULT 0,
    revenue_generated NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_ai_actions (
    action_id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    action_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_APPROVAL',
    product_id VARCHAR(100),
    product_name VARCHAR(255),
    quantity INTEGER,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    approved_by VARCHAR(64),
    execution_result JSONB,
    failure_reason TEXT,
    is_test BOOLEAN DEFAULT FALSE,
    idempotency_key VARCHAR(128)
);

CREATE TABLE IF NOT EXISTS merchant_business_impact_ledger (
    impact_id SERIAL PRIMARY KEY,
    action_id VARCHAR(64),
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    observation_window_days INTEGER DEFAULT 14,
    baseline_metrics JSONB DEFAULT '{}'::jsonb,
    post_action_metrics JSONB DEFAULT '{}'::jsonb,
    expected_impact JSONB DEFAULT '{}'::jsonb,
    actual_impact JSONB DEFAULT '{}'::jsonb,
    impact_delta_pct NUMERIC(8,2) DEFAULT 0.00,
    confidence_at_recommendation NUMERIC(5,2) DEFAULT 0.85,
    final_outcome VARCHAR(32) DEFAULT 'PENDING',
    outcome_status VARCHAR(32) DEFAULT 'OBSERVING',
    negative_analysis JSONB DEFAULT '{}'::jsonb,
    evaluated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS merchant_action_audits (
    audit_id SERIAL PRIMARY KEY,
    action_id VARCHAR(64),
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    event_type VARCHAR(64) NOT NULL,
    performed_by VARCHAR(64) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

/**
 * Idempotent database self-healing for the merchant analytics dataset.
 *
 * Render's free managed Postgres is periodically wiped/reset WITHOUT
 * redeploying the app (the Node process keeps running). Because the
 * bootstrap previously ran only at process startup, the service stayed
 * broken (every merchant query 500s with "relation does not exist") until
 * someone manually redeployed.
 *
 * This function is safe to call at any time — from startup AND from request
 * paths. A single-flight guard ensures concurrent callers wait for the same
 * recovery run instead of triggering overlapping seeds.
 */
let recoveryInFlight: Promise<void> | null = null;
let lastRecoveryAt = 0;
const RECOVERY_COOLDOWN_MS = 60_000; // don't re-check more than once a minute

async function ensureMerchantDataReady(trigger: string): Promise<void> {
  // Fast path: if the dataset verified healthy recently, skip.
  if (Date.now() - lastRecoveryAt < RECOVERY_COOLDOWN_MS) return;

  if (recoveryInFlight) {
    // Another request is already recovering — wait for it, don't stack seeds.
    await recoveryInFlight;
    return;
  }

  recoveryInFlight = (async () => {
    try {
      // 1. Core schema (users, cartitems, etc.) + auth columns.
      await client.query(CORE_SCHEMA_SQL);
      console.log(`[DB Recovery:${trigger}] Core schema ensured.`);

      // 2. Test accounts (merchant admin + demo customer).
      try {
        const { seedTestAccounts } = await import('./seedTestAccounts');
        await seedTestAccounts();
      } catch (e: any) {
        console.warn(`[DB Recovery:${trigger}] Test accounts skipped:`, e.message);
      }

      // 3. Analytics indexes.
      try {
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_shopi_orders_status_date ON shopi_orders (order_status, order_placed_at);
          CREATE INDEX IF NOT EXISTS idx_shopi_returns_created ON shopi_order_returns (created_at);
          CREATE INDEX IF NOT EXISTS idx_shopi_events_cust_type_time ON shopi_customer_events (customer_id, event_type, event_timestamp);
          CREATE INDEX IF NOT EXISTS idx_shopi_orderitems_order_product ON shopi_order_items (order_id, product_id);
        `);
      } catch (e: any) {
        console.warn(`[DB Recovery:${trigger}] Index bootstrap skipped:`, e.message);
      }

      // 4. Phase 11B commerce dataset (orders, customers, events, COGS...).
      const check = await client.query("SELECT to_regclass('public.shopi_orders') as exists;");
      let needsMigration = !check.rows[0]?.exists;
      if (!needsMigration) {
        const countRes = await client.query('SELECT COUNT(*) FROM shopi_orders');
        needsMigration = parseInt(countRes.rows[0].count, 10) === 0;
      }

      if (needsMigration) {
        console.log(`[DB Recovery:${trigger}] shopi dataset missing — running Phase 11B seed...`);
        const { runPhase11bMigration } = await import('./phase11b_migration');
        await runPhase11bMigration();
        console.log(`[DB Recovery:${trigger}] Phase 11B dataset seeded successfully.`);
      } else {
        console.log(`[DB Recovery:${trigger}] shopi dataset verified.`);
      }

      lastRecoveryAt = Date.now();
    } finally {
      recoveryInFlight = null;
    }
  })();

  await recoveryInFlight;
}

/**
 * Request-driven DB recovery hook. Call when a merchant query fails with a
 * missing-relation error; it (re)creates schema + data in the background and
 * returns once the dataset is ready. The cooldown guard prevents a broken
 * DB from causing a seed stampede.
 */
export async function recoverMerchantDataIfMissing(): Promise<boolean> {
  try {
    const check = await client.query("SELECT to_regclass('public.shopi_orders') as exists;");
    const exists = !!check.rows[0]?.exists;
    if (!exists) {
      await ensureMerchantDataReady('request');
      return true; // recovery ran
    }
    // Table exists — check it has data
    const countRes = await client.query('SELECT COUNT(*) FROM shopi_orders');
    if (parseInt(countRes.rows[0].count, 10) === 0) {
      await ensureMerchantDataReady('request-empty');
      return true;
    }
    return false;
  } catch (e: any) {
    console.warn('[DB Recovery] Health probe failed:', e.message);
    return false;
  }
}

const connectDB = async () => {
  try {
    await client.query('SELECT 1');
    console.log('[DB Info] Connected to PostgreSQL database successfully.');

    // Bootstrap/heal everything (schema, accounts, indexes, dataset).
    // Runs in the foreground at boot so the service is ready before the
    // first request; request-driven recovery covers later DB resets.
    await ensureMerchantDataReady('startup');
  } catch (err: any) {
    console.log('[DB Info] PostgreSQL offline or fallback mode:', err.message);
  }
};

export { client, connectDB };
