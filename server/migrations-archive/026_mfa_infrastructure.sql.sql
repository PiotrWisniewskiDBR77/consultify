-- Migration: 026_mfa_infrastructure.sql
-- MFA/2FA Support for Enterprise Security
-- Created: 2025-12-21

-- MFA Settings per user
ALTER TABLE users ADD COLUMN mfa_enabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN mfa_secret TEXT; -- TOTP secret (encrypted)
ALTER TABLE users ADD COLUMN mfa_backup_codes TEXT; -- JSON array of hashed backup codes
ALTER TABLE users ADD COLUMN mfa_verified_at TEXT; -- ISO datetime
ALTER TABLE users ADD COLUMN mfa_recovery_email TEXT; -- Optional recovery email

-- MFA Attempts tracking (brute-force protection)
CREATE TABLE IF NOT EXISTS mfa_attempts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    attempt_type TEXT NOT NULL CHECK(attempt_type IN ('TOTP', 'BACKUP_CODE', 'SMS', 'EMAIL')),
    success INTEGER NOT NULL DEFAULT 0,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for querying recent attempts (brute-force detection)
CREATE INDEX IF NOT EXISTS idx_mfa_attempts_user_time ON mfa_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mfa_attempts_ip ON mfa_attempts(ip_address, created_at DESC);

-- Trusted devices (remember this device feature)
CREATE TABLE IF NOT EXISTS trusted_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_fingerprint TEXT NOT NULL, -- Hashed device identifier
    device_name TEXT, -- User-friendly name (e.g., "Chrome on MacOS")
    last_used_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint);

-- MFA enforcement settings per organization (enterprise feature)
ALTER TABLE organizations ADD COLUMN mfa_required INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN mfa_grace_period_days INTEGER DEFAULT 7;
