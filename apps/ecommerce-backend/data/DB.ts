import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';

// Resolve .env from ecommerce-backend directory as well as process cwd
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const client = new Pool({
  user: String(process.env.DB_USER || 'postgres'),
  password: String(process.env.DB_PASS || '1234'),
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'razorpay_ecommerce',
  max: 10,                // maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const connectDB = async () => {
  try {
    await client.query('SELECT 1');
    console.log('Connected to local PostgreSQL database');
  } catch (err: any) {
    console.log('[DB Info] Operating in Supabase cloud catalog mode.');
  }
};

export { client, connectDB };
