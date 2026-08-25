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
  const maxRetries = 10;
  const retryDelayMs = 3000;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await client.query('SELECT 1');
      console.log('Connected to the database');
      return;
    } catch (err: any) {
      console.error(`DB connection attempt ${attempt}/${maxRetries} failed:`, err.message);
      if (attempt === maxRetries) {
        console.error('Could not connect to database after max retries. Exiting.');
        process.exit(1);
      }
      await new Promise(res => setTimeout(res, retryDelayMs));
    }
  }
};

export { client, connectDB };
