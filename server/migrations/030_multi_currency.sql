-- Migration: 030_multi_currency.sql
-- Multi-Currency Support for Global Billing
-- Created: 2025-12-21

-- Currency preference per organization
ALTER TABLE organizations ADD COLUMN billing_currency TEXT DEFAULT 'USD';
ALTER TABLE organizations ADD COLUMN billing_country TEXT;
ALTER TABLE organizations ADD COLUMN vat_number TEXT;
ALTER TABLE organizations ADD COLUMN tax_exempt INTEGER DEFAULT 0;

-- Exchange rates cache
CREATE TABLE IF NOT EXISTS exchange_rates (
    id TEXT PRIMARY KEY,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate REAL NOT NULL,
    source TEXT DEFAULT 'openexchangerates', -- API source
    fetched_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    UNIQUE(from_currency, to_currency)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair ON exchange_rates(from_currency, to_currency);

-- Invoices with currency
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    stripe_invoice_id TEXT,
    invoice_number TEXT UNIQUE,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
    
    -- Amounts
    subtotal INTEGER NOT NULL, -- in smallest currency unit (cents)
    tax_amount INTEGER DEFAULT 0,
    total INTEGER NOT NULL,
    amount_paid INTEGER DEFAULT 0,
    amount_due INTEGER,
    
    -- Currency
    currency TEXT DEFAULT 'USD',
    exchange_rate REAL DEFAULT 1.0, -- Rate at time of creation
    base_currency TEXT DEFAULT 'USD',
    base_total INTEGER, -- Total in base currency
    
    -- Tax info
    tax_rate REAL,
    tax_type TEXT, -- 'vat', 'gst', 'sales_tax'
    tax_id TEXT,
    
    -- Dates
    invoice_date TEXT DEFAULT (datetime('now')),
    due_date TEXT,
    paid_at TEXT,
    
    -- Metadata
    billing_period_start TEXT,
    billing_period_end TEXT,
    description TEXT,
    notes TEXT,
    pdf_url TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);

-- Invoice line items
CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price INTEGER NOT NULL, -- in smallest currency unit
    amount INTEGER NOT NULL,
    metadata TEXT, -- JSON
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- Supported currencies
CREATE TABLE IF NOT EXISTS supported_currencies (
    code TEXT PRIMARY KEY, -- ISO 4217 code
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    decimal_places INTEGER DEFAULT 2,
    is_active INTEGER DEFAULT 1
);

-- Insert default currencies
INSERT OR IGNORE INTO supported_currencies (code, name, symbol, decimal_places) VALUES
    ('USD', 'US Dollar', '$', 2),
    ('EUR', 'Euro', '€', 2),
    ('GBP', 'British Pound', '£', 2),
    ('PLN', 'Polish Złoty', 'zł', 2),
    ('CHF', 'Swiss Franc', 'CHF', 2),
    ('CAD', 'Canadian Dollar', 'C$', 2),
    ('AUD', 'Australian Dollar', 'A$', 2),
    ('JPY', 'Japanese Yen', '¥', 0);
