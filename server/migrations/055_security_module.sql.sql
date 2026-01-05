-- Security Module Migration
-- Enterprise Security & Compliance Features
-- Migration: 055_security_module.sql

-- =====================================================
-- Organization Security Settings
-- =====================================================
CREATE TABLE IF NOT EXISTS security_settings (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    require_2fa BOOLEAN DEFAULT FALSE,
    session_timeout_minutes INTEGER DEFAULT 480,
    max_sessions_per_user INTEGER DEFAULT 5,
    password_min_length INTEGER DEFAULT 8,
    password_require_uppercase BOOLEAN DEFAULT TRUE,
    password_require_number BOOLEAN DEFAULT TRUE,
    password_require_special BOOLEAN DEFAULT FALSE,
    password_expiry_days INTEGER DEFAULT 0,
    ip_whitelist TEXT, -- JSON array of allowed IPs/CIDRs
    login_max_attempts INTEGER DEFAULT 5,
    lockout_duration_minutes INTEGER DEFAULT 30,
    sso_enabled BOOLEAN DEFAULT FALSE,
    sso_provider TEXT, -- 'google', 'microsoft', 'okta', 'saml'
    sso_config TEXT, -- JSON config for SSO provider
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_security_settings_org ON security_settings(organization_id);

-- =====================================================
-- API Keys Management
-- =====================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    key_prefix TEXT NOT NULL, -- First 8 chars for display (e.g., "ck_live_8a")
    key_hash TEXT NOT NULL, -- SHA256 hash of the full key
    scopes TEXT DEFAULT '["read"]', -- JSON array of scopes: read, write, admin, ai, export
    expires_at DATETIME,
    last_used_at DATETIME,
    last_used_ip TEXT,
    rate_limit_per_hour INTEGER DEFAULT 1000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME,
    revoked_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(organization_id) WHERE revoked_at IS NULL;

-- =====================================================
-- OAuth Provider Links
-- =====================================================
CREATE TABLE IF NOT EXISTS oauth_links (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'google', 'microsoft', 'github'
    provider_user_id TEXT NOT NULL,
    provider_email TEXT,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at DATETIME,
    linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, provider),
    UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_links_user ON oauth_links(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_links_provider ON oauth_links(provider, provider_user_id);

-- =====================================================
-- Security Events Log (for compliance)
-- =====================================================
CREATE TABLE IF NOT EXISTS security_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    user_id TEXT,
    event_type TEXT NOT NULL, -- 'login_success', 'login_failed', '2fa_enabled', 'password_changed', 'api_key_created', etc.
    severity TEXT DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT, -- JSON with additional details
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_security_events_org ON security_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_time ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);

-- =====================================================
-- GDPR Data Deletion Requests
-- =====================================================
CREATE TABLE IF NOT EXISTS gdpr_deletion_requests (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    requested_by TEXT NOT NULL, -- user_id
    request_type TEXT NOT NULL, -- 'user_data', 'organization_data', 'specific_data'
    target_user_id TEXT, -- If deleting specific user
    target_data_types TEXT, -- JSON array of data types to delete
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'rejected'
    rejection_reason TEXT,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_org ON gdpr_deletion_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status ON gdpr_deletion_requests(status);

-- =====================================================
-- Data Retention Policies
-- =====================================================
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    activity_retention_days INTEGER DEFAULT 365,
    audit_log_retention_days INTEGER DEFAULT 730, -- 2 years
    chat_history_retention_days INTEGER DEFAULT 90,
    document_retention_days INTEGER DEFAULT 0, -- 0 = indefinite
    auto_delete_enabled BOOLEAN DEFAULT FALSE,
    last_cleanup_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_retention_org ON data_retention_policies(organization_id);

-- =====================================================
-- Enhance users table for Microsoft OAuth
-- =====================================================
-- Note: Google and LinkedIn columns already exist
-- Add microsoft_id for Microsoft OAuth support
ALTER TABLE users ADD COLUMN microsoft_id TEXT;
CREATE INDEX IF NOT EXISTS idx_users_microsoft ON users(microsoft_id);

-- =====================================================
-- Enhance existing audit_logs table
-- =====================================================
-- Add risk_level if not exists (may already exist from earlier migration)
-- SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we use a workaround

-- Check and add columns if they don't exist using PRAGMA
-- This is handled by the application layer since SQLite doesn't support conditional ALTER TABLE

