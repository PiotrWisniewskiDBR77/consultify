-- Payment Methods Management
-- Stores Stripe payment method references for organizations

CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    stripe_payment_method_id TEXT NOT NULL,
    type TEXT DEFAULT 'card', -- card, bank_account, etc.
    brand TEXT, -- visa, mastercard, amex, etc.
    last4 TEXT,
    exp_month INTEGER,
    exp_year INTEGER,
    holder_name TEXT,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_org ON payment_methods(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(organization_id, is_default);

-- Billing Alerts Configuration
CREATE TABLE IF NOT EXISTS billing_alerts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    token_threshold_80 INTEGER DEFAULT 1, -- Alert at 80%
    token_threshold_90 INTEGER DEFAULT 1, -- Alert at 90%
    token_threshold_100 INTEGER DEFAULT 1, -- Alert at 100%
    storage_threshold_80 INTEGER DEFAULT 1,
    storage_threshold_90 INTEGER DEFAULT 1,
    storage_threshold_100 INTEGER DEFAULT 1,
    auto_upgrade_enabled INTEGER DEFAULT 0,
    auto_upgrade_plan_id TEXT,
    cost_cap_monthly REAL, -- Hard limit in USD
    email_notifications INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (auto_upgrade_plan_id) REFERENCES subscription_plans(id)
);

-- Tax/VAT Settings
CREATE TABLE IF NOT EXISTS billing_tax_settings (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    tax_id TEXT, -- VAT/Tax ID number
    tax_id_type TEXT, -- eu_vat, us_ein, etc.
    tax_exempt INTEGER DEFAULT 0,
    billing_name TEXT,
    billing_email TEXT,
    billing_address_line1 TEXT,
    billing_address_line2 TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_postal_code TEXT,
    billing_country TEXT,
    invoice_prefix TEXT, -- Custom invoice prefix
    po_number TEXT, -- Purchase Order number
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Coupon/Discount Codes
CREATE TABLE IF NOT EXISTS discount_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    stripe_coupon_id TEXT,
    discount_type TEXT NOT NULL, -- percent, fixed_amount
    discount_value REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    valid_from DATETIME,
    valid_until DATETIME,
    applicable_plans TEXT, -- JSON array of plan IDs, null = all plans
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Usage Alerts Log
CREATE TABLE IF NOT EXISTS billing_alert_history (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    alert_type TEXT NOT NULL, -- token_80, token_90, storage_100, etc.
    threshold_value REAL,
    current_value REAL,
    notified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    acknowledged INTEGER DEFAULT 0,
    acknowledged_by TEXT,
    acknowledged_at DATETIME,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Extend organization_billing with trial and coupon info
ALTER TABLE organization_billing ADD COLUMN trial_ends_at DATETIME;
ALTER TABLE organization_billing ADD COLUMN discount_code_id TEXT REFERENCES discount_codes(id);
ALTER TABLE organization_billing ADD COLUMN discount_ends_at DATETIME;





