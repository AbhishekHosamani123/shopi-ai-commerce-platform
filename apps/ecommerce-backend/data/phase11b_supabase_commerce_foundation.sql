-- ==============================================================================
-- PHASE 11B: SUPABASE COMMERCE FOUNDATION SCHEMA
-- ==============================================================================
-- Canonical Source of Truth: Supabase 77 Products & 685 Variants
-- Mode: Strict Referential Integrity, Multi-Tenant Support, Zero-Loss Protection
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. CANONICAL CATALOG MIRROR (Matches Supabase PostgREST Exactly)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shopi_products (
    product_id INTEGER PRIMARY KEY,
    sku VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    department VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    gender VARCHAR(50),
    short_description TEXT,
    description TEXT,
    mrp NUMERIC(10,2) NOT NULL,
    selling_price NUMERIC(10,2) NOT NULL,
    discount_percentage NUMERIC(5,2) DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    source_name VARCHAR(100) DEFAULT 'Canonical Supabase Catalog',
    source_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shopi_products_sku ON shopi_products(sku);
CREATE INDEX IF NOT EXISTS idx_shopi_products_category ON shopi_products(category);
CREATE INDEX IF NOT EXISTS idx_shopi_products_dept ON shopi_products(department);

CREATE TABLE IF NOT EXISTS shopi_product_variants (
    variant_id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES shopi_products(product_id) ON DELETE CASCADE,
    color VARCHAR(100),
    size VARCHAR(50),
    variant_sku VARCHAR(100) UNIQUE,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    additional_options JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_shopi_variants_prod ON shopi_product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_shopi_variants_sku ON shopi_product_variants(variant_sku);

-- ------------------------------------------------------------------------------
-- 2. CUSTOMERS & IDENTITY
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shopi_customers (
    customer_id VARCHAR(100) PRIMARY KEY,
    merchant_id VARCHAR(100) NOT NULL DEFAULT 'default_merchant',
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(20),
    country VARCHAR(50) DEFAULT 'India',
    data_origin VARCHAR(50) NOT NULL DEFAULT 'DEMO_SYNTHETIC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shopi_customers_merchant ON shopi_customers(merchant_id);
CREATE INDEX IF NOT EXISTS idx_shopi_customers_email ON shopi_customers(email);

-- ------------------------------------------------------------------------------
-- 3. CUSTOMER MARKETING CONSENTS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shopi_customer_consents (
    consent_id VARCHAR(100) PRIMARY KEY,
    customer_id VARCHAR(100) NOT NULL REFERENCES shopi_customers(customer_id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL, -- 'EMAIL', 'WHATSAPP', 'SMS'
    consent_status VARCHAR(50) NOT NULL DEFAULT 'OPTED_IN', -- 'OPTED_IN', 'OPTED_OUT', 'SUPPRESSED'
    consent_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    consent_source VARCHAR(100) DEFAULT 'CHECKOUT_CHECKBOX',
    data_origin VARCHAR(50) NOT NULL DEFAULT 'DEMO_SYNTHETIC',
    CONSTRAINT uniq_customer_channel UNIQUE (customer_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_shopi_consents_customer ON shopi_customer_consents(customer_id);

-- ------------------------------------------------------------------------------
-- 4. MARKETING CAMPAIGNS & PROMOTIONS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shopi_campaigns (
    campaign_id VARCHAR(100) PRIMARY KEY,
    merchant_id VARCHAR(100) NOT NULL DEFAULT 'default_merchant',
    campaign_name VARCHAR(255) NOT NULL,
    campaign_type VARCHAR(50) NOT NULL, -- 'CART_ABANDONMENT_RECOVERY', 'WIN_BACK_DORMANT', 'VIP_EXCLUSIVE', 'HIGH_INTENT_NUDGE', 'NEW_ARRIVALS'
    target_segment VARCHAR(100) NOT NULL, -- 'CART_ABANDONERS', 'CHECKOUT_ABANDONERS', 'DORMANT_CUSTOMERS', 'VIP_CUSTOMERS', 'HIGH_INTENT_PROSPECTS'
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'PAUSED'
    channel VARCHAR(50) NOT NULL DEFAULT 'EMAIL', -- 'EMAIL', 'WHATSAPP'
    discount_type VARCHAR(50), -- 'PERCENTAGE', 'FIXED_AMOUNT'
    discount_value NUMERIC(10,2),
    coupon_code VARCHAR(100),
    audience_size INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    opened_count INTEGER NOT NULL DEFAULT 0,
    clicked_count INTEGER NOT NULL DEFAULT 0,
    converted_orders_count INTEGER NOT NULL DEFAULT 0,
    attributed_revenue NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    data_origin VARCHAR(50) NOT NULL DEFAULT 'DEMO_SYNTHETIC',
    start_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shopi_campaigns_merchant ON shopi_campaigns(merchant_id);
CREATE INDEX IF NOT EXISTS idx_shopi_campaigns_status ON shopi_campaigns(status);

CREATE TABLE IF NOT EXISTS shopi_coupons (
    coupon_id VARCHAR(100) PRIMARY KEY,
    coupon_code VARCHAR(100) NOT NULL UNIQUE,
    campaign_id VARCHAR(100) REFERENCES shopi_campaigns(campaign_id) ON DELETE SET NULL,
    discount_type VARCHAR(50) NOT NULL, -- 'PERCENTAGE', 'FIXED_AMOUNT'
    discount_value NUMERIC(10,2) NOT NULL,
    minimum_order_value NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    max_discount_amount NUMERIC(10,2),
    applicable_product_id INTEGER REFERENCES shopi_products(product_id) ON DELETE SET NULL,
    max_redemptions INTEGER NOT NULL DEFAULT 100,
    current_redemptions INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    data_origin VARCHAR(50) NOT NULL DEFAULT 'DEMO_SYNTHETIC',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shopi_coupons_code ON shopi_coupons(coupon_code);

-- ------------------------------------------------------------------------------
-- 5. ORDERS & LINE ITEMS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shopi_orders (
    order_id VARCHAR(100) PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id VARCHAR(100) NOT NULL REFERENCES shopi_customers(customer_id) ON DELETE CASCADE,
    merchant_id VARCHAR(100) NOT NULL DEFAULT 'default_merchant',
    order_status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED', -- 'COMPLETED', 'DELIVERED', 'PROCESSING', 'CANCELLED', 'RETURNED'
    payment_status VARCHAR(50) NOT NULL DEFAULT 'PAID', -- 'PAID', 'REFUNDED', 'PENDING', 'FAILED'
    payment_method VARCHAR(50) DEFAULT 'RAZORPAY_UPI',
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    subtotal_amount NUMERIC(12,2) NOT NULL,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    shipping_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL,
    coupon_code VARCHAR(100),
    campaign_id VARCHAR(100) REFERENCES shopi_campaigns(campaign_id) ON DELETE SET NULL,
    utm_source VARCHAR(100),
    utm_campaign VARCHAR(100),
    data_origin VARCHAR(50) NOT NULL DEFAULT 'DEMO_SYNTHETIC',
    order_placed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shopi_orders_customer ON shopi_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_shopi_orders_merchant ON shopi_orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_shopi_orders_date ON shopi_orders(order_placed_at);
CREATE INDEX IF NOT EXISTS idx_shopi_orders_campaign ON shopi_orders(campaign_id);

CREATE TABLE IF NOT EXISTS shopi_order_items (
    order_item_id VARCHAR(100) PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL REFERENCES shopi_orders(order_id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES shopi_products(product_id) ON DELETE RESTRICT,
    variant_id INTEGER REFERENCES shopi_product_variants(variant_id) ON DELETE SET NULL,
    sku VARCHAR(100) NOT NULL,
    variant_sku VARCHAR(100),
    product_title VARCHAR(255) NOT NULL,
    selected_color VARCHAR(100),
    selected_size VARCHAR(50),
    unit_price NUMERIC(10,2) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    line_total NUMERIC(12,2) NOT NULL,
    unit_cogs NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    contribution_margin NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    data_origin VARCHAR(50) NOT NULL DEFAULT 'DEMO_SYNTHETIC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shopi_order_items_order ON shopi_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_shopi_order_items_product ON shopi_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_shopi_order_items_variant ON shopi_order_items(variant_id);

-- ------------------------------------------------------------------------------
-- 6. CUSTOMER BEHAVIORAL CLICKSTREAM & TELEMETRY
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shopi_customer_events (
    event_id VARCHAR(100) PRIMARY KEY,
    customer_id VARCHAR(100) REFERENCES shopi_customers(customer_id) ON DELETE CASCADE,
    session_id VARCHAR(100) NOT NULL,
    merchant_id VARCHAR(100) NOT NULL DEFAULT 'default_merchant',
    event_type VARCHAR(50) NOT NULL, -- 'PRODUCT_VIEW', 'ADD_TO_CART', 'REMOVE_FROM_CART', 'CHECKOUT_STARTED', 'PURCHASE', 'PRODUCT_WISHLIST', 'SEARCH'
    product_id INTEGER REFERENCES shopi_products(product_id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES shopi_product_variants(variant_id) ON DELETE SET NULL,
    sku VARCHAR(100),
    variant_sku VARCHAR(100),
    search_query TEXT,
    cart_quantity INTEGER,
    cart_value NUMERIC(12,2),
    order_id VARCHAR(100) REFERENCES shopi_orders(order_id) ON DELETE SET NULL,
    page_url TEXT,
    referrer TEXT,
    utm_source VARCHAR(100),
    utm_campaign VARCHAR(100),
    data_origin VARCHAR(50) NOT NULL DEFAULT 'DEMO_SYNTHETIC',
    event_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shopi_events_customer ON shopi_customer_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_shopi_events_product ON shopi_customer_events(product_id);
CREATE INDEX IF NOT EXISTS idx_shopi_events_type ON shopi_customer_events(event_type);
CREATE INDEX IF NOT EXISTS idx_shopi_events_time ON shopi_customer_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_shopi_events_session ON shopi_customer_events(session_id);

-- ------------------------------------------------------------------------------
-- 7. UNIT ECONOMICS, COGS & PROFITABILITY
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shopi_product_cogs (
    cogs_id VARCHAR(100) PRIMARY KEY,
    product_id INTEGER NOT NULL UNIQUE REFERENCES shopi_products(product_id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    unit_manufacturing_cost NUMERIC(10,2) NOT NULL,
    unit_packaging_cost NUMERIC(10,2) NOT NULL DEFAULT 35.00,
    unit_shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 85.00,
    unit_payment_processing_fee NUMERIC(10,2) NOT NULL DEFAULT 25.00,
    total_unit_cost NUMERIC(10,2) NOT NULL,
    reference_selling_price NUMERIC(10,2) NOT NULL,
    baseline_gross_margin NUMERIC(10,2) NOT NULL,
    baseline_gross_margin_pct NUMERIC(5,2) NOT NULL,
    minimum_margin_floor_pct NUMERIC(5,2) NOT NULL DEFAULT 15.00,
    maximum_safe_discount_amount NUMERIC(10,2) NOT NULL,
    maximum_safe_discount_pct NUMERIC(5,2) NOT NULL,
    is_synthetic BOOLEAN NOT NULL DEFAULT TRUE,
    data_origin VARCHAR(50) NOT NULL DEFAULT 'DEMO_SYNTHETIC',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shopi_cogs_prod ON shopi_product_cogs(product_id);
CREATE INDEX IF NOT EXISTS idx_shopi_cogs_sku ON shopi_product_cogs(sku);

-- ------------------------------------------------------------------------------
-- 8. INVENTORY MOVEMENTS & AUDIT LEDGER
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shopi_inventory_movements (
    movement_id VARCHAR(100) PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES shopi_products(product_id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES shopi_product_variants(variant_id) ON DELETE SET NULL,
    sku VARCHAR(100) NOT NULL,
    variant_sku VARCHAR(100),
    movement_type VARCHAR(50) NOT NULL, -- 'RESTOCK', 'ORDER_DEDUCTION', 'RETURN_RESTOCK', 'DAMAGE_WRITE_OFF', 'AUDIT_ADJUSTMENT'
    quantity_delta INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    reference_order_id VARCHAR(100) REFERENCES shopi_orders(order_id) ON DELETE SET NULL,
    notes TEXT,
    data_origin VARCHAR(50) NOT NULL DEFAULT 'DEMO_SYNTHETIC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shopi_inv_prod ON shopi_inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_shopi_inv_var ON shopi_inventory_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_shopi_inv_time ON shopi_inventory_movements(created_at);

-- ------------------------------------------------------------------------------
-- 9. RETURNS & REFUNDS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shopi_order_returns (
    return_id VARCHAR(100) PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL REFERENCES shopi_orders(order_id) ON DELETE CASCADE,
    order_item_id VARCHAR(100) NOT NULL REFERENCES shopi_order_items(order_item_id) ON DELETE CASCADE,
    customer_id VARCHAR(100) NOT NULL REFERENCES shopi_customers(customer_id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES shopi_products(product_id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES shopi_product_variants(variant_id) ON DELETE SET NULL,
    return_reason VARCHAR(100) NOT NULL, -- 'SIZE_TOO_SMALL', 'SIZE_TOO_LARGE', 'DEFECTIVE', 'NOT_AS_DESCRIBED', 'BUYER_REMORSE'
    return_status VARCHAR(50) NOT NULL DEFAULT 'REFUNDED', -- 'REQUESTED', 'APPROVED', 'RECEIVED', 'REFUNDED', 'REJECTED'
    refund_amount NUMERIC(10,2) NOT NULL,
    is_restockable BOOLEAN NOT NULL DEFAULT TRUE,
    data_origin VARCHAR(50) NOT NULL DEFAULT 'DEMO_SYNTHETIC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shopi_returns_order ON shopi_order_returns(order_id);
CREATE INDEX IF NOT EXISTS idx_shopi_returns_prod ON shopi_order_returns(product_id);

-- ------------------------------------------------------------------------------
-- 10. CAMPAIGN ATTRIBUTION LEDGER
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shopi_campaign_attributions (
    attribution_id VARCHAR(100) PRIMARY KEY,
    campaign_id VARCHAR(100) NOT NULL REFERENCES shopi_campaigns(campaign_id) ON DELETE CASCADE,
    customer_id VARCHAR(100) NOT NULL REFERENCES shopi_customers(customer_id) ON DELETE CASCADE,
    order_id VARCHAR(100) NOT NULL REFERENCES shopi_orders(order_id) ON DELETE CASCADE,
    coupon_code VARCHAR(100),
    attribution_model VARCHAR(50) NOT NULL DEFAULT 'LAST_TOUCH_COUPON',
    attributed_revenue NUMERIC(12,2) NOT NULL,
    attributed_cogs NUMERIC(12,2) NOT NULL,
    attributed_gross_profit NUMERIC(12,2) NOT NULL,
    conversion_timestamp TIMESTAMPTZ NOT NULL,
    data_origin VARCHAR(50) NOT NULL DEFAULT 'DEMO_SYNTHETIC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shopi_attr_campaign ON shopi_campaign_attributions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_shopi_attr_order ON shopi_campaign_attributions(order_id);

-- ------------------------------------------------------------------------------
-- 11. MERCHANT AI ACTIONS & IMPACT LEDGER
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shopi_merchant_actions (
    action_id VARCHAR(100) PRIMARY KEY,
    merchant_id VARCHAR(100) NOT NULL DEFAULT 'default_merchant',
    opportunity_type VARCHAR(100) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    target_entity_type VARCHAR(50) NOT NULL, -- 'PRODUCT', 'CUSTOMER_SEGMENT', 'INVENTORY', 'CAMPAIGN'
    target_entity_id VARCHAR(100) NOT NULL,
    recommendation_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'RECOMMENDED', -- 'RECOMMENDED', 'APPROVED', 'REJECTED', 'EXECUTED'
    projected_impact_revenue NUMERIC(12,2),
    actual_impact_revenue NUMERIC(12,2),
    data_origin VARCHAR(50) NOT NULL DEFAULT 'DEMO_SYNTHETIC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shopi_actions_merchant ON shopi_merchant_actions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_shopi_actions_status ON shopi_merchant_actions(status);

-- ------------------------------------------------------------------------------
-- 12. PRE-COMPUTED DAILY METRICS ROLLUPS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shopi_merchant_daily_metrics (
    metric_date DATE NOT NULL,
    merchant_id VARCHAR(100) NOT NULL DEFAULT 'default_merchant',
    total_revenue NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    total_orders INTEGER NOT NULL DEFAULT 0,
    aov NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    units_sold INTEGER NOT NULL DEFAULT 0,
    gross_profit NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    net_profit NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    product_views INTEGER NOT NULL DEFAULT 0,
    cart_additions INTEGER NOT NULL DEFAULT 0,
    checkout_starts INTEGER NOT NULL DEFAULT 0,
    cart_abandonment_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    checkout_abandonment_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    conversion_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    returned_orders INTEGER NOT NULL DEFAULT 0,
    data_origin VARCHAR(50) NOT NULL DEFAULT 'DEMO_SYNTHETIC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (metric_date, merchant_id)
);

CREATE INDEX IF NOT EXISTS idx_shopi_daily_metrics_date ON shopi_merchant_daily_metrics(metric_date);

COMMIT;
