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
`;

const connectDB = async () => {
  try {
    await client.query('SELECT 1');
    console.log('[DB Info] Connected to PostgreSQL database successfully.');
    
    // Self-bootstrap core schema so tables like cartitems, users, etc. always exist
    await client.query(CORE_SCHEMA_SQL);
    console.log('[DB Info] Core schema (cartitems, users, addresses, orders, etc.) initialized.');

    // Self-bootstrap Phase 11B commerce dataset (90 days of order analytics, COGS, customer cohorts, etc.)
    try {
      const check = await client.query("SELECT to_regclass('public.shopi_orders') as exists;");
      let needsMigration = !check.rows[0]?.exists;
      if (!needsMigration) {
        const countRes = await client.query('SELECT COUNT(*) FROM shopi_orders');
        needsMigration = parseInt(countRes.rows[0].count, 10) === 0;
      }

      if (needsMigration) {
        console.log('[DB Info] Auto-seeding Phase 11B commerce dataset in background...');
        const { runPhase11bMigration } = await import('./phase11b_migration');
        runPhase11bMigration()
          .then(() => console.log('[DB Info] Phase 11B commerce dataset auto-seeded successfully.'))
          .catch((err) => console.warn('[DB Info] Phase 11B auto-seed notice:', err.message));
      } else {
        console.log('[DB Info] Phase 11B commerce dataset verified.');
      }
    } catch (migErr: any) {
      console.warn('[DB Info] Auto-migration check:', migErr.message);
    }
  } catch (err: any) {
    console.log('[DB Info] PostgreSQL offline or fallback mode:', err.message);
  }
};

export { client, connectDB };
