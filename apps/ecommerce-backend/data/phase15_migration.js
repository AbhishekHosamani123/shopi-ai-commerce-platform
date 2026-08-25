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
exports.runPhase15Migration = runPhase15Migration;
const DB_1 = require("./DB");
function runPhase15Migration() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Running Phase 15 PostgreSQL Database Migrations for Merchant Connectors, Live Sync & Lineage...');
        yield DB_1.client.query(`
    -- 1. Merchant Connectors Configuration Table
    CREATE TABLE IF NOT EXISTS merchant_connectors (
      connector_id VARCHAR(100) PRIMARY KEY,
      merchant_id VARCHAR(100) NOT NULL,
      provider VARCHAR(50) NOT NULL,
      store_identifier VARCHAR(255) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'NOT_CONNECTED',
      auth_type VARCHAR(50) NOT NULL DEFAULT 'BEARER_TOKEN',
      encrypted_credentials TEXT NOT NULL,
      endpoint_url VARCHAR(500),
      webhook_secret_encrypted TEXT,
      auto_sync_enabled BOOLEAN DEFAULT TRUE,
      sync_frequency_minutes INT DEFAULT 60,
      last_successful_sync TIMESTAMPTZ,
      last_failed_sync TIMESTAMPTZ,
      last_error TEXT,
      data_coverage_days INT DEFAULT 365,
      data_quality_score NUMERIC(5,2) DEFAULT 100.00,
      total_products_synced INT DEFAULT 0,
      total_customers_synced INT DEFAULT 0,
      total_orders_synced INT DEFAULT 0,
      total_inventory_synced INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(merchant_id, provider)
    );

    -- 2. Resumable Sync Checkpoints Table
    CREATE TABLE IF NOT EXISTS merchant_sync_checkpoints (
      checkpoint_id VARCHAR(100) PRIMARY KEY,
      sync_id VARCHAR(100) NOT NULL,
      merchant_id VARCHAR(100) NOT NULL,
      provider VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      cursor_token TEXT,
      page_number INT DEFAULT 1,
      rows_processed INT DEFAULT 0,
      rows_imported INT DEFAULT 0,
      rows_failed INT DEFAULT 0,
      is_complete BOOLEAN DEFAULT FALSE,
      checkpoint_payload JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Webhook Events Ledger
    CREATE TABLE IF NOT EXISTS merchant_webhook_events (
      event_id VARCHAR(100) PRIMARY KEY,
      merchant_id VARCHAR(100) NOT NULL,
      provider VARCHAR(50) NOT NULL,
      event_type VARCHAR(100) NOT NULL,
      idempotency_key VARCHAR(255) NOT NULL,
      payload JSONB NOT NULL,
      signature_valid BOOLEAN NOT NULL DEFAULT TRUE,
      processing_status VARCHAR(30) NOT NULL DEFAULT 'PROCESSED',
      error_message TEXT,
      received_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      processed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(merchant_id, idempotency_key)
    );

    -- 4. Audit-Grade AI Data Lineage Table
    CREATE TABLE IF NOT EXISTS merchant_data_lineage (
      lineage_id VARCHAR(100) PRIMARY KEY,
      merchant_id VARCHAR(100) NOT NULL,
      metric_name VARCHAR(100) NOT NULL,
      metric_value NUMERIC(14,2) NOT NULL,
      source_name VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      period_start TIMESTAMPTZ NOT NULL,
      period_end TIMESTAMPTZ NOT NULL,
      records_evaluated INT NOT NULL DEFAULT 0,
      calculation_formula VARCHAR(255) NOT NULL,
      reconciliation_status VARCHAR(30) DEFAULT 'RECONCILED',
      computed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. Real-Data Backtesting & Validation Ledger
    CREATE TABLE IF NOT EXISTS merchant_backtest_runs (
      run_id VARCHAR(100) PRIMARY KEY,
      merchant_id VARCHAR(100) NOT NULL,
      model_type VARCHAR(100) NOT NULL,
      dataset_source VARCHAR(50) NOT NULL DEFAULT 'MERCHANT_CANONICAL',
      sample_size INT NOT NULL,
      mae NUMERIC(10,4) NOT NULL,
      rmse NUMERIC(10,4) NOT NULL,
      wape NUMERIC(10,4) NOT NULL,
      forecast_bias NUMERIC(10,4) NOT NULL,
      recommendation_precision NUMERIC(5,2) DEFAULT 0,
      false_positive_rate NUMERIC(5,2) DEFAULT 0,
      false_negative_rate NUMERIC(5,2) DEFAULT 0,
      evaluation_summary JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. High-Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_connector_merchant ON merchant_connectors(merchant_id);
    CREATE INDEX IF NOT EXISTS idx_checkpoints_sync ON merchant_sync_checkpoints(sync_id, entity_type);
    CREATE INDEX IF NOT EXISTS idx_webhook_merchant ON merchant_webhook_events(merchant_id, event_type);
    CREATE INDEX IF NOT EXISTS idx_lineage_merchant_metric ON merchant_data_lineage(merchant_id, metric_name);
    CREATE INDEX IF NOT EXISTS idx_backtest_merchant ON merchant_backtest_runs(merchant_id);
  `);
        console.log('✅ Phase 15 PostgreSQL Migrations applied successfully.');
    });
}
