-- Migration 130: Security Extensions
-- Adds security policies and trusted devices

-- Trusted devices z nazwami
ALTER TABLE active_sessions ADD COLUMN device_name TEXT;
ALTER TABLE active_sessions ADD COLUMN device_type TEXT; -- desktop, mobile, tablet
ALTER TABLE active_sessions ADD COLUMN is_trusted INTEGER DEFAULT 0;

-- Security policies
CREATE TABLE IF NOT EXISTS user_security_policies (
    user_id TEXT PRIMARY KEY,
    session_timeout_minutes INTEGER DEFAULT 30,
    password_expiration_days INTEGER,
    password_history_count INTEGER DEFAULT 5,
    account_lockout_attempts INTEGER DEFAULT 5,
    account_lockout_duration_minutes INTEGER DEFAULT 15,
    ip_whitelist TEXT DEFAULT '[]', -- JSON array
    ip_blacklist TEXT DEFAULT '[]', -- JSON array
    security_alerts_email INTEGER DEFAULT 1,
    security_alerts_sms INTEGER DEFAULT 0,
    suspicious_activity_detection INTEGER DEFAULT 1,
    api_rate_limit_per_hour INTEGER DEFAULT 1000,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Trusted devices (osobna tabela dla lepszej organizacji)
CREATE TABLE IF NOT EXISTS trusted_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_id TEXT NOT NULL, -- FK do active_sessions.id
    device_name TEXT NOT NULL,
    device_type TEXT,
    trusted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_trusted ON active_sessions(is_trusted);




