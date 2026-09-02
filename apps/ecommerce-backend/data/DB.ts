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
-- Column reconciliation: the application code (and the local reference
-- database) expects updatedat on cartitems; older recovery shapes lack it.
ALTER TABLE cartitems ADD COLUMN IF NOT EXISTS updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS wishlistitems (
    wishlistitemid SERIAL PRIMARY KEY,
    userid INT NOT NULL,
    productid VARCHAR(100) NOT NULL,
    addedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Reconcile older shapes that used wishlistid/createdat.
ALTER TABLE wishlistitems ADD COLUMN IF NOT EXISTS wishlistitemid SERIAL;
ALTER TABLE wishlistitems ADD COLUMN IF NOT EXISTS addedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS addresses (
    addressid SERIAL PRIMARY KEY,
    userid INT NOT NULL,
    addresstype VARCHAR(30),
    username VARCHAR(100),
    contactnumber VARCHAR(30),
    addressline1 TEXT,
    addressline2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postalcode VARCHAR(20),
    is_default BOOLEAN DEFAULT false,
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Column reconciliation: databases created by an older CORE_SCHEMA_SQL have
-- the legacy address column names (name/phonenumber/pincode/address/isdefault)
-- which every application query (fetchAddresses, userParams, checkout) does
-- NOT use — after a Render DB reset that shape made /user/all-data 500 with
-- 'column addresstype does not exist'. Idempotently add the expected columns;
-- legacy columns are left in place (harmless) to avoid destructive migration.
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS addresstype VARCHAR(30);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS contactnumber VARCHAR(30);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS addressline1 TEXT;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS addressline2 TEXT;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS postalcode VARCHAR(20);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS banners (
    bannerid SERIAL PRIMARY KEY,
    title VARCHAR(255),
    subtitle VARCHAR(255),
    imageurl TEXT,
    link VARCHAR(255)
);

-- Coupons is created ONCE here with the full application shape (the shape
-- every user-coupon query uses: code, description, maxdiscountamount,
-- minpurchaseamount, validfrom, validuntil). An earlier fix replaced this
-- CREATE with bare ALTERs — correct for DBs already carrying the legacy
-- shape, but FATAL on a fully wiped database where coupons does not exist:
-- the leading ALTER failed and aborted the ENTIRE core-schema batch, so
-- recovery could never rebuild anything (observed on Render).
CREATE TABLE IF NOT EXISTS coupons (
    couponid SERIAL PRIMARY KEY,
    couponcode VARCHAR(50) UNIQUE,
    code VARCHAR(50),
    description VARCHAR(255),
    discountpercentage NUMERIC(5,2) DEFAULT 10,
    minorderamount NUMERIC(10,2) DEFAULT 500,
    maxdiscount NUMERIC(10,2) DEFAULT 1000,
    maxdiscountamount NUMERIC(10,2) DEFAULT 1000,
    minpurchaseamount NUMERIC(10,2) DEFAULT 500,
    validfrom TIMESTAMP,
    validuntil TIMESTAMP,
    isactive BOOLEAN DEFAULT true,
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Reconcile legacy-shape tables that already exist from older deployments
-- (couponcode-only): the columns fetchCoupons queries are added idempotently.
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS description VARCHAR(255);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS maxdiscountamount NUMERIC(10,2) DEFAULT 1000;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS minpurchaseamount NUMERIC(10,2) DEFAULT 500;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS validfrom TIMESTAMP;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS validuntil TIMESTAMP;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS orders (
    orderid VARCHAR(100) PRIMARY KEY,
    userid INT NOT NULL,
    totalamount NUMERIC(10,2) NOT NULL,
    orderstatus VARCHAR(50),
    paymentid VARCHAR(100),
    addressid INT,
    order_code VARCHAR(100),
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Reconcile older shapes (paymentstatus instead of orderstatus, no updatedat/order_code).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS orderstatus VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_code VARCHAR(100);
-- Legacy orders tables (older recoveries / merchant-ai-schema era) carry
-- orderid WITHOUT a default, so the checkout INSERT (which omits orderid)
-- failed with 'null value in column orderid violates not-null constraint'
-- (observed on Render). Attach an auto-id sequence when the column has no
-- default. Sequence starts past the largest NUMERIC orderid present
-- (non-numeric legacy ids like UUIDs cannot collide with an integer
-- sequence that starts above every existing numeric id; if none are
-- numeric it starts at 1).
DO $$
DECLARE
  max_numeric BIGINT;
  seq_name TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'orderid' AND column_default IS NULL
  ) THEN
    CREATE SEQUENCE IF NOT EXISTS orders_orderid_seq;
    SELECT COALESCE(MAX(orderid::bigint), 0) INTO max_numeric
      FROM (SELECT orderid FROM orders WHERE orderid ~ '^[0-9]+$') numeric_ids;
    PERFORM setval('orders_orderid_seq', max_numeric + 1, false);
    seq_name := 'orders_orderid_seq';
    EXECUTE format('ALTER TABLE orders ALTER COLUMN orderid SET DEFAULT nextval(%L)', seq_name);
  END IF;
END $$;

-- ── Checkout-transaction tables ────────────────────────────────────────────
-- The cart/product checkout transactions INSERT into shipping, payments and
-- orderitems. shipping and payments were NEVER created by this recovery, so
-- after every Render DB reset the checkout 500'd with 'Database transaction
-- error' (the transaction aborted on the first INSERT INTO shipping) and the
-- order-confirmation email — which fires only AFTER a successful commit —
-- never sent. Shapes mirror the application reference database exactly.
CREATE TABLE IF NOT EXISTS shipping (
    shippingid SERIAL PRIMARY KEY,
    orderid VARCHAR(100),
    addressid INT,
    shippingmethod VARCHAR(50),
    shippingcost NUMERIC(10,2),
    trackingnumber VARCHAR(100),
    shippedat TIMESTAMP,
    deliveredat TIMESTAMP,
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS payments (
    paymentid SERIAL PRIMARY KEY,
    orderid VARCHAR(100),
    paymentmethod VARCHAR(50),
    paymentstatus VARCHAR(50),
    amount NUMERIC(10,2) NOT NULL,
    transactionid VARCHAR(100),
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    billingaddress INT,
    paymentgateway_id VARCHAR(100),
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    razorpay_signature VARCHAR(255)
);

-- productparams: the checkout transaction increments the sold counter,
-- which older recovery shapes lacked — reconcile it (plus views/rating
-- used by product listing queries).
ALTER TABLE productparams ADD COLUMN IF NOT EXISTS sold INT DEFAULT 0;
ALTER TABLE productparams ADD COLUMN IF NOT EXISTS views INT DEFAULT 0;
ALTER TABLE productparams ADD COLUMN IF NOT EXISTS rating INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS orderitems (
    orderitemid SERIAL PRIMARY KEY,
    orderid VARCHAR(100) NOT NULL,
    productid VARCHAR(100) NOT NULL,
    quantity INT DEFAULT 1,
    -- price is nullable in practice: the checkout transactions INSERT
    -- (orderid, productid, quantity, shippingid, paymentid, colorid, sizeid)
    -- WITHOUT price — a NOT NULL price made every order 500 after a reset.
    price NUMERIC(10,2),
    sizeid INT,
    colorid INT,
    shippingid INT,
    paymentid INT
);
-- Reconcile legacy orderitems shapes from older recoveries.
ALTER TABLE orderitems ADD COLUMN IF NOT EXISTS shippingid INT;
ALTER TABLE orderitems ADD COLUMN IF NOT EXISTS paymentid INT;

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
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ── Commerce support tables the application queries but the recovery never
-- created (they previously only existed on the local reference database, so
-- fresh Render databases 500'd on coupon/giftcard/checkout-card paths). ──
CREATE TABLE IF NOT EXISTS usercoupons (
    usercouponid SERIAL PRIMARY KEY,
    userid INT NOT NULL,
    couponid INT NOT NULL,
    usedat TIMESTAMP,
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE usercoupons ADD COLUMN IF NOT EXISTS usercouponid SERIAL;
ALTER TABLE usercoupons ADD COLUMN IF NOT EXISTS usedat TIMESTAMP;
ALTER TABLE usercoupons ADD COLUMN IF NOT EXISTS updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- (coupons is created with its full shape once, earlier in this script.)

CREATE TABLE IF NOT EXISTS giftcards (
    cardid SERIAL PRIMARY KEY,
    cardname VARCHAR(100),
    cardcode VARCHAR(64),
    description VARCHAR(255),
    balance NUMERIC(10,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'INR',
    expirydate TIMESTAMP,
    recipientname VARCHAR(100),
    recipientemail VARCHAR(255),
    sendername VARCHAR(100),
    senderemail VARCHAR(255),
    message TEXT,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE giftcards ADD COLUMN IF NOT EXISTS recipientname VARCHAR(100);
ALTER TABLE giftcards ADD COLUMN IF NOT EXISTS senderemail VARCHAR(100);
ALTER TABLE giftcards ADD COLUMN IF NOT EXISTS updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS savedpaymentcards (
    cardid SERIAL PRIMARY KEY,
    userid INT NOT NULL,
    cardnumber VARCHAR(64),
    cardholdername VARCHAR(100),
    expirymonth INT,
    expiryyear INT,
    cardtype VARCHAR(30),
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE savedpaymentcards ADD COLUMN IF NOT EXISTS updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- productimages/createdat is read by checkout queries.
ALTER TABLE productimages ADD COLUMN IF NOT EXISTS createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

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

// Render incident (Sep 2, 10:17–10:42): after a mid-flight DB wipe the
// request-driven heal logged "starting recovery..." 18 times over 25 minutes
// and NEVER completed — no success line, no error line, nothing. A pg query()
// has no built-in timeout (connectionTimeoutMillis only covers pool
// acquisition), so one stalled socket hung recoveryInFlight forever, and
// because the in-flight promise is never cleared on a hang, every later
// request awaited the same dead promise. All recovery work below is
// therefore wrapped with a watchdog timeout, retried, and its in-flight
// promise is ALWAYS settled (success, failure, or watchdog) so a later
// request can start a fresh recovery.
const RECOVERY_QUERY_TIMEOUT_MS = 45_000; // per SQL batch
const RECOVERY_STAGE_TIMEOUT_MS = 5 * 60_000; // whole recovery (Phase 11B seed can take ~15s+)
const RECOVERY_STAGE_RETRIES = 3;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[timeout] ${label} exceeded ${ms}ms`)), ms).unref?.()
    ),
  ]);
}

async function recoveryQuery(sql: string, label: string, params?: any[]): Promise<any> {
  let lastErr: any;
  for (let attempt = 1; attempt <= RECOVERY_STAGE_RETRIES; attempt++) {
    try {
      return await withTimeout(
        params ? client.query(sql, params) : client.query(sql),
        RECOVERY_QUERY_TIMEOUT_MS,
        label
      );
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e);
      console.warn(`[DB Recovery] ${label} attempt ${attempt}/${RECOVERY_STAGE_RETRIES} failed: ${msg}`);
      if (attempt < RECOVERY_STAGE_RETRIES) {
        await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }
  }
  throw lastErr;
}

async function ensureMerchantDataReady(trigger: string): Promise<void> {
  // Fast path: if the dataset verified healthy recently, skip.
  if (Date.now() - lastRecoveryAt < RECOVERY_COOLDOWN_MS) return;

  if (recoveryInFlight) {
    // Another request is already recovering — wait for it (bounded), don't
    // stack seeds. The watchdog inside guarantees this await settles.
    await recoveryInFlight;
    return;
  }

  recoveryInFlight = (async () => {
    try {
      await withTimeout(
        (async () => {
          // 1. Core schema (users, cartitems, etc.) + auth columns.
          await recoveryQuery(CORE_SCHEMA_SQL, 'core-schema');
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
            await recoveryQuery(`
              CREATE INDEX IF NOT EXISTS idx_shopi_orders_status_date ON shopi_orders (order_status, order_placed_at);
              CREATE INDEX IF NOT EXISTS idx_shopi_returns_created ON shopi_order_returns (created_at);
              CREATE INDEX IF NOT EXISTS idx_shopi_events_cust_type_time ON shopi_customer_events (customer_id, event_type, event_timestamp);
              CREATE INDEX IF NOT EXISTS idx_shopi_orderitems_order_product ON shopi_order_items (order_id, product_id);
            `, 'analytics-indexes');
          } catch (e: any) {
            console.warn(`[DB Recovery:${trigger}] Index bootstrap skipped:`, e.message);
          }

          // 3b. Merchant AI decision-table column backfill.
          // Several CREATE TABLE sources exist (CORE_SCHEMA_SQL here, the older
          // merchant-ai-schema.sql, per-module ensureSchema). When a table already
          // exists from an older source, CREATE IF NOT EXISTS silently keeps the
          // older shape and later queries fail with "column does not exist"
          // (observed: merchant_ai_actions.is_test missing on Render after a DB
          // reset while /actions/impact-summary queried it). These idempotent
          // ALTERs reconcile the drift regardless of which source created the
          // table. The actions table is CREATED FIRST (full application shape)
          // — on a wiped DB the old block led with an ALTER against a missing
          // table, which aborted the whole multi-statement batch, so the
          // ledger/outcome/audit/recommendation tables below were never created
          // (observed in Render startup logs).
          try {
            await recoveryQuery(`
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
              ALTER TABLE merchant_ai_actions ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
              ALTER TABLE merchant_ai_actions ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);
              ALTER TABLE merchant_ai_actions ADD COLUMN IF NOT EXISTS failure_reason TEXT;
              ALTER TABLE merchant_ai_actions ADD COLUMN IF NOT EXISTS execution_result JSONB;
              ALTER TABLE merchant_ai_actions ADD COLUMN IF NOT EXISTS approved_by VARCHAR(64);
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
              -- Older shapes (merchant-ai-schema.sql) created impact_id with NO
              -- serial default, which made every ledger-seed INSERT fail with
              -- 'null value in column impact_id violates not-null constraint'.
              -- Reconcile the default (creating a sequence when none exists);
              -- idempotent on fresh tables.
              DO $$
              DECLARE
                seq_name TEXT;
              BEGIN
                IF EXISTS (
                  SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'merchant_business_impact_ledger'
                    AND column_name = 'impact_id'
                    AND column_default IS NULL
                ) THEN
                  IF pg_get_serial_sequence('merchant_business_impact_ledger', 'impact_id') IS NULL THEN
                    CREATE SEQUENCE IF NOT EXISTS merchant_business_impact_ledger_impact_id_seq;
                    PERFORM setval(
                      'merchant_business_impact_ledger_impact_id_seq',
                      COALESCE((SELECT MAX(impact_id) FROM merchant_business_impact_ledger), 0) + 1,
                      false
                    );
                    seq_name := 'merchant_business_impact_ledger_impact_id_seq';
                  ELSE
                    seq_name := pg_get_serial_sequence('merchant_business_impact_ledger', 'impact_id');
                  END IF;
                  EXECUTE format(
                    'ALTER TABLE merchant_business_impact_ledger ALTER COLUMN impact_id SET DEFAULT nextval(%L)',
                    seq_name
                  );
                END IF;
              END $$;
              CREATE TABLE IF NOT EXISTS merchant_action_audits (
                audit_id SERIAL PRIMARY KEY,
                action_id VARCHAR(64),
                merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
                event_type VARCHAR(64) NOT NULL,
                performed_by VARCHAR(64) NOT NULL,
                details JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
              CREATE TABLE IF NOT EXISTS merchant_ai_outcomes (
                outcome_id VARCHAR(64) PRIMARY KEY,
                decision_id VARCHAR(64),
                merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
                action_type VARCHAR(64),
                product_id INTEGER,
                prediction_metric VARCHAR(64),
                predicted_min NUMERIC(14,2),
                predicted_mid NUMERIC(14,2),
                predicted_max NUMERIC(14,2),
                prediction_confidence VARCHAR(16),
                forecast_horizon_days INTEGER,
                actual_value NUMERIC(14,2),
                outcome_status VARCHAR(32),
                absolute_error NUMERIC(14,2),
                percentage_error NUMERIC(8,2),
                direction_correct BOOLEAN,
                bias_classification VARCHAR(32),
                learning_status VARCHAR(32),
                metadata JSONB DEFAULT '{}'::jsonb,
                decision_timestamp TIMESTAMP WITH TIME ZONE,
                outcome_timestamp TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
              CREATE TABLE IF NOT EXISTS merchant_ai_recommendations (
                recommendation_id VARCHAR(64) PRIMARY KEY,
                merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
                recommendation_type VARCHAR(64),
                product_id INTEGER,
                confidence VARCHAR(16),
                payload JSONB DEFAULT '{}'::jsonb,
                status VARCHAR(32) DEFAULT 'ACTIVE',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `, 'decision-tables');
            console.log(`[DB Recovery:${trigger}] Merchant AI decision tables reconciled.`);
          } catch (e: any) {
            console.warn(`[DB Recovery:${trigger}] Decision-table backfill skipped:`, e.message);
          }

      // 4. Phase 11B commerce dataset (orders, customers, events, COGS...).
      const check = await recoveryQuery("SELECT to_regclass('public.shopi_orders') as exists;", 'dataset-probe');
      let needsMigration = !check.rows[0]?.exists;
      if (!needsMigration) {
        const countRes = await recoveryQuery('SELECT COUNT(*) FROM shopi_orders', 'dataset-count');
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

      // 5. Historical action ledger for the Actions & Outcomes workspace.
      // Restores the decision history a database reset wipes (Render free
      // tier). Rows are generated from REAL catalog/order data and always
      // flagged is_test=true so they are distinguishable from live records.
      try {
        const { seedHistoricalActionLedger } = await import('./seedHistoricalLedger');
        const r = await seedHistoricalActionLedger();
        if (r.seeded) {
          console.log(`[DB Recovery:${trigger}] Historical ledger restored (${r.count} rows).`);
        }
      } catch (e: any) {
        console.warn(`[DB Recovery:${trigger}] Historical ledger skipped:`, e.message);
      }

      lastRecoveryAt = Date.now();
      console.log(`[DB Recovery:${trigger}] COMPLETED OK.`);
        })(), // end withTimeout inner
        RECOVERY_STAGE_TIMEOUT_MS,
        `recovery(${trigger})`
      );
    } catch (e: any) {
      // Log loudly: this is the path that previously failed SILENTLY on
      // Render (see incident note above). An unset lastRecoveryAt means the
      // next request-driven heal retries immediately — a failed recovery
      // never wedges the service.
      console.error(`[DB Recovery:${trigger}] FAILED:`, e?.message || e);
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
 *
 * All probes are watchdog-wrapped: on a half-dead pooled connection a raw
 * client.query can hang forever (pg has no query timeout), which wedged the
 * Sep 2 incident. The probe also checks the CORE auth tables (users), not
 * just the commerce dataset — the Sep 2 wipe left shopi_orders alive but
 * users missing, and the old probe then reported "healthy" while sign-in
 * stayed broken.
 */
export async function recoverMerchantDataIfMissing(): Promise<boolean> {
  try {
    const check = await recoveryQuery(
      "SELECT to_regclass('public.users') as users_t, to_regclass('public.shopi_orders') as orders_t;",
      'health-probe'
    );
    const usersExists = !!check.rows[0]?.users_t;
    const ordersExists = !!check.rows[0]?.orders_t;
    if (!usersExists || !ordersExists) {
      console.warn(`[DB Recovery] probe: users=${usersExists} shopi_orders=${ordersExists} — recovering...`);
      await ensureMerchantDataReady('request');
      return true; // recovery ran
    }
    // Tables exist — check the commerce dataset has data
    const countRes = await recoveryQuery('SELECT COUNT(*) FROM shopi_orders', 'dataset-count');
    if (parseInt(countRes.rows[0].count, 10) === 0) {
      await ensureMerchantDataReady('request-empty');
      return true;
    }

    // Independent ledger check: the Actions & Outcomes workspace expects a
    // historical decision ledger. A database reset can wipe it while the
    // shopi commerce dataset is intact — in that case only the ledger needs
    // restoring, so trigger recovery (the seed is skip-if-present).
    try {
      const ledgerRes = await recoveryQuery(
        "SELECT to_regclass('public.merchant_ai_actions') as exists;",
        'ledger-probe'
      );
      if (ledgerRes.rows[0]?.exists) {
        const ledgerCount = await recoveryQuery('SELECT COUNT(*) FROM merchant_ai_actions', 'ledger-count');
        if (parseInt(ledgerCount.rows[0].count, 10) === 0) {
          const { seedHistoricalActionLedger } = await import('./seedHistoricalLedger');
          const r = await seedHistoricalActionLedger();
          if (r.seeded) {
            console.log('[DB Recovery:request] Historical ledger restored:', r.count);
            return true;
          }
        }
      }
    } catch (ledgerErr: any) {
      console.warn('[DB Recovery] Ledger probe skipped:', ledgerErr.message);
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

export { client, connectDB, CORE_SCHEMA_SQL };
