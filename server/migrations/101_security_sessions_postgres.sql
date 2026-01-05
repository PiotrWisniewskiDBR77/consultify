-- =========================================================
-- Migration: 101_security_sessions_postgres.sql
-- Purpose: Add security settings, user sessions tracking, and 2FA support (PostgreSQL)
-- Date: 2026-01-01
-- =========================================================

-- User Sessions Table (Track active sessions)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_jti TEXT UNIQUE,
    device_info TEXT,
    ip_address INET,
    user_agent TEXT,
    location TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_current BOOLEAN DEFAULT FALSE
);

-- Security Settings Table (Organization-level security policies)
CREATE TABLE IF NOT EXISTS security_settings (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    require_2fa BOOLEAN DEFAULT FALSE,
    password_min_length INTEGER DEFAULT 8,
    password_require_uppercase BOOLEAN DEFAULT TRUE,
    password_require_number BOOLEAN DEFAULT TRUE,
    password_require_special BOOLEAN DEFAULT FALSE,
    password_expiry_days INTEGER DEFAULT 0,
    session_timeout_minutes INTEGER DEFAULT 480,
    max_sessions_per_user INTEGER DEFAULT 5,
    ip_whitelist TEXT[],
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- User 2FA Table
CREATE TABLE IF NOT EXISTS user_2fa (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT FALSE,
    secret TEXT,
    backup_codes TEXT[],
    enabled_at TIMESTAMP,
    last_used_at TIMESTAMP
);

-- Login History Table
CREATE TABLE IF NOT EXISTS login_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id),
    ip_address INET,
    user_agent TEXT,
    location TEXT,
    status TEXT DEFAULT 'success',
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_jti ON user_sessions(token_jti);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_org ON login_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_login_history_created ON login_history(created_at DESC);















