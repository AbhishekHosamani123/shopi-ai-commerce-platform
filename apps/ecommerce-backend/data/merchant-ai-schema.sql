-- ====================================================================
-- Merchant AI Supplementary Schema Migration
-- Minimal analytics, inventory ledger, returns & audit tracking tables
-- ====================================================================

-- 1. Inventory Movements Ledger
CREATE TABLE IF NOT EXISTS inventory_movements (
    movement_id SERIAL PRIMARY KEY,
    productid INTEGER NOT NULL REFERENCES products(productid) ON DELETE CASCADE,
    sizeid INTEGER REFERENCES productsizes(sizeid) ON DELETE SET NULL,
    movement_type VARCHAR(32) NOT NULL, -- 'opening_stock', 'restock', 'sale', 'customer_return', 'adjustment', 'damaged_writeoff'
    quantity INTEGER NOT NULL,          -- Positive for additions, negative for deductions
    stock_before INTEGER NOT NULL,
    stock_after INTEGER NOT NULL,
    reference_type VARCHAR(32),        -- 'order', 'return', 'purchase_order', 'manual_audit'
    reference_id VARCHAR(64),
    notes TEXT,
    source VARCHAR(64) DEFAULT 'merchant_ai_demo_seed',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inv_mov_product_date ON inventory_movements(productid, created_at);
CREATE INDEX IF NOT EXISTS idx_inv_mov_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inv_mov_source ON inventory_movements(source);

-- 2. Order Returns Table
CREATE TABLE IF NOT EXISTS order_returns (
    return_id SERIAL PRIMARY KEY,
    orderid INTEGER NOT NULL REFERENCES orders(orderid) ON DELETE CASCADE,
    orderitemid INTEGER NOT NULL REFERENCES orderitems(orderitemid) ON DELETE CASCADE,
    productid INTEGER NOT NULL REFERENCES products(productid) ON DELETE CASCADE,
    userid INTEGER NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    return_reason VARCHAR(64) NOT NULL, -- 'wrong_size', 'defective', 'not_as_described', 'changed_mind'
    refund_amount NUMERIC(12,2) NOT NULL,
    return_status VARCHAR(32) NOT NULL DEFAULT 'Completed', -- 'Approved', 'Refunded', 'Completed'
    is_restocked BOOLEAN NOT NULL DEFAULT TRUE,
    source VARCHAR(64) DEFAULT 'merchant_ai_demo_seed',
    createdat TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_returns_prod ON order_returns(productid);
CREATE INDEX IF NOT EXISTS idx_order_returns_order ON order_returns(orderid);
CREATE INDEX IF NOT EXISTS idx_order_returns_user ON order_returns(userid);

-- 3. Order Cancellations Table
CREATE TABLE IF NOT EXISTS order_cancellations (
    cancellation_id SERIAL PRIMARY KEY,
    orderid INTEGER NOT NULL REFERENCES orders(orderid) ON DELETE CASCADE,
    userid INTEGER NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
    reason VARCHAR(128) NOT NULL,
    refund_status VARCHAR(32) NOT NULL DEFAULT 'Refunded',
    source VARCHAR(64) DEFAULT 'merchant_ai_demo_seed',
    cancelled_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_cancel_order ON order_cancellations(orderid);

-- 4. Merchant Daily Aggregation Metrics
CREATE TABLE IF NOT EXISTS merchant_daily_metrics (
    metric_date DATE PRIMARY KEY,
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_units_sold INTEGER NOT NULL DEFAULT 0,
    gross_revenue NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    total_discounts NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    total_refunds NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    net_revenue NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    total_cancellations INTEGER NOT NULL DEFAULT 0,
    total_returns INTEGER NOT NULL DEFAULT 0,
    average_order_value NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    source VARCHAR(64) DEFAULT 'merchant_ai_demo_seed',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_merchant_daily_date ON merchant_daily_metrics(metric_date);

-- 5. Merchant Product Daily Metrics
CREATE TABLE IF NOT EXISTS merchant_product_daily_metrics (
    metric_id SERIAL PRIMARY KEY,
    metric_date DATE NOT NULL,
    productid INTEGER NOT NULL REFERENCES products(productid) ON DELETE CASCADE,
    units_sold INTEGER NOT NULL DEFAULT 0,
    gross_revenue NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    orders_count INTEGER NOT NULL DEFAULT 0,
    returns_count INTEGER NOT NULL DEFAULT 0,
    refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    closing_stock INTEGER NOT NULL DEFAULT 0,
    sales_velocity_7d NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    source VARCHAR(64) DEFAULT 'merchant_ai_demo_seed',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_product_daily_date UNIQUE (metric_date, productid)
);

CREATE INDEX IF NOT EXISTS idx_merchant_prod_daily ON merchant_product_daily_metrics(productid, metric_date);

-- 6. Merchant Demo Seed Meta Table (Audit and Reversibility Tracker)
CREATE TABLE IF NOT EXISTS merchant_demo_seed_meta (
    seed_id SERIAL PRIMARY KEY,
    seed_version VARCHAR(32) NOT NULL,
    started_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITHOUT TIME ZONE,
    total_customers INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    total_movements INTEGER DEFAULT 0,
    total_returns INTEGER DEFAULT 0,
    total_gross_revenue NUMERIC(16,2) DEFAULT 0.00,
    status VARCHAR(32) DEFAULT 'In_Progress'
);

-- 7. Merchant AI Action & Approval Audit Table (Phase 3B)
CREATE TABLE IF NOT EXISTS merchant_ai_actions (
    action_id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    action_type VARCHAR(64) NOT NULL, -- 'RESTOCK', 'DISCOUNT', 'PROMOTION', 'MARK_FOR_REVIEW'
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_APPROVAL', -- 'PENDING_APPROVAL', 'APPROVED', 'EXECUTING', 'COMPLETED', 'REJECTED', 'EXPIRED', 'FAILED', 'CANCELLED'
    product_id INTEGER REFERENCES products(productid) ON DELETE CASCADE,
    product_name VARCHAR(255),
    quantity INTEGER,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    approved_by VARCHAR(64),
    execution_result JSONB,
    failure_reason TEXT,
    idempotency_key VARCHAR(128) UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_merchant_actions_merchant_status ON merchant_ai_actions(merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_merchant_actions_expires_at ON merchant_ai_actions(expires_at);
CREATE INDEX IF NOT EXISTS idx_merchant_actions_prod ON merchant_ai_actions(product_id);
CREATE INDEX IF NOT EXISTS idx_merchant_actions_created_at ON merchant_ai_actions(created_at);

-- 8. Merchant AI Proactive Alerts Table (Phase 3C)
CREATE TABLE IF NOT EXISTS merchant_ai_alerts (
    alert_id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    alert_type VARCHAR(64) NOT NULL,
    severity VARCHAR(32) NOT NULL, -- 'CRITICAL', 'WARNING', 'OPPORTUNITY', 'INFO'
    title VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    fingerprint VARCHAR(128) NOT NULL,
    related_product_id INTEGER REFERENCES products(productid) ON DELETE SET NULL,
    related_category VARCHAR(64),
    recommended_action VARCHAR(255),
    action_id VARCHAR(64) REFERENCES merchant_ai_actions(action_id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'NEW', -- 'NEW', 'SEEN', 'ACKNOWLEDGED', 'ACTION_PENDING', 'RESOLVED', 'EXPIRED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_ai_alerts_merchant_status ON merchant_ai_alerts(merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_severity ON merchant_ai_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_fingerprint ON merchant_ai_alerts(merchant_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_created ON merchant_ai_alerts(created_at);

-- 9. Merchant AI Scheduled Digests Table (Phase 3C)
CREATE TABLE IF NOT EXISTS merchant_ai_digests (
    digest_id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    digest_type VARCHAR(32) NOT NULL, -- 'DAILY', 'WEEKLY', 'MONTHLY'
    period VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    top_products JSONB DEFAULT '[]'::jsonb,
    inventory_risks JSONB DEFAULT '[]'::jsonb,
    ai_priorities JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_digests_merchant ON merchant_ai_digests(merchant_id, created_at);

-- 10. Merchant AI Preferences & Settings Table (Phase 3C)
CREATE TABLE IF NOT EXISTS merchant_ai_settings (
    merchant_id VARCHAR(64) PRIMARY KEY,
    proactive_insights_enabled BOOLEAN DEFAULT TRUE,
    digest_frequency VARCHAR(32) DEFAULT 'DAILY',
    digest_time VARCHAR(16) DEFAULT '09:00',
    timezone VARCHAR(64) DEFAULT 'Asia/Kolkata',
    alert_preferences JSONB DEFAULT '{"critical": true, "warning": true, "opportunity": true, "info": true}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Merchant AI Smart Coupons & Promotions Table (Phase 3C)
CREATE TABLE IF NOT EXISTS merchant_ai_coupons (
    coupon_id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    code VARCHAR(32) NOT NULL UNIQUE,
    discount_pct NUMERIC(5,2) NOT NULL,
    product_id INTEGER REFERENCES products(productid) ON DELETE CASCADE,
    action_id VARCHAR(64) REFERENCES merchant_ai_actions(action_id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'EXPIRED', 'DISABLED'
    min_order_amount NUMERIC(10,2) DEFAULT 0.00,
    max_discount_amount NUMERIC(10,2),
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_coupons_code ON merchant_ai_coupons(code);
CREATE INDEX IF NOT EXISTS idx_ai_coupons_merchant_status ON merchant_ai_coupons(merchant_id, status);

-- 12. Merchant AI Optimization Recommendations (Phase 4)
CREATE TABLE IF NOT EXISTS merchant_ai_recommendations (
    recommendation_id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    category VARCHAR(32) NOT NULL, -- 'PRICING', 'INVENTORY', 'PROMOTION', 'CUSTOMER', 'CATEGORY'
    goal VARCHAR(32) NOT NULL DEFAULT 'MAXIMIZE_REVENUE', -- 'MAXIMIZE_REVENUE', 'MAXIMIZE_UNITS', 'CLEAR_INVENTORY', 'PROTECT_MARGIN', 'GROW_CUSTOMERS', 'INCREASE_REPEAT_PURCHASES'
    title VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    product_id INTEGER REFERENCES products(productid) ON DELETE SET NULL,
    impact VARCHAR(16) NOT NULL, -- 'HIGH', 'MEDIUM', 'LOW'
    confidence VARCHAR(16) NOT NULL, -- 'HIGH', 'MEDIUM', 'LOW'
    confidence_score NUMERIC(5,2) NOT NULL DEFAULT 0.80,
    urgency VARCHAR(16) NOT NULL, -- 'CRITICAL', 'WARNING', 'INFO'
    risk VARCHAR(16) NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH'
    action_type VARCHAR(64),
    action_id VARCHAR(64) REFERENCES merchant_ai_actions(action_id) ON DELETE SET NULL,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'ACCEPTED', 'DISMISSED', 'EXPIRED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_ai_recs_merchant_status ON merchant_ai_recommendations(merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_recs_goal ON merchant_ai_recommendations(goal);
CREATE INDEX IF NOT EXISTS idx_ai_recs_category ON merchant_ai_recommendations(category);

-- 13. Merchant AI What-If Simulations (Phase 4)
CREATE TABLE IF NOT EXISTS merchant_ai_simulations (
    simulation_id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    scenario_type VARCHAR(64) NOT NULL, -- 'PRICE_CHANGE', 'DISCOUNT_CLEARANCE', 'RESTOCK_EXPANSION', 'CATEGORY_PROMOTION'
    product_id INTEGER REFERENCES products(productid) ON DELETE SET NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    current_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    projected_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence VARCHAR(16) NOT NULL,
    risk_assessment TEXT NOT NULL,
    recommendation_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_sims_merchant ON merchant_ai_simulations(merchant_id, created_at);

-- 14. Merchant AI Experiments (A/B Test Foundation) (Phase 4)
CREATE TABLE IF NOT EXISTS merchant_ai_experiments (
    experiment_id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    name VARCHAR(255) NOT NULL,
    experiment_type VARCHAR(32) NOT NULL, -- 'PRICE_TEST', 'DISCOUNT_TEST', 'PROMOTION_TEST'
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'RUNNING', 'CONCLUDED', 'CANCELLED'
    product_id INTEGER REFERENCES products(productid) ON DELETE CASCADE,
    control_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    variant_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    metrics JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE,
    concluded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_exp_merchant_status ON merchant_ai_experiments(merchant_id, status);

-- 15. Merchant AI Post-Action Outcomes & Learning Feedback (Phase 4)
CREATE TABLE IF NOT EXISTS merchant_ai_outcomes (
    outcome_id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    action_id VARCHAR(64) REFERENCES merchant_ai_actions(action_id) ON DELETE CASCADE,
    action_type VARCHAR(64) NOT NULL,
    product_id INTEGER REFERENCES products(productid) ON DELETE SET NULL,
    before_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    after_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    velocity_change_pct NUMERIC(8,2),
    revenue_change_pct NUMERIC(8,2),
    evaluation_summary TEXT NOT NULL,
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_outcomes_action ON merchant_ai_outcomes(action_id);
CREATE INDEX IF NOT EXISTS idx_ai_outcomes_merchant ON merchant_ai_outcomes(merchant_id, measured_at);

-- 16. Merchant Suppliers (Phase 5)
CREATE TABLE IF NOT EXISTS merchant_suppliers (
    supplier_id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    name VARCHAR(255) NOT NULL,
    lead_time_days INTEGER NOT NULL DEFAULT 7,
    minimum_order_quantity INTEGER NOT NULL DEFAULT 25,
    unit_cost NUMERIC(10,2),
    reliability_score VARCHAR(16) NOT NULL DEFAULT 'HIGH', -- 'HIGH', 'MEDIUM', 'LOW'
    contact JSONB NOT NULL DEFAULT '{}'::jsonb,
    supported_products JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE'
    is_synthetic BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_suppliers_merchant ON merchant_suppliers(merchant_id, status);

-- 17. Merchant Purchase Orders (Phase 5)
CREATE TABLE IF NOT EXISTS merchant_purchase_orders (
    po_id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    po_number VARCHAR(64) NOT NULL UNIQUE,
    supplier_id VARCHAR(64) REFERENCES merchant_suppliers(supplier_id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'APPROVAL_REQUIRED', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    approved_by VARCHAR(64),
    sent_at TIMESTAMP WITH TIME ZONE,
    received_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_po_merchant_status ON merchant_purchase_orders(merchant_id, status);

-- 18. Merchant Purchase Order Audit Events (Phase 5)
CREATE TABLE IF NOT EXISTS merchant_purchase_order_events (
    event_id VARCHAR(64) PRIMARY KEY,
    po_id VARCHAR(64) REFERENCES merchant_purchase_orders(po_id) ON DELETE CASCADE,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    from_status VARCHAR(32),
    to_status VARCHAR(32) NOT NULL,
    triggered_by VARCHAR(64) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_po_events_po ON merchant_purchase_order_events(po_id, created_at);

-- 19. Merchant Supplier Performance (Phase 5)
CREATE TABLE IF NOT EXISTS merchant_supplier_performance (
    perf_id VARCHAR(64) PRIMARY KEY,
    supplier_id VARCHAR(64) REFERENCES merchant_suppliers(supplier_id) ON DELETE CASCADE,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    on_time_pct NUMERIC(5,2) NOT NULL DEFAULT 95.0,
    avg_lead_time_days NUMERIC(5,2) NOT NULL DEFAULT 5.0,
    fill_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 98.0,
    total_orders_count INTEGER NOT NULL DEFAULT 10,
    reliability_score VARCHAR(16) NOT NULL DEFAULT 'HIGH',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_supp_perf_supp ON merchant_supplier_performance(supplier_id);

-- 20. Merchant Cannibalization & Product Substitution (Phase 5)
CREATE TABLE IF NOT EXISTS merchant_cannibalization (
    cannibalization_id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    product_id_a INTEGER REFERENCES products(productid) ON DELETE CASCADE,
    product_id_b INTEGER REFERENCES products(productid) ON DELETE CASCADE,
    similarity_score NUMERIC(5,2) NOT NULL DEFAULT 0.50,
    substitution_confidence VARCHAR(16) NOT NULL DEFAULT 'MEDIUM', -- 'HIGH', 'MEDIUM', 'LOW'
    cross_elasticity_proxy NUMERIC(6,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cannibal_prods ON merchant_cannibalization(product_id_a, product_id_b);

-- 21. Merchant Customer Lifetime Value & Churn Risk (Phase 5)
CREATE TABLE IF NOT EXISTS merchant_customer_value (
    value_id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    user_id INTEGER REFERENCES users(userid) ON DELETE CASCADE,
    historical_spend NUMERIC(12,2) NOT NULL DEFAULT 0,
    order_count INTEGER NOT NULL DEFAULT 0,
    current_clv NUMERIC(12,2) NOT NULL DEFAULT 0,
    expected_clv NUMERIC(12,2) NOT NULL DEFAULT 0,
    clv_trend VARCHAR(16) NOT NULL DEFAULT 'STABLE', -- 'EXPANDING', 'STABLE', 'DECLINING'
    churn_risk VARCHAR(16) NOT NULL DEFAULT 'LOW', -- 'LOW', 'MEDIUM', 'HIGH'
    confidence VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cust_val_user ON merchant_customer_value(user_id);
CREATE INDEX IF NOT EXISTS idx_cust_val_churn ON merchant_customer_value(churn_risk);

-- 22. Merchant Executive Decisions (Phase 5)
CREATE TABLE IF NOT EXISTS merchant_decisions (
    decision_id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    decision_date DATE NOT NULL DEFAULT CURRENT_DATE,
    top_priorities JSONB NOT NULL DEFAULT '[]'::jsonb,
    second_order_effects JSONB NOT NULL DEFAULT '[]'::jsonb,
    data_health_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_decisions_merchant_date ON merchant_decisions(merchant_id, decision_date);

-- 23. Merchant Warehouses (Phase 6)
CREATE TABLE IF NOT EXISTS merchant_warehouses (
    warehouse_id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'IN',
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    capacity INTEGER NOT NULL DEFAULT 10000,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    shipping_zones JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_warehouses_merchant ON merchant_warehouses(merchant_id, status);

-- 24. Merchant Warehouse Inventory (Phase 6)
CREATE TABLE IF NOT EXISTS merchant_warehouse_inventory (
    id VARCHAR(64) PRIMARY KEY,
    warehouse_id VARCHAR(64) REFERENCES merchant_warehouses(warehouse_id) ON DELETE CASCADE,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    product_id INTEGER REFERENCES products(productid) ON DELETE CASCADE,
    available_quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    reorder_point INTEGER NOT NULL DEFAULT 20,
    safety_stock INTEGER NOT NULL DEFAULT 10,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_wh_product UNIQUE(warehouse_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wh_inv_wh ON merchant_warehouse_inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_wh_inv_prod ON merchant_warehouse_inventory(product_id);

-- 25. Merchant Inventory Transfers (Phase 6)
CREATE TABLE IF NOT EXISTS merchant_inventory_transfers (
    transfer_id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    source_warehouse_id VARCHAR(64) REFERENCES merchant_warehouses(warehouse_id) ON DELETE CASCADE,
    target_warehouse_id VARCHAR(64) REFERENCES merchant_warehouses(warehouse_id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(productid) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'APPROVAL_REQUIRED', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'
    estimated_shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
    action_id VARCHAR(64),
    reason TEXT,
    approved_by VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_transfers_merchant ON merchant_inventory_transfers(merchant_id, status);

-- 26. Merchant Capital Allocations (Phase 6)
CREATE TABLE IF NOT EXISTS merchant_capital_allocations (
    allocation_id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    total_budget NUMERIC(14,2) NOT NULL,
    allocations JSONB NOT NULL DEFAULT '[]'::jsonb,
    projected_revenue_min NUMERIC(14,2),
    projected_revenue_max NUMERIC(14,2),
    confidence VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(32) NOT NULL DEFAULT 'PROPOSED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cap_alloc_merchant ON merchant_capital_allocations(merchant_id, created_at);

-- 27. Merchant Ad Campaigns & Budget Allocation (Phase 6)
CREATE TABLE IF NOT EXISTS merchant_ad_campaigns (
    campaign_id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    product_id INTEGER REFERENCES products(productid) ON DELETE CASCADE,
    channel VARCHAR(32) NOT NULL DEFAULT 'DIRECT_STORE', -- 'GOOGLE', 'META', 'AMAZON', 'DIRECT_STORE'
    allocated_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'PLANNED',
    is_eligible BOOLEAN NOT NULL DEFAULT true,
    eligibility_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ad_camp_prod ON merchant_ad_campaigns(product_id, channel);

-- 28. Merchant Product COGS & Cost Structure (Phase 6)
CREATE TABLE IF NOT EXISTS merchant_product_cogs (
    cogs_id VARCHAR(64) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'default_merchant',
    product_id INTEGER REFERENCES products(productid) ON DELETE CASCADE UNIQUE,
    unit_cost NUMERIC(10,2),
    supplier_cost NUMERIC(10,2),
    shipping_cost NUMERIC(10,2),
    handling_cost NUMERIC(10,2),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cogs_prod ON merchant_product_cogs(product_id);

-- ==========================================
-- PHASE 7: SELF-LEARNING & MODEL REGISTRY
-- ==========================================

CREATE TABLE IF NOT EXISTS merchant_model_versions (
    model_id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    model_type TEXT NOT NULL,
    version INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SHADOW',
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    sample_count INT NOT NULL DEFAULT 0,
    training_window TEXT DEFAULT '60_DAYS',
    metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    promoted_at TIMESTAMP WITH TIME ZONE,
    retired_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_models_merchant_type ON merchant_model_versions(merchant_id, model_type, status);

CREATE TABLE IF NOT EXISTS merchant_learning_feedback (
    feedback_id TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    feedback_type TEXT NOT NULL,
    rating_score INT,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feedback_merchant_decision ON merchant_learning_feedback(merchant_id, decision_id);

CREATE TABLE IF NOT EXISTS merchant_ai_memory (
    memory_id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    preference_key TEXT NOT NULL,
    preference_value JSONB NOT NULL,
    evidence_count INT NOT NULL DEFAULT 1,
    confidence TEXT NOT NULL DEFAULT 'MEDIUM',
    last_reinforced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unq_merchant_pref UNIQUE (merchant_id, preference_key)
);

CREATE INDEX IF NOT EXISTS idx_memory_merchant ON merchant_ai_memory(merchant_id);

CREATE TABLE IF NOT EXISTS merchant_learning_metrics (
    metric_id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value NUMERIC(14,4) NOT NULL,
    sample_count INT NOT NULL DEFAULT 0,
    confidence TEXT NOT NULL DEFAULT 'MEDIUM',
    details JSONB DEFAULT '{}'::jsonb,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_metrics_merchant_domain ON merchant_learning_metrics(merchant_id, domain);
