-- Migration: 029_dunning_system.sql
-- Dunning System for Payment Retries and Account Management
-- Created: 2025-12-21

-- Payment attempts tracking
CREATE TABLE IF NOT EXISTS payment_attempts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    invoice_id TEXT,
    stripe_payment_intent_id TEXT,
    amount INTEGER NOT NULL, -- Amount in cents
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL CHECK(status IN ('pending', 'succeeded', 'failed', 'requires_action', 'canceled')),
    failure_code TEXT,
    failure_reason TEXT,
    attempt_number INTEGER DEFAULT 1,
    next_retry_at TEXT, -- ISO datetime
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_org ON payment_attempts(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON payment_attempts(status);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_retry ON payment_attempts(next_retry_at) WHERE status = 'failed';

-- Dunning state per organization
ALTER TABLE organizations ADD COLUMN payment_status TEXT DEFAULT 'current' 
    CHECK(payment_status IN ('current', 'past_due', 'unpaid', 'canceled'));
ALTER TABLE organizations ADD COLUMN dunning_stage INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN dunning_started_at TEXT;
ALTER TABLE organizations ADD COLUMN last_payment_attempt_at TEXT;
ALTER TABLE organizations ADD COLUMN last_successful_payment_at TEXT;
ALTER TABLE organizations ADD COLUMN suspension_reason TEXT;
ALTER TABLE organizations ADD COLUMN suspension_scheduled_at TEXT;

-- Dunning notifications log
CREATE TABLE IF NOT EXISTS dunning_notifications (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    notification_type TEXT NOT NULL, -- 'initial_failure', 'retry_1', 'retry_2', 'final_notice', 'suspension', 'recovery'
    sent_at TEXT DEFAULT (datetime('now')),
    email_to TEXT,
    metadata TEXT, -- JSON with additional info
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dunning_notifications_org ON dunning_notifications(organization_id);

-- Subscription history for audit
CREATE TABLE IF NOT EXISTS subscription_history (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'created', 'upgraded', 'downgraded', 'paused', 'canceled', 'resumed', 'suspended', 'reactivated'
    from_plan TEXT,
    to_plan TEXT,
    reason TEXT,
    performed_by TEXT, -- user_id or 'system'
    metadata TEXT, -- JSON
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_org ON subscription_history(organization_id);
