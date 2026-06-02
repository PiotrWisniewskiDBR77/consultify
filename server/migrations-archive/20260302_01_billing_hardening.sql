-- Migration: 20260302_01_billing_hardening.sql
-- T109: Billing admin audit + webhook delivery log enhancement
-- Date: 2026-03-02

-- SuperAdmin billing audit log
CREATE TABLE IF NOT EXISTS billing_admin_audit_log (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    reason TEXT NOT NULL,
    details_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_admin_audit_org ON billing_admin_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_admin_audit_action ON billing_admin_audit_log(action);

-- Ensure stripe_events table has all needed indexes (idempotent)
CREATE TABLE IF NOT EXISTS stripe_events (
    id TEXT PRIMARY KEY,
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    organization_id TEXT,
    processed_at TIMESTAMP,
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

-- Ensure token_transactions has stripe_payment_id for idempotency
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'token_transactions') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'token_transactions' AND column_name = 'stripe_payment_id') THEN
            ALTER TABLE token_transactions ADD COLUMN stripe_payment_id TEXT;
        END IF;
    END IF;

    -- Grace period column on organization_billing
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_billing') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_billing' AND column_name = 'grace_period_ends_at') THEN
            ALTER TABLE organization_billing ADD COLUMN grace_period_ends_at TIMESTAMP;
        END IF;
    END IF;
END $$;
