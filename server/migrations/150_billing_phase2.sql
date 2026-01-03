-- Migration: 150_billing_phase2.sql
-- Billing Module Phase 2: Credit Notes, Invoice Templates, Extended Tax, Analytics
-- Created: 2026-01-02

-- =========================================
-- CREDIT NOTES
-- =========================================

CREATE TABLE IF NOT EXISTS credit_notes (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    invoice_id TEXT, -- Reference to original invoice (optional)
    credit_note_number TEXT UNIQUE NOT NULL,
    stripe_credit_note_id TEXT,
    
    -- Amounts
    subtotal INTEGER NOT NULL, -- in smallest currency unit (cents)
    tax_amount INTEGER DEFAULT 0,
    total INTEGER NOT NULL,
    amount_applied INTEGER DEFAULT 0, -- Amount already applied to invoices
    amount_remaining INTEGER, -- Remaining credit
    
    -- Currency
    currency TEXT DEFAULT 'USD',
    exchange_rate REAL DEFAULT 1.0,
    base_currency TEXT DEFAULT 'USD',
    base_total INTEGER,
    
    -- Status
    status TEXT DEFAULT 'issued' CHECK(status IN ('draft', 'issued', 'applied', 'voided', 'refunded')),
    
    -- Metadata
    reason TEXT NOT NULL CHECK(reason IN ('duplicate', 'fraudulent', 'order_change', 'product_unsatisfactory', 'service_issue', 'billing_error', 'other')),
    reason_details TEXT,
    memo TEXT, -- Internal notes
    customer_memo TEXT, -- Visible to customer
    
    -- Refund info
    refund_amount INTEGER DEFAULT 0,
    stripe_refund_id TEXT,
    refunded_at TEXT,
    
    -- Dates
    issued_at TEXT DEFAULT (datetime('now')),
    voided_at TEXT,
    
    -- Audit
    created_by TEXT,
    voided_by TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_org ON credit_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_status ON credit_notes(status);
CREATE INDEX IF NOT EXISTS idx_credit_notes_number ON credit_notes(credit_note_number);

-- Credit note line items
CREATE TABLE IF NOT EXISTS credit_note_items (
    id TEXT PRIMARY KEY,
    credit_note_id TEXT NOT NULL,
    invoice_item_id TEXT, -- Reference to original invoice item
    description TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price INTEGER NOT NULL, -- in smallest currency unit
    amount INTEGER NOT NULL,
    metadata TEXT, -- JSON
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_credit_note_items_note ON credit_note_items(credit_note_id);

-- Credit applications (tracking how credits are applied)
CREATE TABLE IF NOT EXISTS credit_applications (
    id TEXT PRIMARY KEY,
    credit_note_id TEXT NOT NULL,
    invoice_id TEXT NOT NULL,
    amount INTEGER NOT NULL, -- Amount applied from this credit note to this invoice
    applied_at TEXT DEFAULT (datetime('now')),
    applied_by TEXT,
    FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_credit_applications_note ON credit_applications(credit_note_id);
CREATE INDEX IF NOT EXISTS idx_credit_applications_invoice ON credit_applications(invoice_id);

-- =========================================
-- INVOICE TEMPLATES
-- =========================================

CREATE TABLE IF NOT EXISTS invoice_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT, -- NULL for system templates
    name TEXT NOT NULL,
    description TEXT,
    
    -- Template type
    template_type TEXT DEFAULT 'standard' CHECK(template_type IN ('standard', 'recurring', 'usage', 'credit_note', 'proforma', 'custom')),
    is_default INTEGER DEFAULT 0,
    is_system INTEGER DEFAULT 0, -- System templates cannot be edited/deleted
    
    -- Branding
    logo_url TEXT,
    header_html TEXT,
    footer_html TEXT,
    custom_css TEXT,
    
    -- Content sections
    show_company_info INTEGER DEFAULT 1,
    show_customer_info INTEGER DEFAULT 1,
    show_payment_terms INTEGER DEFAULT 1,
    show_due_date INTEGER DEFAULT 1,
    show_tax_breakdown INTEGER DEFAULT 1,
    show_currency_conversion INTEGER DEFAULT 0,
    
    -- Default values
    payment_terms_days INTEGER DEFAULT 30,
    default_currency TEXT DEFAULT 'USD',
    default_tax_rate REAL,
    default_notes TEXT,
    default_terms TEXT,
    
    -- Localization
    locale TEXT DEFAULT 'en',
    date_format TEXT DEFAULT 'YYYY-MM-DD',
    number_format TEXT DEFAULT 'en-US',
    
    -- Colors (hex)
    primary_color TEXT DEFAULT '#8B5CF6',
    secondary_color TEXT DEFAULT '#10B981',
    text_color TEXT DEFAULT '#1F2937',
    background_color TEXT DEFAULT '#FFFFFF',
    
    -- Layout
    layout_type TEXT DEFAULT 'modern' CHECK(layout_type IN ('classic', 'modern', 'minimal', 'detailed')),
    paper_size TEXT DEFAULT 'A4' CHECK(paper_size IN ('A4', 'Letter', 'Legal')),
    
    -- Metadata
    metadata TEXT, -- JSON for additional customizations
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invoice_templates_org ON invoice_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_type ON invoice_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_default ON invoice_templates(organization_id, is_default);

-- Insert default system templates
INSERT OR IGNORE INTO invoice_templates (id, organization_id, name, description, template_type, is_default, is_system, layout_type) VALUES
    ('tpl-system-standard', NULL, 'Standard Invoice', 'Default invoice template with all standard sections', 'standard', 1, 1, 'modern'),
    ('tpl-system-minimal', NULL, 'Minimal Invoice', 'Clean, minimal invoice design', 'standard', 0, 1, 'minimal'),
    ('tpl-system-detailed', NULL, 'Detailed Invoice', 'Comprehensive invoice with full breakdown', 'standard', 0, 1, 'detailed'),
    ('tpl-system-credit', NULL, 'Credit Note', 'Standard credit note template', 'credit_note', 1, 1, 'modern'),
    ('tpl-system-usage', NULL, 'Usage Invoice', 'Template optimized for usage-based billing', 'usage', 1, 1, 'modern');

-- =========================================
-- EXTENDED TAX RATES
-- =========================================

CREATE TABLE IF NOT EXISTS tax_rates (
    id TEXT PRIMARY KEY,
    stripe_tax_rate_id TEXT,
    
    -- Basic info
    display_name TEXT NOT NULL,
    description TEXT,
    jurisdiction TEXT, -- Country or state code
    jurisdiction_level TEXT CHECK(jurisdiction_level IN ('country', 'state', 'county', 'city', 'district')),
    
    -- Rate info
    percentage REAL NOT NULL, -- Tax rate as percentage (e.g., 23.0 for 23%)
    inclusive INTEGER DEFAULT 0, -- Whether tax is included in price
    
    -- Type
    tax_type TEXT NOT NULL CHECK(tax_type IN ('vat', 'gst', 'hst', 'pst', 'sales_tax', 'withholding', 'other')),
    
    -- Applicability
    country TEXT, -- ISO country code
    state TEXT, -- State/province code
    postal_codes TEXT, -- JSON array of applicable postal codes
    product_categories TEXT, -- JSON array of applicable product categories
    
    -- Status
    is_active INTEGER DEFAULT 1,
    effective_from TEXT,
    effective_until TEXT,
    
    -- Stripe Tax integration
    stripe_tax_code TEXT, -- Stripe Tax code for automatic calculation
    automatic_tax INTEGER DEFAULT 0, -- Use Stripe Tax for automatic calculation
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tax_rates_jurisdiction ON tax_rates(country, state);
CREATE INDEX IF NOT EXISTS idx_tax_rates_type ON tax_rates(tax_type);
CREATE INDEX IF NOT EXISTS idx_tax_rates_active ON tax_rates(is_active);

-- Common tax rates
INSERT OR IGNORE INTO tax_rates (id, display_name, jurisdiction, percentage, tax_type, country, is_active) VALUES
    ('tax-pl-vat-23', 'Polish VAT 23%', 'Poland', 23.0, 'vat', 'PL', 1),
    ('tax-pl-vat-8', 'Polish VAT 8%', 'Poland', 8.0, 'vat', 'PL', 1),
    ('tax-pl-vat-5', 'Polish VAT 5%', 'Poland', 5.0, 'vat', 'PL', 1),
    ('tax-de-vat-19', 'German VAT 19%', 'Germany', 19.0, 'vat', 'DE', 1),
    ('tax-de-vat-7', 'German VAT 7%', 'Germany', 7.0, 'vat', 'DE', 1),
    ('tax-uk-vat-20', 'UK VAT 20%', 'United Kingdom', 20.0, 'vat', 'GB', 1),
    ('tax-fr-vat-20', 'French VAT 20%', 'France', 20.0, 'vat', 'FR', 1),
    ('tax-eu-vat-0', 'EU Reverse Charge', 'EU', 0.0, 'vat', 'EU', 1),
    ('tax-us-none', 'No Tax (US Digital)', 'US Digital Services', 0.0, 'sales_tax', 'US', 1);

-- VAT validation results cache
CREATE TABLE IF NOT EXISTS vat_validations (
    id TEXT PRIMARY KEY,
    vat_number TEXT NOT NULL,
    country_code TEXT NOT NULL,
    is_valid INTEGER NOT NULL,
    company_name TEXT,
    company_address TEXT,
    validated_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT, -- Cache expiry
    validation_source TEXT DEFAULT 'vies', -- vies, stripe, manual
    raw_response TEXT, -- JSON
    UNIQUE(vat_number, country_code)
);

CREATE INDEX IF NOT EXISTS idx_vat_validations_number ON vat_validations(vat_number);
CREATE INDEX IF NOT EXISTS idx_vat_validations_expires ON vat_validations(expires_at);

-- =========================================
-- SUBSCRIPTION EVENTS (Analytics)
-- =========================================

CREATE TABLE IF NOT EXISTS subscription_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Event type
    event_type TEXT NOT NULL CHECK(event_type IN (
        'subscription_created', 'subscription_updated', 'subscription_canceled',
        'subscription_paused', 'subscription_resumed', 'subscription_expired',
        'plan_upgraded', 'plan_downgraded',
        'trial_started', 'trial_ended', 'trial_converted',
        'payment_succeeded', 'payment_failed', 'payment_refunded',
        'invoice_created', 'invoice_paid', 'invoice_voided',
        'credit_applied', 'discount_applied', 'discount_removed',
        'seat_added', 'seat_removed',
        'churn', 'reactivation', 'expansion', 'contraction'
    )),
    
    -- Event details
    from_plan_id TEXT,
    to_plan_id TEXT,
    from_mrr INTEGER, -- MRR before event (in cents)
    to_mrr INTEGER, -- MRR after event (in cents)
    mrr_change INTEGER, -- Difference
    
    -- Revenue metrics
    amount INTEGER, -- Transaction amount if applicable
    currency TEXT DEFAULT 'USD',
    
    -- Context
    trigger TEXT CHECK(trigger IN ('user', 'admin', 'system', 'stripe_webhook', 'dunning', 'scheduled')),
    triggered_by TEXT, -- User ID or 'system'
    
    -- Associated records
    invoice_id TEXT,
    payment_id TEXT,
    discount_code_id TEXT,
    
    -- Metadata
    metadata TEXT, -- JSON with additional context
    
    -- Timestamps
    occurred_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_org ON subscription_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_date ON subscription_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_subscription_events_mrr ON subscription_events(event_type, occurred_at) WHERE mrr_change IS NOT NULL;

-- Daily MRR snapshots for analytics
CREATE TABLE IF NOT EXISTS mrr_snapshots (
    id TEXT PRIMARY KEY,
    snapshot_date TEXT NOT NULL UNIQUE,
    
    -- MRR breakdown
    total_mrr INTEGER NOT NULL DEFAULT 0, -- Total MRR in cents
    new_mrr INTEGER DEFAULT 0, -- New subscriptions
    expansion_mrr INTEGER DEFAULT 0, -- Upgrades
    contraction_mrr INTEGER DEFAULT 0, -- Downgrades
    churn_mrr INTEGER DEFAULT 0, -- Cancellations
    reactivation_mrr INTEGER DEFAULT 0, -- Reactivations
    
    -- Customer counts
    total_customers INTEGER DEFAULT 0,
    new_customers INTEGER DEFAULT 0,
    churned_customers INTEGER DEFAULT 0,
    
    -- By plan breakdown (JSON)
    mrr_by_plan TEXT,
    
    -- Calculated metrics
    net_mrr_change INTEGER, -- New + Expansion + Reactivation - Contraction - Churn
    gross_churn_rate REAL, -- Churned MRR / Previous MRR
    net_churn_rate REAL, -- (Churned - Expansion) / Previous MRR
    
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mrr_snapshots_date ON mrr_snapshots(snapshot_date DESC);

-- =========================================
-- BILLING WEBHOOK EVENTS
-- =========================================

CREATE TABLE IF NOT EXISTS billing_webhook_events (
    id TEXT PRIMARY KEY,
    
    -- Event info
    event_type TEXT NOT NULL,
    event_source TEXT DEFAULT 'internal' CHECK(event_source IN ('stripe', 'internal', 'scheduled')),
    
    -- Target webhook
    webhook_id TEXT, -- Reference to outbound webhooks table if applicable
    target_url TEXT,
    
    -- Payload
    payload TEXT NOT NULL, -- JSON
    headers TEXT, -- JSON
    
    -- Delivery status
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'delivered', 'failed', 'retrying')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    next_retry_at TEXT,
    
    -- Response
    response_status INTEGER,
    response_body TEXT,
    response_time_ms INTEGER,
    
    -- Error tracking
    last_error TEXT,
    
    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    delivered_at TEXT,
    failed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_billing_webhooks_status ON billing_webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_billing_webhooks_type ON billing_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_webhooks_retry ON billing_webhook_events(next_retry_at) WHERE status = 'retrying';

-- =========================================
-- DISCOUNT CODES EXTENSIONS
-- =========================================

-- Add new columns to discount_codes
ALTER TABLE discount_codes ADD COLUMN name TEXT;
ALTER TABLE discount_codes ADD COLUMN description TEXT;
ALTER TABLE discount_codes ADD COLUMN duration TEXT DEFAULT 'once' CHECK(duration IN ('once', 'repeating', 'forever'));
ALTER TABLE discount_codes ADD COLUMN duration_months INTEGER; -- For repeating discounts
ALTER TABLE discount_codes ADD COLUMN minimum_amount INTEGER; -- Minimum purchase amount
ALTER TABLE discount_codes ADD COLUMN first_time_only INTEGER DEFAULT 0; -- Only for new customers
ALTER TABLE discount_codes ADD COLUMN stackable INTEGER DEFAULT 0; -- Can be combined with other discounts
ALTER TABLE discount_codes ADD COLUMN redemption_limit_per_customer INTEGER DEFAULT 1;
ALTER TABLE discount_codes ADD COLUMN metadata TEXT; -- JSON
ALTER TABLE discount_codes ADD COLUMN created_by TEXT;

-- Discount usage tracking
CREATE TABLE IF NOT EXISTS discount_redemptions (
    id TEXT PRIMARY KEY,
    discount_code_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    invoice_id TEXT,
    
    -- Amounts
    discount_amount INTEGER NOT NULL, -- Amount discounted in cents
    original_amount INTEGER NOT NULL, -- Original amount before discount
    currency TEXT DEFAULT 'USD',
    
    -- Status
    status TEXT DEFAULT 'applied' CHECK(status IN ('applied', 'reversed', 'expired')),
    
    -- Timestamps
    redeemed_at TEXT DEFAULT (datetime('now')),
    reversed_at TEXT,
    expires_at TEXT, -- When the discount period ends
    
    FOREIGN KEY (discount_code_id) REFERENCES discount_codes(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_discount_redemptions_code ON discount_redemptions(discount_code_id);
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_org ON discount_redemptions(organization_id);

-- =========================================
-- EXTEND INVOICES TABLE
-- =========================================

ALTER TABLE invoices ADD COLUMN template_id TEXT REFERENCES invoice_templates(id);
ALTER TABLE invoices ADD COLUMN credit_note_id TEXT REFERENCES credit_notes(id);
ALTER TABLE invoices ADD COLUMN discount_amount INTEGER DEFAULT 0;
ALTER TABLE invoices ADD COLUMN discount_code_id TEXT REFERENCES discount_codes(id);
ALTER TABLE invoices ADD COLUMN payment_terms_days INTEGER DEFAULT 30;
ALTER TABLE invoices ADD COLUMN payment_instructions TEXT;
ALTER TABLE invoices ADD COLUMN footer_text TEXT;
ALTER TABLE invoices ADD COLUMN stripe_payment_intent_id TEXT;
ALTER TABLE invoices ADD COLUMN finalized_at TEXT;
ALTER TABLE invoices ADD COLUMN sent_at TEXT;
ALTER TABLE invoices ADD COLUMN reminder_sent_at TEXT;
ALTER TABLE invoices ADD COLUMN auto_advance INTEGER DEFAULT 1; -- Auto-finalize and send




