-- Migration 080: Extended User Settings Tables
-- Purpose: Support new Settings module features (AI Memory, Sessions, Login History)
-- Created: 2024-12-28

-- ============================================================================
-- AI Memory Storage
-- Stores user's AI context and preferences that persist across sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_ai_memory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    memory_key TEXT NOT NULL,
    memory_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_user_ai_memory_user ON user_ai_memory(user_id);

-- Index for key lookups
CREATE INDEX IF NOT EXISTS idx_user_ai_memory_key ON user_ai_memory(user_id, memory_key);


-- ============================================================================
-- Login History
-- Tracks all login attempts for security monitoring
-- ============================================================================
CREATE TABLE IF NOT EXISTS login_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    location TEXT,
    status TEXT DEFAULT 'success', -- 'success', 'failed', 'blocked'
    failure_reason TEXT, -- For failed attempts: 'invalid_password', 'account_locked', etc.
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for user's login history
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);

-- Index for finding failed attempts (security monitoring)
CREATE INDEX IF NOT EXISTS idx_login_history_status ON login_history(status, created_at);

-- Index for IP-based analysis
CREATE INDEX IF NOT EXISTS idx_login_history_ip ON login_history(ip_address);


-- ============================================================================
-- Active Sessions
-- Tracks currently active user sessions across devices
-- ============================================================================
CREATE TABLE IF NOT EXISTS active_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device TEXT, -- Parsed from user_agent: 'Chrome on MacOS', 'Safari on iPhone', etc.
    ip_address TEXT,
    last_active DATETIME,
    session_token TEXT, -- Hashed token for validation
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for user's sessions
CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);

-- Index for session token lookups
CREATE INDEX IF NOT EXISTS idx_active_sessions_token ON active_sessions(session_token);

-- Index for cleanup of expired sessions
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires ON active_sessions(expires_at);


-- ============================================================================
-- Data Export Requests
-- Tracks GDPR data export requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS data_export_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    download_url TEXT,
    expires_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for user's export requests
CREATE INDEX IF NOT EXISTS idx_data_export_user ON data_export_requests(user_id);


-- ============================================================================
-- API Keys (Personal)
-- User's personal API keys for programmatic access
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL, -- First 8 chars for display: pk_live_xxxx
    key_hash TEXT NOT NULL, -- Hashed full key
    scopes TEXT, -- JSON array of allowed scopes
    last_used DATETIME,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for user's API keys
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user ON user_api_keys(user_id);

-- Index for key lookups
CREATE INDEX IF NOT EXISTS idx_user_api_keys_prefix ON user_api_keys(key_prefix);


-- ============================================================================
-- User Webhooks
-- User's personal webhook configurations
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_webhooks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT NOT NULL, -- JSON array: ['task.created', 'task.completed']
    secret TEXT, -- For signature verification
    status TEXT DEFAULT 'active', -- 'active', 'paused', 'failed'
    last_triggered DATETIME,
    failure_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for user's webhooks
CREATE INDEX IF NOT EXISTS idx_user_webhooks_user ON user_webhooks(user_id);


-- ============================================================================
-- Calendar Integrations
-- User's calendar sync configurations
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_calendar_integrations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'google', 'outlook', 'apple'
    access_token TEXT,
    refresh_token TEXT,
    calendar_id TEXT,
    sync_enabled INTEGER DEFAULT 1,
    last_synced DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for user's calendar integrations
CREATE INDEX IF NOT EXISTS idx_user_calendar_user ON user_calendar_integrations(user_id);

-- Unique constraint: one integration per provider per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_calendar_unique ON user_calendar_integrations(user_id, provider);


-- ============================================================================
-- Cleanup old/expired data (can be run periodically)
-- ============================================================================
-- Delete expired sessions
-- DELETE FROM active_sessions WHERE expires_at < datetime('now');

-- Delete old login history (keep last 90 days)
-- DELETE FROM login_history WHERE created_at < datetime('now', '-90 days');

-- Delete expired data export requests
-- DELETE FROM data_export_requests WHERE expires_at < datetime('now');





