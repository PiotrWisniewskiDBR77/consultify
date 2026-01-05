-- Migration: 210_stripe_production.sql
-- Purpose: Production-ready Stripe billing infrastructure
-- Created: 2026-01-04

-- ============================================
-- STRIPE EVENTS LOG (Idempotency)
-- ============================================
CREATE TABLE IF NOT EXISTS stripe_events (
    id TEXT PRIMARY KEY,
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    organization_id TEXT,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payload JSON,
    status TEXT DEFAULT 'processed',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON stripe_events(event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_org ON stripe_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_events_status ON stripe_events(status);

-- ============================================
-- PAYMENT ATTEMPTS (Retry Logic)
-- ============================================
CREATE TABLE IF NOT EXISTS payment_attempts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    invoice_id TEXT,
    subscription_id TEXT,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL,
    stripe_payment_intent_id TEXT,
    stripe_charge_id TEXT,
    failure_code TEXT,
    failure_reason TEXT,
    attempt_number INTEGER DEFAULT 1,
    payment_method_id TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_org ON payment_attempts(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_invoice ON payment_attempts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON payment_attempts(status);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_stripe_pi ON payment_attempts(stripe_payment_intent_id);

-- ============================================
-- DUNNING MANAGEMENT
-- ============================================
CREATE TABLE IF NOT EXISTS dunning_states (
    id TEXT PRIMARY KEY,
    organization_id TEXT UNIQUE NOT NULL,
    subscription_id TEXT,
    current_step INTEGER DEFAULT 0,
    max_steps INTEGER DEFAULT 4,
    last_attempt_at TIMESTAMP,
    next_attempt_at TIMESTAMP,
    status TEXT DEFAULT 'active',
    total_amount_due INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    emails_sent INTEGER DEFAULT 0,
    last_email_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_dunning_states_org ON dunning_states(organization_id);
CREATE INDEX IF NOT EXISTS idx_dunning_states_status ON dunning_states(status);
CREATE INDEX IF NOT EXISTS idx_dunning_states_next_attempt ON dunning_states(next_attempt_at);

-- ============================================
-- SUBSCRIPTION STATE HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_state_history (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    subscription_id TEXT NOT NULL,
    previous_state TEXT,
    new_state TEXT NOT NULL,
    trigger_event TEXT,
    trigger_event_id TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_sub_state_history_org ON subscription_state_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_sub_state_history_sub ON subscription_state_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_state_history_created ON subscription_state_history(created_at);

-- ============================================
-- CHECKOUT SESSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS checkout_sessions (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    user_id TEXT,
    stripe_session_id TEXT UNIQUE NOT NULL,
    plan_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    mode TEXT DEFAULT 'subscription',
    success_url TEXT,
    cancel_url TEXT,
    customer_email TEXT,
    amount_total INTEGER,
    currency TEXT DEFAULT 'USD',
    expires_at TIMESTAMP,
    completed_at TIMESTAMP,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_stripe ON checkout_sessions(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_org ON checkout_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status ON checkout_sessions(status);

-- ============================================
-- PRORATION RECORDS
-- ============================================
CREATE TABLE IF NOT EXISTS proration_records (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    subscription_id TEXT NOT NULL,
    old_plan_id TEXT NOT NULL,
    new_plan_id TEXT NOT NULL,
    proration_amount INTEGER NOT NULL,
    credit_amount INTEGER DEFAULT 0,
    charge_amount INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    effective_date TIMESTAMP NOT NULL,
    billing_period_start TIMESTAMP,
    billing_period_end TIMESTAMP,
    stripe_invoice_item_id TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_proration_records_org ON proration_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_proration_records_sub ON proration_records(subscription_id);

-- ============================================
-- USAGE EVENTS (Usage-Based Billing)
-- ============================================
CREATE TABLE IF NOT EXISTS billing_usage_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    subscription_id TEXT,
    metric_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL,
    total_amount REAL,
    currency TEXT DEFAULT 'USD',
    timestamp TIMESTAMP NOT NULL,
    idempotency_key TEXT UNIQUE,
    stripe_usage_record_id TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_billing_usage_org ON billing_usage_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_usage_metric ON billing_usage_events(metric_name);
CREATE INDEX IF NOT EXISTS idx_billing_usage_timestamp ON billing_usage_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_billing_usage_idem ON billing_usage_events(idempotency_key);

-- ============================================
-- CREDITS & ADJUSTMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS billing_credits (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    reason TEXT,
    source TEXT,
    source_id TEXT,
    expires_at TIMESTAMP,
    used_amount INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_billing_credits_org ON billing_credits(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_credits_status ON billing_credits(status);

-- ============================================
-- EMAIL QUEUE FOR BILLING
-- ============================================
CREATE TABLE IF NOT EXISTS billing_email_queue (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    email_type TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    subject TEXT NOT NULL,
    template_key TEXT NOT NULL,
    template_data JSON,
    attachments JSON,
    status TEXT DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    scheduled_at TIMESTAMP,
    sent_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_billing_email_queue_status ON billing_email_queue(status);
CREATE INDEX IF NOT EXISTS idx_billing_email_queue_org ON billing_email_queue(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_email_queue_scheduled ON billing_email_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_billing_email_queue_type ON billing_email_queue(email_type);

-- ============================================
-- BILLING NOTIFICATION PREFERENCES
-- ============================================
CREATE TABLE IF NOT EXISTS billing_notification_preferences (
    id TEXT PRIMARY KEY,
    organization_id TEXT UNIQUE NOT NULL,
    invoice_created BOOLEAN DEFAULT 1,
    invoice_paid BOOLEAN DEFAULT 1,
    invoice_overdue BOOLEAN DEFAULT 1,
    payment_failed BOOLEAN DEFAULT 1,
    payment_method_expiring BOOLEAN DEFAULT 1,
    subscription_renewed BOOLEAN DEFAULT 1,
    subscription_canceled BOOLEAN DEFAULT 1,
    credit_note_issued BOOLEAN DEFAULT 1,
    usage_threshold_warning BOOLEAN DEFAULT 1,
    additional_recipients JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_billing_notif_pref_org ON billing_notification_preferences(organization_id);

-- ============================================
-- DISPUTES & CHARGEBACKS
-- ============================================
CREATE TABLE IF NOT EXISTS billing_disputes (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    stripe_dispute_id TEXT UNIQUE NOT NULL,
    stripe_charge_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    reason TEXT,
    status TEXT DEFAULT 'warning_needs_response',
    evidence_due_by TIMESTAMP,
    is_charge_refundable BOOLEAN DEFAULT 0,
    outcome TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_billing_disputes_org ON billing_disputes(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_disputes_stripe ON billing_disputes(stripe_dispute_id);
CREATE INDEX IF NOT EXISTS idx_billing_disputes_status ON billing_disputes(status);

-- ============================================
-- REFUNDS
-- ============================================
CREATE TABLE IF NOT EXISTS billing_refunds (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    invoice_id TEXT,
    payment_attempt_id TEXT,
    stripe_refund_id TEXT UNIQUE,
    stripe_charge_id TEXT,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    reason TEXT,
    status TEXT DEFAULT 'pending',
    failure_reason TEXT,
    receipt_number TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE INDEX IF NOT EXISTS idx_billing_refunds_org ON billing_refunds(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_refunds_stripe ON billing_refunds(stripe_refund_id);
CREATE INDEX IF NOT EXISTS idx_billing_refunds_invoice ON billing_refunds(invoice_id);

-- ============================================
-- SEED DEFAULT DUNNING SCHEDULE
-- ============================================
INSERT OR IGNORE INTO settings (key, value, category, description) VALUES
    ('dunning_step_1_days', '3', 'billing', 'Days after first failure to send first reminder'),
    ('dunning_step_2_days', '7', 'billing', 'Days after first failure to send second reminder'),
    ('dunning_step_3_days', '14', 'billing', 'Days after first failure to send final warning'),
    ('dunning_step_4_days', '21', 'billing', 'Days after first failure to cancel subscription'),
    ('dunning_max_retries', '4', 'billing', 'Maximum payment retry attempts');

