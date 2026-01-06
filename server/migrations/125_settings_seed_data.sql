-- ==========================================
-- Settings Module - Sample Data for Testing
-- Migration: 125_settings_seed_data.sql
-- Description: Seeds all settings-related tables with English test data
-- ==========================================

-- ==========================================
-- 1. USER SECURITY ALERTS TABLE (if not exists)
-- ==========================================
CREATE TABLE IF NOT EXISTS user_security_alerts (
    user_id TEXT PRIMARY KEY,
    email_suspicious_login INTEGER DEFAULT 1,
    email_new_device INTEGER DEFAULT 1,
    email_password_change INTEGER DEFAULT 1,
    email_mfa_change INTEGER DEFAULT 1,
    push_notifications INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ==========================================
-- 2. TRUSTED DEVICES TABLE (if not exists)
-- ==========================================
CREATE TABLE IF NOT EXISTS trusted_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_name TEXT,
    device_type TEXT DEFAULT 'desktop',
    browser TEXT,
    os TEXT,
    location TEXT,
    ip_address TEXT,
    fingerprint TEXT,
    trusted_at TEXT DEFAULT (datetime('now')),
    last_used TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    is_current INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- 3. USER WEBHOOKS TABLE (if not exists)
-- ==========================================
CREATE TABLE IF NOT EXISTS user_webhooks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT DEFAULT '[]',
    secret_key TEXT,
    is_active INTEGER DEFAULT 1,
    last_triggered TEXT,
    last_status TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- 4. CALENDAR INTEGRATIONS TABLE (if not exists)
-- ==========================================
CREATE TABLE IF NOT EXISTS user_calendar_integrations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    external_calendar_id TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TEXT,
    sync_tasks INTEGER DEFAULT 1,
    sync_meetings INTEGER DEFAULT 1,
    last_synced TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, provider),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- 5. CONNECTED APPS TABLE (if not exists)
-- ==========================================
CREATE TABLE IF NOT EXISTS connected_apps (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    app_name TEXT NOT NULL,
    app_id TEXT,
    icon TEXT,
    permissions TEXT DEFAULT '[]',
    connected_at TEXT DEFAULT (datetime('now')),
    last_sync TEXT,
    status TEXT DEFAULT 'active',
    UNIQUE(user_id, app_name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_webhooks_user ON user_webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_webhooks_org ON user_webhooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_connected_apps_user ON connected_apps(user_id);

















