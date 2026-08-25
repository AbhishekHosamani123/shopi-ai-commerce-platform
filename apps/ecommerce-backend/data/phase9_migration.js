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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPhase9Migration = runPhase9Migration;
const DB_1 = require("./DB");
function runPhase9Migration() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Running Phase 9 PostgreSQL Database Migrations...');
        yield DB_1.client.query(`
    -- 1. Merchant Onboarding Profile Table
    CREATE TABLE IF NOT EXISTS merchant_onboarding_profile (
      profile_id SERIAL PRIMARY KEY,
      merchant_id VARCHAR(100) NOT NULL UNIQUE,
      store_name VARCHAR(255) NOT NULL,
      business_category VARCHAR(100) NOT NULL,
      currency VARCHAR(10) DEFAULT 'INR',
      primary_market VARCHAR(100) DEFAULT 'India',
      business_model VARCHAR(100) DEFAULT 'D2C',
      active_goals TEXT[] DEFAULT ARRAY['INCREASE_REVENUE'],
      onboarding_completed BOOLEAN DEFAULT false,
      ai_readiness_score INT DEFAULT 75,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Merchant System Notifications Table
    CREATE TABLE IF NOT EXISTS merchant_system_notifications (
      notification_id VARCHAR(100) PRIMARY KEY,
      merchant_id VARCHAR(100) NOT NULL,
      severity VARCHAR(20) NOT NULL,
      category VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      reason TEXT NOT NULL,
      evidence TEXT NOT NULL,
      recommended_action TEXT NOT NULL,
      action_id VARCHAR(100),
      status VARCHAR(20) DEFAULT 'UNREAD',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      read_at TIMESTAMPTZ,
      dismissed_at TIMESTAMPTZ,
      actioned_at TIMESTAMPTZ
    );

    -- 3. Merchant Data Imports Table
    CREATE TABLE IF NOT EXISTS merchant_data_imports (
      import_id VARCHAR(100) PRIMARY KEY,
      merchant_id VARCHAR(100) NOT NULL,
      file_type VARCHAR(50) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      total_rows INT NOT NULL,
      valid_rows INT NOT NULL,
      duplicate_rows INT NOT NULL,
      invalid_rows INT NOT NULL,
      error_log JSONB DEFAULT '[]',
      status VARCHAR(30) DEFAULT 'COMPLETED',
      is_dry_run BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Composite Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_orders_status_createdat ON orders(orderstatus, createdat);
    CREATE INDEX IF NOT EXISTS idx_orderitems_prod_order ON orderitems(productid, orderid);
    CREATE INDEX IF NOT EXISTS idx_notifications_merchant_status ON merchant_system_notifications(merchant_id, status);
    CREATE INDEX IF NOT EXISTS idx_onboarding_merchant ON merchant_onboarding_profile(merchant_id);
    CREATE INDEX IF NOT EXISTS idx_data_imports_merchant ON merchant_data_imports(merchant_id);

    -- Seed initial default merchant onboarding profile if not exists
    INSERT INTO merchant_onboarding_profile (
      merchant_id, store_name, business_category, currency, primary_market, business_model, active_goals, onboarding_completed, ai_readiness_score
    ) VALUES (
      'default_merchant', 'Razorpay AI Flagship Store', 'Apparel & Footwear', 'INR', 'India (Pan-National)', 'Omnichannel D2C', ARRAY['INCREASE_REVENUE', 'REDUCE_DEAD_STOCK'], true, 84
    ) ON CONFLICT (merchant_id) DO NOTHING;

    -- Seed initial default notifications if table is empty
    INSERT INTO merchant_system_notifications (
      notification_id, merchant_id, severity, category, title, reason, evidence, recommended_action, status, created_at
    ) VALUES 
    (
      'notif_stock_001', 'default_merchant', 'CRITICAL', 'INVENTORY', 'Critical Stockout Imminent for Sports Claw Shoes',
      'Inventory depletion velocity exceeds safe reorder buffer.', 'Stock level is 18 units with 4.2 units/day velocity (4.3 days remaining).', 'Create and approve restock purchase order of 150 units.', 'UNREAD', CURRENT_TIMESTAMP - INTERVAL '2 hours'
    ),
    (
      'notif_margin_002', 'default_merchant', 'WARNING', 'PROFITABILITY', 'Promotional Margin Drag on Footwear Category',
      'Average category discount depth reached 24.5%.', 'Gross margin compressed from 58% to 42% over last 14 days.', 'Recalibrate clearance discount rules from 25% down to 15%.', 'UNREAD', CURRENT_TIMESTAMP - INTERVAL '5 hours'
    ),
    (
      'notif_learn_003', 'default_merchant', 'OPPORTUNITY', 'MODELS', 'Bayesian Elasticity Recalibrated (+14% Precision)',
      'A/B experiment data converged with narrowed credible bounds.', 'Posterior elasticity updated to -1.42 across athletic SKUs.', 'Apply recommended price adjustments in AI Recommendation Hub.', 'UNREAD', CURRENT_TIMESTAMP - INTERVAL '1 day'
    ) ON CONFLICT (notification_id) DO NOTHING;
  `);
        console.log('✅ Phase 9 Database Migration completed successfully.');
    });
}
// Execute migration if run directly
if (require.main === module || ((_a = process.argv[1]) === null || _a === void 0 ? void 0 : _a.includes('phase9_migration'))) {
    runPhase9Migration()
        .then(() => {
        DB_1.client.end();
        process.exit(0);
    })
        .catch((err) => {
        console.error('Migration failed:', err);
        DB_1.client.end();
        process.exit(1);
    });
}
