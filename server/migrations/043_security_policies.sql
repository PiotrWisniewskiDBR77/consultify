-- Migration: 043_security_policies.sql
-- Security Policies per Organization
-- Created: 2025-12-27

-- Security policies per organization
CREATE TABLE IF NOT EXISTS security_policies (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Password Policy
    password_min_length INTEGER DEFAULT 8,
    password_require_uppercase BOOLEAN DEFAULT TRUE,
    password_require_lowercase BOOLEAN DEFAULT TRUE,
    password_require_numbers BOOLEAN DEFAULT TRUE,
    password_require_special BOOLEAN DEFAULT FALSE,
    password_expiry_days INTEGER DEFAULT 0, -- 0 = never expires
    password_history_count INTEGER DEFAULT 3,
    
    -- Login Policy
    max_login_attempts INTEGER DEFAULT 5,
    lockout_duration_minutes INTEGER DEFAULT 30,
    
    -- Session Policy
    session_timeout_minutes INTEGER DEFAULT 480, -- 8 hours
    concurrent_sessions_limit INTEGER DEFAULT 5,
    require_session_binding BOOLEAN DEFAULT FALSE, -- Bind to IP/device
    
    -- IP Policy
    ip_allowlist TEXT, -- JSON array
    ip_blocklist TEXT, -- JSON array
    geo_restrictions TEXT, -- JSON array of country codes
    
    -- MFA Policy
    mfa_required BOOLEAN DEFAULT FALSE,
    mfa_methods TEXT DEFAULT '["totp"]', -- JSON array: totp, sms, email
    mfa_remember_device_days INTEGER DEFAULT 30,
    
    -- Compliance preset
    compliance_preset TEXT, -- 'none', 'soc2', 'hipaa', 'gdpr', 'custom'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT REFERENCES users(id),
    
    UNIQUE(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_security_policies_org ON security_policies(organization_id);

-- User sessions for tracking active sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Session info
    session_token_hash TEXT, -- Hash of session token
    refresh_token_hash TEXT,
    
    -- Device info
    device_fingerprint TEXT,
    device_type TEXT, -- 'desktop', 'mobile', 'tablet'
    device_name TEXT,
    browser TEXT,
    os TEXT,
    
    -- Location
    ip_address TEXT,
    location TEXT, -- City, Country
    latitude REAL,
    longitude REAL,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_activity TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    terminated_at TIMESTAMP,
    termination_reason TEXT -- 'logout', 'expired', 'forced', 'security'
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
-- Drop index if it exists (may have been created with old INTEGER column type)
DROP INDEX IF EXISTS idx_user_sessions_active;
-- Recreate index - cast to boolean to handle both INTEGER and BOOLEAN column types
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active) WHERE (is_active::boolean) = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_sessions_org ON user_sessions(organization_id);

-- Login attempts for security monitoring
CREATE TABLE IF NOT EXISTS login_attempts (
    id TEXT PRIMARY KEY,
    user_email TEXT,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    
    -- Attempt details
    success BOOLEAN DEFAULT FALSE,
    failure_reason TEXT, -- 'invalid_password', 'account_locked', 'mfa_failed', 'ip_blocked'
    auth_method TEXT, -- 'password', 'sso', 'mfa'
    
    -- Request info
    ip_address TEXT,
    user_agent TEXT,
    location TEXT,
    
    -- Risk score (0-100)
    risk_score INTEGER DEFAULT 0,
    risk_factors TEXT, -- JSON array of detected risks
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(user_email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_success ON login_attempts(success);
CREATE INDEX IF NOT EXISTS idx_login_attempts_date ON login_attempts(created_at);

-- Password history for reuse prevention
CREATE TABLE IF NOT EXISTS password_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id);

-- Account lockouts
CREATE TABLE IF NOT EXISTS account_lockouts (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    user_email TEXT,
    
    -- Lockout info
    reason TEXT NOT NULL, -- 'failed_attempts', 'suspicious_activity', 'admin_action'
    failed_attempts INTEGER DEFAULT 0,
    
    -- Timing
    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    unlocked_at TIMESTAMP,
    unlocked_by TEXT REFERENCES users(id),
    
    -- Request info
    ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_account_lockouts_user ON account_lockouts(user_id);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_email ON account_lockouts(user_email);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_active ON account_lockouts(expires_at) WHERE unlocked_at IS NULL;

-- Trusted devices for MFA remember
CREATE TABLE IF NOT EXISTS trusted_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Device info
    device_fingerprint TEXT NOT NULL,
    device_name TEXT,
    device_type TEXT,
    browser TEXT,
    os TEXT,
    
    -- Trust info
    trusted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    last_used TIMESTAMP,
    
    -- Location when trusted
    ip_address TEXT,
    location TEXT,
    
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP,
    revoked_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint);

-- Insert default global security policy
INSERT INTO security_policies (id, organization_id, compliance_preset)
VALUES ('default-global', NULL, 'none')
ON CONFLICT (organization_id) DO NOTHING;




















