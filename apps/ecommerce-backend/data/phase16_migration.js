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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPhase16Migration = runPhase16Migration;
const DB_1 = require("./DB");
/**
 * ⚡ Phase 16 Database Migration: Production Pilot & Live Observation
 *
 * Creates tables for:
 * 1. merchant_pilot_sessions (pilot lifecycle, mode, connection gate)
 * 2. merchant_pilot_feedback (qualitative merchant ratings and feedback)
 * 3. merchant_pilot_incidents (operational incident tracker)
 * 4. merchant_pilot_observations (daily/weekly observation ledger)
 */
function runPhase16Migration() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('--- 🚀 Running Phase 16 DB Migration ---');
        try {
            // 1. Pilot Sessions Table
            yield DB_1.client.query(`
      CREATE TABLE IF NOT EXISTS merchant_pilot_sessions (
        session_id VARCHAR(100) PRIMARY KEY,
        merchant_id VARCHAR(100) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        mode VARCHAR(50) NOT NULL DEFAULT 'REAL_PILOT_READ_ONLY',
        status VARCHAR(50) NOT NULL DEFAULT 'READY_FOR_CONNECTION',
        autonomous_mutations_allowed BOOLEAN NOT NULL DEFAULT FALSE,
        connection_gate_verified BOOLEAN NOT NULL DEFAULT FALSE,
        observation_start_date TIMESTAMPTZ,
        observation_end_date TIMESTAMPTZ,
        observation_days_target INT NOT NULL DEFAULT 14,
        daily_ai_query_quota INT NOT NULL DEFAULT 500,
        used_ai_queries INT NOT NULL DEFAULT 0,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
            console.log('✅ Table "merchant_pilot_sessions" verified/created.');
            // 2. Pilot Feedback Table
            yield DB_1.client.query(`
      CREATE TABLE IF NOT EXISTS merchant_pilot_feedback (
        feedback_id VARCHAR(100) PRIMARY KEY,
        merchant_id VARCHAR(100) NOT NULL,
        session_id VARCHAR(100),
        rating_type VARCHAR(50) NOT NULL, -- 'Helpful', 'Not Helpful', 'Incorrect', 'Missing Context', 'Wrong Recommendation'
        target_component VARCHAR(100) NOT NULL, -- 'COPILOT', 'RECOMMENDATION', 'FORECAST', 'DASHBOARD'
        related_entity_id VARCHAR(100),
        user_comment TEXT,
        submitted_by VARCHAR(100) DEFAULT 'merchant_admin',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
            console.log('✅ Table "merchant_pilot_feedback" verified/created.');
            // 3. Pilot Incidents Table
            yield DB_1.client.query(`
      CREATE TABLE IF NOT EXISTS merchant_pilot_incidents (
        incident_id VARCHAR(100) PRIMARY KEY,
        merchant_id VARCHAR(100) NOT NULL,
        session_id VARCHAR(100),
        severity VARCHAR(30) NOT NULL DEFAULT 'P3_MEDIUM', -- 'P1_CRITICAL', 'P2_HIGH', 'P3_MEDIUM', 'P4_LOW'
        component VARCHAR(100) NOT NULL, -- 'SYNC', 'COPILOT', 'AUTH', 'RECONCILIATION', 'ACTION_GATE'
        error_message TEXT NOT NULL,
        stack_trace TEXT,
        root_cause TEXT,
        resolution TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMPTZ
      );
    `);
            console.log('✅ Table "merchant_pilot_incidents" verified/created.');
            // 4. Pilot Observation Ledger Table
            yield DB_1.client.query(`
      CREATE TABLE IF NOT EXISTS merchant_pilot_observations (
        observation_id VARCHAR(100) PRIMARY KEY,
        merchant_id VARCHAR(100) NOT NULL,
        session_id VARCHAR(100),
        observation_date DATE NOT NULL DEFAULT CURRENT_DATE,
        total_orders INT NOT NULL DEFAULT 0,
        gross_revenue NUMERIC(14,2) NOT NULL DEFAULT 0.00,
        aov NUMERIC(14,2) NOT NULL DEFAULT 0.00,
        total_units_sold INT NOT NULL DEFAULT 0,
        ai_queries_executed INT NOT NULL DEFAULT 0,
        recommendations_generated INT NOT NULL DEFAULT 0,
        actions_approved INT NOT NULL DEFAULT 0,
        actions_rejected INT NOT NULL DEFAULT 0,
        sync_failures INT NOT NULL DEFAULT 0,
        numerical_accuracy_pct NUMERIC(5,2) NOT NULL DEFAULT 100.00,
        data_freshness_seconds INT NOT NULL DEFAULT 0,
        reconciliation_delta NUMERIC(14,2) NOT NULL DEFAULT 0.00,
        metrics JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uniq_merchant_obs_date UNIQUE (merchant_id, observation_date)
      );
    `);
            console.log('✅ Table "merchant_pilot_observations" verified/created.');
            // Create Indexes
            yield DB_1.client.query(`
      CREATE INDEX IF NOT EXISTS idx_pilot_sessions_merchant ON merchant_pilot_sessions(merchant_id);
      CREATE INDEX IF NOT EXISTS idx_pilot_feedback_merchant ON merchant_pilot_feedback(merchant_id);
      CREATE INDEX IF NOT EXISTS idx_pilot_incidents_merchant ON merchant_pilot_incidents(merchant_id, status);
      CREATE INDEX IF NOT EXISTS idx_pilot_observations_merchant ON merchant_pilot_observations(merchant_id, observation_date);
    `);
            console.log('✅ Phase 16 indexes created successfully.');
            console.log('--- ✨ Phase 16 DB Migration Completed Successfully ---');
        }
        catch (error) {
            console.error('❌ Phase 16 DB Migration Failed:', error);
            throw error;
        }
    });
}
// Auto-run if executed directly
if (((_a = process.argv[1]) === null || _a === void 0 ? void 0 : _a.endsWith('phase16_migration.ts')) || ((_b = process.argv[1]) === null || _b === void 0 ? void 0 : _b.endsWith('phase16_migration.js'))) {
    runPhase16Migration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
