-- 107_sms_mfa.sql
-- SMS MFA Support - Fallback 2FA via SMS
-- 
-- Prerequisites:
-- - Twilio account with SMS capability
-- - Environment variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

-- Add phone number field to users
ALTER TABLE users ADD COLUMN phone_number TEXT; -- E.164 format: +1234567890
ALTER TABLE users ADD COLUMN phone_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN phone_verified_at TEXT;

-- SMS MFA preferences
ALTER TABLE users ADD COLUMN mfa_sms_enabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN mfa_primary_method TEXT DEFAULT 'totp' CHECK(mfa_primary_method IN ('totp', 'sms'));

-- SMS verification codes (OTP)
CREATE TABLE IF NOT EXISTS sms_verification_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    code TEXT NOT NULL, -- Hashed 6-digit code
    purpose TEXT NOT NULL CHECK(purpose IN ('phone_verify', 'mfa_login', 'mfa_setup', 'password_reset')),
    expires_at TEXT NOT NULL,
    used_at TEXT,
    attempts INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sms_codes_user ON sms_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_codes_phone ON sms_verification_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_codes_expires ON sms_verification_codes(expires_at);

-- SMS delivery log (for audit and debugging)
CREATE TABLE IF NOT EXISTS sms_delivery_log (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    phone_number TEXT NOT NULL,
    message_type TEXT NOT NULL, -- 'verification', 'mfa', 'alert'
    message_sid TEXT, -- Twilio message SID
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'delivered', 'failed', 'undelivered')),
    error_code TEXT,
    error_message TEXT,
    provider TEXT DEFAULT 'twilio',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sms_log_user ON sms_delivery_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_log_phone ON sms_delivery_log(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_log_status ON sms_delivery_log(status);

-- SMS rate limiting (prevent abuse)
CREATE TABLE IF NOT EXISTS sms_rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT NOT NULL,
    user_id TEXT,
    count INTEGER DEFAULT 1,
    window_start TEXT DEFAULT (datetime('now')),
    UNIQUE(phone_number, window_start)
);

CREATE INDEX IF NOT EXISTS idx_sms_rate_phone ON sms_rate_limits(phone_number);

-- Organization SMS settings
ALTER TABLE organizations ADD COLUMN sms_mfa_enabled INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN sms_mfa_required INTEGER DEFAULT 0; -- Require phone verification for MFA users


