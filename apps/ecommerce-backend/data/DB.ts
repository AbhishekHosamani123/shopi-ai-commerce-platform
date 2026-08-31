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

const connectDB = async () => {
  try {
    await client.query('SELECT 1');
    console.log('[DB Info] Connected to PostgreSQL database successfully.');
  } catch (err: any) {
    console.log('[DB Info] Operating in Supabase cloud catalog mode / Postgres fallback:', err.message);
  }
};

export { client, connectDB };
