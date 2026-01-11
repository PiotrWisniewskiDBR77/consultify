-- Migration: 217_partner_discount_system.sql
-- Description: Partner discount configuration and organization discounts
-- Created: 2026-01-09

-- ==========================================
-- Partner Discount Configuration
-- Global settings for partner program discounts
-- ==========================================

CREATE TABLE IF NOT EXISTS partner_discount_config (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    discount_type TEXT NOT NULL DEFAULT 'PERCENTAGE' CHECK (discount_type IN ('PERCENTAGE', 'FLAT')),
    discount_value REAL NOT NULL DEFAULT 15.00,
    duration_months INTEGER NOT NULL DEFAULT 12,
    max_discount_per_month REAL,
    tier_overrides TEXT DEFAULT '{}', -- JSON: tier-specific overrides
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Insert default configuration
INSERT INTO partner_discount_config (id, discount_type, discount_value, duration_months, is_active)
VALUES (
    lower(hex(randomblob(16))),
    'PERCENTAGE',
    15.00,
    12,
    1
) ON CONFLICT DO NOTHING;

-- ==========================================
-- Organization Discounts
-- Tracks discounts applied to organizations via partner referral
-- ==========================================

CREATE TABLE IF NOT EXISTS organization_discounts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT NOT NULL,
    partner_org_id TEXT NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FLAT')),
    discount_value REAL NOT NULL,
    start_date TEXT DEFAULT (datetime('now')),
    end_date TEXT NOT NULL,
    total_discount_applied REAL DEFAULT 0.00,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
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
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tier TEXT NOT NULL UNIQUE,
    tier_name TEXT NOT NULL,
    rate REAL NOT NULL DEFAULT 10.00,
    min_revenue REAL DEFAULT 0,
    color TEXT DEFAULT 'bg-slate-500',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Insert default tier rates
INSERT INTO partner_commission_rates (id, tier, tier_name, rate, min_revenue, color) VALUES
    (lower(hex(randomblob(16))), 'REGISTERED', 'Registered', 10.00, 0, 'bg-slate-500'),
    (lower(hex(randomblob(16))), 'BRONZE', 'Bronze', 12.00, 5000, 'bg-amber-600'),
    (lower(hex(randomblob(16))), 'SILVER', 'Silver', 15.00, 15000, 'bg-slate-400'),
    (lower(hex(randomblob(16))), 'GOLD', 'Gold', 18.00, 50000, 'bg-yellow-500'),
    (lower(hex(randomblob(16))), 'PLATINUM', 'Platinum', 20.00, 100000, 'bg-violet-500')
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
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    minimum_threshold REAL NOT NULL DEFAULT 100.00,
    payout_schedule TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (payout_schedule IN ('WEEKLY', 'BIWEEKLY', 'MONTHLY')),
    processing_fee_percent REAL DEFAULT 1.00,
    auto_payout_enabled INTEGER DEFAULT 0,
    payment_methods TEXT DEFAULT '["BANK_TRANSFER"]', -- JSON array
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Insert default payout settings
INSERT INTO partner_payout_settings (id, minimum_threshold, payout_schedule, processing_fee_percent, auto_payout_enabled, payment_methods)
VALUES (
    lower(hex(randomblob(16))),
    100.00,
    'MONTHLY',
    1.00,
    0,
    '["BANK_TRANSFER"]'
) ON CONFLICT DO NOTHING;

-- ==========================================
-- Add updated_at trigger
-- ==========================================

-- Trigger for partner_discount_config
DROP TRIGGER IF EXISTS update_partner_discount_config_timestamp;
CREATE TRIGGER update_partner_discount_config_timestamp
    AFTER UPDATE ON partner_discount_config
    FOR EACH ROW
BEGIN
    UPDATE partner_discount_config SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Trigger for organization_discounts
DROP TRIGGER IF EXISTS update_org_discounts_timestamp;
CREATE TRIGGER update_org_discounts_timestamp
    AFTER UPDATE ON organization_discounts
    FOR EACH ROW
BEGIN
    UPDATE organization_discounts SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Trigger for partner_commission_rates
DROP TRIGGER IF EXISTS update_partner_commission_rates_timestamp;
CREATE TRIGGER update_partner_commission_rates_timestamp
    AFTER UPDATE ON partner_commission_rates
    FOR EACH ROW
BEGIN
    UPDATE partner_commission_rates SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Trigger for partner_payout_settings
DROP TRIGGER IF EXISTS update_partner_payout_settings_timestamp;
CREATE TRIGGER update_partner_payout_settings_timestamp
    AFTER UPDATE ON partner_payout_settings
    FOR EACH ROW
BEGIN
    UPDATE partner_payout_settings SET updated_at = datetime('now') WHERE id = NEW.id;
END;
