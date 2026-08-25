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
exports.runPhase13Migration = runPhase13Migration;
const DB_1 = require("./DB");
function runPhase13Migration() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Running Phase 13 PostgreSQL Database Migrations for Scale & Simulation Engine...');
        yield DB_1.client.query(`
    -- 1. Isolated Simulation Products Table
    CREATE TABLE IF NOT EXISTS sandbox_sim_products (
      product_id SERIAL PRIMARY KEY,
      merchant_id VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      subcategory VARCHAR(100),
      price NUMERIC(14,2) NOT NULL,
      cost NUMERIC(14,2) NOT NULL,
      stock INT NOT NULL DEFAULT 100,
      behavior_profile VARCHAR(50) NOT NULL,
      return_probability NUMERIC(5,4) DEFAULT 0.08,
      seasonality_factor NUMERIC(5,2) DEFAULT 1.0,
      status VARCHAR(30) DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Isolated Simulation Customers Table
    CREATE TABLE IF NOT EXISTS sandbox_sim_customers (
      customer_id VARCHAR(100) PRIMARY KEY,
      merchant_id VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      cohort_type VARCHAR(50) NOT NULL,
      first_order_date TIMESTAMPTZ NOT NULL,
      total_spend NUMERIC(14,2) DEFAULT 0,
      order_count INT DEFAULT 0,
      is_churned BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Isolated Simulation Orders Table
    CREATE TABLE IF NOT EXISTS sandbox_sim_orders (
      order_id VARCHAR(100) PRIMARY KEY,
      merchant_id VARCHAR(100) NOT NULL,
      customer_id VARCHAR(100) NOT NULL,
      order_date TIMESTAMPTZ NOT NULL,
      order_status VARCHAR(30) DEFAULT 'COMPLETED',
      payment_status VARCHAR(30) DEFAULT 'PAID',
      subtotal NUMERIC(14,2) NOT NULL,
      discount_total NUMERIC(14,2) DEFAULT 0,
      total_amount NUMERIC(14,2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Isolated Simulation Order Items Table
    CREATE TABLE IF NOT EXISTS sandbox_sim_orderitems (
      item_id SERIAL PRIMARY KEY,
      order_id VARCHAR(100) NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      unit_price NUMERIC(14,2) NOT NULL,
      discount NUMERIC(14,2) DEFAULT 0,
      total_price NUMERIC(14,2) NOT NULL
    );

    -- 5. Isolated Simulation Inventory Ledger Table
    CREATE TABLE IF NOT EXISTS sandbox_sim_inventory_ledger (
      entry_id SERIAL PRIMARY KEY,
      merchant_id VARCHAR(100) NOT NULL,
      product_id INT NOT NULL,
      movement_type VARCHAR(30) NOT NULL,
      quantity INT NOT NULL,
      opening_stock INT NOT NULL,
      closing_stock INT NOT NULL,
      reference_id VARCHAR(100),
      timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. Isolated Simulation Returns Table
    CREATE TABLE IF NOT EXISTS sandbox_sim_returns (
      return_id VARCHAR(100) PRIMARY KEY,
      merchant_id VARCHAR(100) NOT NULL,
      order_id VARCHAR(100) NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      reason VARCHAR(100) NOT NULL,
      refund_amount NUMERIC(14,2) NOT NULL,
      return_date TIMESTAMPTZ NOT NULL
    );

    -- 7. High-Performance Indexes for Scale Simulation Queries
    CREATE INDEX IF NOT EXISTS idx_sim_orders_merchant_date ON sandbox_sim_orders(merchant_id, order_date);
    CREATE INDEX IF NOT EXISTS idx_sim_orderitems_order_prod ON sandbox_sim_orderitems(order_id, product_id);
    CREATE INDEX IF NOT EXISTS idx_sim_products_merchant_cat ON sandbox_sim_products(merchant_id, category);
    CREATE INDEX IF NOT EXISTS idx_sim_inventory_prod ON sandbox_sim_inventory_ledger(merchant_id, product_id, timestamp);
  `);
        console.log('✅ Phase 13 PostgreSQL Migrations completed successfully.');
    });
}
