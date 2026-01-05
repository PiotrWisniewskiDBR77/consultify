-- ==========================================
-- Settings Module - Complete Database Tables
-- Migration: 126_settings_complete_tables.sql
-- Description: Creates all tables needed for Settings module
-- ==========================================

-- ==========================================
-- 1. SECURITY EVENTS TABLE
-- For personal security audit log
-- ==========================================
CREATE TABLE IF NOT EXISTS security_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL, -- login, logout, security, mfa, data, suspicious
    severity TEXT DEFAULT 'info', -- info, warning, critical
    title TEXT NOT NULL,
    description TEXT,
    ip_address TEXT,
    location TEXT,
    device TEXT,
    metadata TEXT, -- JSON
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(type);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);

-- ==========================================
-- 2. USER SECURITY ALERTS TABLE
-- For security notification preferences
-- ==========================================
CREATE TABLE IF NOT EXISTS user_security_alerts (
    user_id TEXT PRIMARY KEY,
    email_suspicious_login INTEGER DEFAULT 1,
    email_new_device INTEGER DEFAULT 1,
    email_password_change INTEGER DEFAULT 1,
    email_mfa_change INTEGER DEFAULT 1,
    push_notifications INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- 3. GDPR CONSENTS TABLE
-- For user consent management
-- ==========================================
CREATE TABLE IF NOT EXISTS user_gdpr_consents (
    user_id TEXT PRIMARY KEY,
    analytics INTEGER DEFAULT 1,
    personalization INTEGER DEFAULT 1,
    marketing INTEGER DEFAULT 0,
    third_party_sharing INTEGER DEFAULT 0,
    ai_training INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- 4. DATA RETENTION SETTINGS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS user_data_retention (
    user_id TEXT PRIMARY KEY,
    retention_period TEXT DEFAULT '365', -- 30, 90, 180, 365, forever
    auto_delete INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- 5. DATA EXPORT REQUESTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS data_export_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, processing, ready, expired
    requested_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    expires_at TEXT,
    download_url TEXT,
    file_path TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_data_export_user ON data_export_requests(user_id);

-- ==========================================
-- 6. ACCOUNT DELETION REQUESTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS account_deletion_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, scheduled, completed, cancelled
    requested_at TEXT DEFAULT (datetime('now')),
    scheduled_for TEXT,
    completed_at TEXT,
    reason TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_user ON account_deletion_requests(user_id);

-- ==========================================
-- 7. CALENDAR INTEGRATIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS user_calendar_integrations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL, -- google, outlook, apple
    status TEXT DEFAULT 'active', -- active, disconnected, expired
    external_email TEXT,
    calendar_name TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TEXT,
    sync_tasks INTEGER DEFAULT 1,
    sync_meetings INTEGER DEFAULT 1,
    last_sync_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, provider),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- 8. CALENDAR SETTINGS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS user_calendar_settings (
    user_id TEXT PRIMARY KEY,
    sync_tasks INTEGER DEFAULT 1,
    sync_meetings INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- 9. TRUSTED DEVICES TABLE
-- For MFA trusted devices
-- ==========================================
CREATE TABLE IF NOT EXISTS trusted_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_name TEXT,
    device_type TEXT DEFAULT 'desktop', -- desktop, mobile, tablet, laptop
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

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id);

-- ==========================================
-- 10. USER WEBHOOKS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS user_webhooks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT DEFAULT '[]', -- JSON array
    secret_key TEXT,
    is_active INTEGER DEFAULT 1,
    last_triggered TEXT,
    last_status TEXT, -- success, failed
    last_response_code INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_webhooks_user ON user_webhooks(user_id);

-- ==========================================
-- 11. API KEYS TABLE (if not exists)
-- ==========================================
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    key_prefix TEXT NOT NULL, -- First 12 chars for display
    key_hash TEXT NOT NULL, -- SHA-256 hash of full key
    scopes TEXT DEFAULT '["read"]', -- JSON array
    expires_at TEXT,
    last_used_at TEXT,
    last_used_ip TEXT,
    rate_limit_per_hour INTEGER DEFAULT 1000,
    revoked_at TEXT,
    revoked_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- ==========================================
-- 12. USER PRIVACY PREFERENCES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS user_privacy_preferences (
    user_id TEXT PRIMARY KEY,
    show_online_status INTEGER DEFAULT 1,
    activity_visibility TEXT DEFAULT 'team', -- all, team, private
    profile_visibility TEXT DEFAULT 'organization', -- public, organization, private
    allow_mentions INTEGER DEFAULT 1,
    show_in_directory INTEGER DEFAULT 1,
    share_activity_with_ai INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);















