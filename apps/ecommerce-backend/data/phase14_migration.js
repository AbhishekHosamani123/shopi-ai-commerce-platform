"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPhase14Migration = runPhase14Migration;
const DB_1 = require("./DB");
function runPhase14Migration() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Running Phase 14 PostgreSQL Database Migrations for Real Data Ingestion & Pilot...');
        yield DB_1.client.query(`
    -- 1. Real Merchant Import Batches Table
    CREATE TABLE IF NOT EXISTS merchant_real_imports (
      import_id VARCHAR(100) PRIMARY KEY,
      merchant_id VARCHAR(100) NOT NULL,
      file_type VARCHAR(50) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      source_type VARCHAR(50) DEFAULT 'CSV',
      total_rows INT NOT NULL DEFAULT 0,
      valid_rows INT NOT NULL DEFAULT 0,
      duplicate_rows INT NOT NULL DEFAULT 0,
      invalid_rows INT NOT NULL DEFAULT 0,
      source_revenue NUMERIC(14,2) DEFAULT 0,
      imported_revenue NUMERIC(14,2) DEFAULT 0,
      reconciliation_status VARCHAR(30) DEFAULT 'PENDING',
      status VARCHAR(30) DEFAULT 'STAGED',
      preview_stats JSONB DEFAULT '{}',
      column_mapping JSONB DEFAULT '{}',
      error_log JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      committed_at TIMESTAMPTZ,
      rolled_back_at TIMESTAMPTZ
    );

    -- 2. Merchant Incremental Sync State Table
    CREATE TABLE IF NOT EXISTS merchant_sync_state (
      sync_id VARCHAR(100) PRIMARY KEY,
      merchant_id VARCHAR(100) NOT NULL,
      connector_type VARCHAR(50) NOT NULL,
      sync_type VARCHAR(30) DEFAULT 'INCREMENTAL',
      last_sync_started_at TIMESTAMPTZ NOT NULL,
      last_sync_completed_at TIMESTAMPTZ,
      rows_processed INT DEFAULT 0,
      rows_inserted INT DEFAULT 0,
      rows_updated INT DEFAULT 0,
      rows_rejected INT DEFAULT 0,
      status VARCHAR(30) DEFAULT 'RUNNING',
      error_count INT DEFAULT 0,
      error_details JSONB DEFAULT '[]'
    );

    -- 3. Canonical Real Ingested Products Table
    CREATE TABLE IF NOT EXISTS merchant_canonical_products (
      product_id SERIAL PRIMARY KEY,
      import_id VARCHAR(100) NOT NULL,
      merchant_id VARCHAR(100) NOT NULL,
      external_product_id VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      price NUMERIC(14,2) NOT NULL,
      cost NUMERIC(14,2),
      stock INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(merchant_id, external_product_id)
    );

    -- 4. Canonical Real Ingested Customers Table
    CREATE TABLE IF NOT EXISTS merchant_canonical_customers (
      customer_id SERIAL PRIMARY KEY,
      import_id VARCHAR(100) NOT NULL,
      merchant_id VARCHAR(100) NOT NULL,
      external_customer_id VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      first_order_date TIMESTAMPTZ,
      total_orders INT DEFAULT 0,
      total_spent NUMERIC(14,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(merchant_id, external_customer_id)
    );

    -- 5. Canonical Real Ingested Orders Table
    CREATE TABLE IF NOT EXISTS merchant_canonical_orders (
      order_id SERIAL PRIMARY KEY,
      import_id VARCHAR(100) NOT NULL,
      merchant_id VARCHAR(100) NOT NULL,
      external_order_id VARCHAR(100) NOT NULL,
      external_customer_id VARCHAR(100) NOT NULL,
      order_date TIMESTAMPTZ NOT NULL,
      order_status VARCHAR(50) DEFAULT 'COMPLETED',
      subtotal NUMERIC(14,2) NOT NULL,
      discount_total NUMERIC(14,2) DEFAULT 0,
      total_amount NUMERIC(14,2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(merchant_id, external_order_id)
    );

    -- 6. Canonical Real Ingested Order Items Table
    CREATE TABLE IF NOT EXISTS merchant_canonical_orderitems (
      item_id SERIAL PRIMARY KEY,
      import_id VARCHAR(100) NOT NULL,
      merchant_id VARCHAR(100) NOT NULL,
      external_order_id VARCHAR(100) NOT NULL,
      external_product_id VARCHAR(100) NOT NULL,
      quantity INT NOT NULL,
      unit_price NUMERIC(14,2) NOT NULL,
      discount NUMERIC(14,2) DEFAULT 0,
      total_price NUMERIC(14,2) NOT NULL
    );

    -- 7. High-Performance Indexes for Canonical Real Merchant Data
    CREATE INDEX IF NOT EXISTS idx_canonical_prod_merchant ON merchant_canonical_products(merchant_id, external_product_id);
    CREATE INDEX IF NOT EXISTS idx_canonical_cust_merchant ON merchant_canonical_customers(merchant_id, external_customer_id);
    CREATE INDEX IF NOT EXISTS idx_canonical_ord_merchant ON merchant_canonical_orders(merchant_id, external_order_id);
    CREATE INDEX IF NOT EXISTS idx_canonical_ord_date ON merchant_canonical_orders(merchant_id, order_date);
    CREATE INDEX IF NOT EXISTS idx_canonical_items_ord ON merchant_canonical_orderitems(merchant_id, external_order_id);
    CREATE INDEX IF NOT EXISTS idx_canonical_import_id ON merchant_canonical_orders(import_id);
  `);
        console.log('✅ Phase 14 PostgreSQL Migrations completed successfully.');
    });
}
