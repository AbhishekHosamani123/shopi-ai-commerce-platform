import { client } from './DB';

export async function runPhase12Migration() {
  console.log('Running Phase 12 PostgreSQL Database Migrations...');

  await client.query(`
    -- 1. Phase 12 Comprehensive Business Impact Ledger Table
    CREATE TABLE IF NOT EXISTS merchant_business_impact_ledger (
      impact_id VARCHAR(100) PRIMARY KEY,
      recommendation_id VARCHAR(100) NOT NULL,
      action_id VARCHAR(100),
      merchant_id VARCHAR(100) NOT NULL,
      product_id INT,
      recommendation_type VARCHAR(50) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      approved_at TIMESTAMPTZ,
      executed_at TIMESTAMPTZ,
      baseline_period VARCHAR(50) DEFAULT '7_DAYS_PRIOR',
      observation_period VARCHAR(50) DEFAULT '14_DAYS_POST',
      observation_window_days INT DEFAULT 14,
      baseline_metrics JSONB DEFAULT '{}',
      post_action_metrics JSONB DEFAULT '{}',
      expected_impact JSONB DEFAULT '{}',
      actual_impact JSONB DEFAULT '{}',
      impact_delta_pct NUMERIC(8,2),
      confidence_at_recommendation NUMERIC(5,2) DEFAULT 0.85,
      final_outcome VARCHAR(30) DEFAULT 'PENDING',
      outcome_status VARCHAR(30) DEFAULT 'PENDING',
      model_version VARCHAR(50) DEFAULT 'v1.4',
      rule_version VARCHAR(50) DEFAULT 'v2.1',
      feature_version VARCHAR(50) DEFAULT 'v1.2',
      merchant_feedback JSONB,
      simulation_id VARCHAR(100),
      evaluated_at TIMESTAMPTZ,
      negative_analysis JSONB
    );

    -- 2. Phase 12 Controlled Merchant Experiments (A/B & Holdout) Table
    CREATE TABLE IF NOT EXISTS merchant_experiments (
      experiment_id VARCHAR(100) PRIMARY KEY,
      merchant_id VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      experiment_type VARCHAR(50) NOT NULL,
      control_group JSONB NOT NULL,
      treatment_group JSONB NOT NULL,
      start_date TIMESTAMPTZ NOT NULL,
      end_date TIMESTAMPTZ,
      success_metric VARCHAR(50) NOT NULL,
      status VARCHAR(30) DEFAULT 'RUNNING',
      results JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Indexes for Ultra-Fast Lookups
    CREATE INDEX IF NOT EXISTS idx_impact_merchant_status ON merchant_business_impact_ledger(merchant_id, outcome_status);
    CREATE INDEX IF NOT EXISTS idx_impact_rec_type ON merchant_business_impact_ledger(merchant_id, recommendation_type);
    CREATE INDEX IF NOT EXISTS idx_experiments_merchant_status ON merchant_experiments(merchant_id, status);
  `);

  console.log('✅ Phase 12 PostgreSQL Migrations completed successfully.');
}
