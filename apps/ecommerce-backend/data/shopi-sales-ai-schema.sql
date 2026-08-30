-- ============================================================
-- Shopi Sales AI - V1 Intelligence Layer
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. AI PRODUCT PROFILE
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shopi_ai_product_profiles (
    product_id INTEGER PRIMARY KEY
        REFERENCES products(productid)
        ON DELETE CASCADE,

    ai_summary TEXT,

    strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
    weaknesses JSONB NOT NULL DEFAULT '[]'::jsonb,

    best_for JSONB NOT NULL DEFAULT '[]'::jsonb,
    not_best_for JSONB NOT NULL DEFAULT '[]'::jsonb,

    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,

    value_proposition TEXT,
    main_tradeoff TEXT,

    buying_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    objection_points JSONB NOT NULL DEFAULT '[]'::jsonb,

    sales_notes TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ------------------------------------------------------------
-- 2. REVIEW INTELLIGENCE
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shopi_ai_review_insights (
    product_id INTEGER PRIMARY KEY
        REFERENCES products(productid)
        ON DELETE CASCADE,

    total_reviews INTEGER NOT NULL DEFAULT 0,
    average_rating NUMERIC(3,2) NOT NULL DEFAULT 0,

    positive_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
    neutral_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
    negative_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,

    positive_summary TEXT,
    negative_summary TEXT,

    aspect_scores JSONB NOT NULL DEFAULT '{}'::jsonb,

    common_pros JSONB NOT NULL DEFAULT '[]'::jsonb,
    common_cons JSONB NOT NULL DEFAULT '[]'::jsonb,

    representative_positive_reviews JSONB NOT NULL DEFAULT '[]'::jsonb,
    representative_negative_reviews JSONB NOT NULL DEFAULT '[]'::jsonb,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ------------------------------------------------------------
-- 3. PRODUCT RELATIONSHIPS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shopi_ai_product_relationships (
    id BIGSERIAL PRIMARY KEY,

    source_product_id INTEGER NOT NULL
        REFERENCES products(productid)
        ON DELETE CASCADE,

    target_product_id INTEGER NOT NULL
        REFERENCES products(productid)
        ON DELETE CASCADE,

    relationship_type VARCHAR(50) NOT NULL,

    similarity_score NUMERIC(5,4),

    reason TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT shopi_ai_no_self_relationship
        CHECK (source_product_id <> target_product_id),

    CONSTRAINT shopi_ai_unique_relationship
        UNIQUE (
            source_product_id,
            target_product_id,
            relationship_type
        )
);


-- ------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_shopi_ai_relationship_source
    ON shopi_ai_product_relationships(source_product_id);

CREATE INDEX IF NOT EXISTS idx_shopi_ai_relationship_target
    ON shopi_ai_product_relationships(target_product_id);

CREATE INDEX IF NOT EXISTS idx_shopi_ai_relationship_type
    ON shopi_ai_product_relationships(relationship_type);


COMMIT;