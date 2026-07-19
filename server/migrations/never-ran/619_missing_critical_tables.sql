-- Migration 619: Create missing critical tables
-- These tables are listed in DatabaseInitializer CRITICAL_TABLES but had no migration.
-- Tables: connectors, webhook_events, groups, user_contact, notification_rules

-- 1. connectors (integration connectors per organization)
CREATE TABLE IF NOT EXISTS connectors (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    provider TEXT,
    status TEXT DEFAULT 'active',
    config TEXT,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_connectors_org_time ON connectors(organization_id, created_at DESC);

-- 2. webhook_events (inbound webhook event log)
CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB,
    processed INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON webhook_events(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_time ON webhook_events(provider, created_at DESC);

-- 3. groups (SCIM groups directory)
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. user_contact (user profile contact information)
CREATE TABLE IF NOT EXISTS user_contact (
    user_id TEXT PRIMARY KEY,
    phone TEXT,
    address TEXT,
    city TEXT,
    country TEXT,
    postal_code TEXT,
    linkedin TEXT,
    website TEXT,
    updated_at TIMESTAMPTZ,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. notification_rules (automation rules for notifications)
CREATE TABLE IF NOT EXISTS notification_rules (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL,
    conditions TEXT,
    actions TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_notification_rules_org ON notification_rules(organization_id, priority, created_at);
