-- =========================================================
-- Migration: 101_security_sessions.sql
-- Purpose: Add security settings, user sessions tracking, and 2FA support
-- Date: 2026-01-01
-- =========================================================

-- User Sessions Table (Track active sessions)
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_jti TEXT UNIQUE,
    device_info TEXT,
    ip_address TEXT,
    user_agent TEXT,
    location TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    last_active_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    is_current INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Security Settings Table (Organization-level security policies)
CREATE TABLE IF NOT EXISTS security_settings (
    organization_id TEXT PRIMARY KEY,
    require_2fa INTEGER DEFAULT 0,
    password_min_length INTEGER DEFAULT 8,
    password_require_uppercase INTEGER DEFAULT 1,
    password_require_number INTEGER DEFAULT 1,
    password_require_special INTEGER DEFAULT 0,
    password_expiry_days INTEGER DEFAULT 0,
    session_timeout_minutes INTEGER DEFAULT 480,
    max_sessions_per_user INTEGER DEFAULT 5,
    ip_whitelist TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    updated_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- User 2FA Table
CREATE TABLE IF NOT EXISTS user_2fa (
    user_id TEXT PRIMARY KEY,
    is_enabled INTEGER DEFAULT 0,
    secret TEXT,
    backup_codes TEXT,
    enabled_at TEXT,
    last_used_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Login History Table
CREATE TABLE IF NOT EXISTS login_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    location TEXT,
    status TEXT DEFAULT 'success',
    failure_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_jti ON user_sessions(token_jti);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_org ON login_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_login_history_created ON login_history(created_at);







