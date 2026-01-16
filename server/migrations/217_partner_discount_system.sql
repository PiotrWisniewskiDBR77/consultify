-- Migration: 217_partner_discount_system.sql
-- Description: Partner discount configuration and organization discounts
-- Created: 2026-01-09

-- ==========================================
-- Partner Discount Configuration
-- Global settings for partner program discounts
-- ==========================================

CREATE TABLE IF NOT EXISTS partner_discount_config (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    discount_type TEXT NOT NULL DEFAULT 'PERCENTAGE' CHECK (discount_type IN ('PERCENTAGE', 'FLAT')),
    discount_value REAL NOT NULL DEFAULT 15.00,
    duration_months INTEGER NOT NULL DEFAULT 12,
    max_discount_per_month REAL,
    tier_overrides TEXT DEFAULT '{}', -- JSON: tier-specific overrides
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default configuration
INSERT INTO partner_discount_config (id, discount_type, discount_value, duration_months, is_active)
VALUES (
    gen_random_uuid()::text,
    'PERCENTAGE',
    15.00,
    12,
    TRUE
) ON CONFLICT DO NOTHING;

-- ==========================================
-- Organization Discounts
-- Tracks discounts applied to organizations via partner referral
-- ==========================================

CREATE TABLE IF NOT EXISTS organization_discounts (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    organization_id TEXT NOT NULL,
    partner_org_id TEXT NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FLAT')),
    discount_value REAL NOT NULL,
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP NOT NULL,
    total_discount_applied REAL DEFAULT 0.00,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (partner_org_id) REFERENCES partner_organizations(id)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_org_discounts_org_id ON organization_discounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_discounts_partner_id ON organization_discounts(partner_org_id);
CREATE INDEX IF NOT EXISTS idx_org_discounts_status ON organization_discounts(status);

-- ==========================================
-- Partner Commission Rates
-- Configurable commission rates per tier
-- ==========================================

CREATE TABLE IF NOT EXISTS partner_commission_rates (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    tier TEXT NOT NULL UNIQUE,
    tier_name TEXT NOT NULL,
    rate REAL NOT NULL DEFAULT 10.00,
    min_revenue REAL DEFAULT 0,
    color TEXT DEFAULT 'bg-slate-500',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default tier rates
INSERT INTO partner_commission_rates (id, tier, tier_name, rate, min_revenue, color) VALUES
    (gen_random_uuid()::text, 'REGISTERED', 'Registered', 10.00, 0, 'bg-slate-500'),
    (gen_random_uuid()::text, 'BRONZE', 'Bronze', 12.00, 5000, 'bg-amber-600'),
    (gen_random_uuid()::text, 'SILVER', 'Silver', 15.00, 15000, 'bg-slate-400'),
    (gen_random_uuid()::text, 'GOLD', 'Gold', 18.00, 50000, 'bg-yellow-500'),
    (gen_random_uuid()::text, 'PLATINUM', 'Platinum', 20.00, 100000, 'bg-violet-500')
ON CONFLICT (tier) DO UPDATE SET
    tier_name = excluded.tier_name,
    rate = excluded.rate,
    min_revenue = excluded.min_revenue,
    color = excluded.color;

-- ==========================================
-- Partner Payout Settings
-- Global payout configuration
-- ==========================================

CREATE TABLE IF NOT EXISTS partner_payout_settings (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    minimum_threshold REAL NOT NULL DEFAULT 100.00,
    payout_schedule TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (payout_schedule IN ('WEEKLY', 'BIWEEKLY', 'MONTHLY')),
    processing_fee_percent REAL DEFAULT 1.00,
    auto_payout_enabled BOOLEAN DEFAULT FALSE,
    payment_methods TEXT DEFAULT '["BANK_TRANSFER"]', -- JSON array
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default payout settings
INSERT INTO partner_payout_settings (id, minimum_threshold, payout_schedule, processing_fee_percent, auto_payout_enabled, payment_methods)
VALUES (
    gen_random_uuid()::text,
    100.00,
    'MONTHLY',
    1.00,
    FALSE,
    '["BANK_TRANSFER"]'
) ON CONFLICT DO NOTHING;

-- ==========================================
-- Add updated_at trigger
-- ==========================================
-- Note: SQLite-style triggers are skipped in PostgreSQL migration
-- PostgreSQL triggers require different syntax and are typically handled
-- via application-level logic or PostgreSQL-specific trigger functions
