-- 106_security_privacy_enterprise.sql
-- Enterprise Security & Privacy Module - Additional Tables

-- User consent preferences for GDPR compliance
CREATE TABLE IF NOT EXISTS user_consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    analytics INTEGER DEFAULT 1,
    personalization INTEGER DEFAULT 1,
    marketing INTEGER DEFAULT 0,
    third_party_sharing INTEGER DEFAULT 0,
    ai_training INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON user_consents(user_id);

-- User data retention preferences
CREATE TABLE IF NOT EXISTS user_data_retention (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    retention_period TEXT DEFAULT '365' CHECK(retention_period IN ('30', '90', '180', '365', 'forever')),
    auto_delete INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_data_retention_user_id ON user_data_retention(user_id);

-- Data export requests
CREATE TABLE IF NOT EXISTS data_export_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'ready', 'expired', 'failed')),
    download_url TEXT,
    file_path TEXT,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_data_export_requests_user_id ON data_export_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_data_export_requests_status ON data_export_requests(status);

-- Data deletion requests (Right to be Forgotten)
CREATE TABLE IF NOT EXISTS data_deletion_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'scheduled', 'processing', 'completed', 'cancelled')),
    reason TEXT,
    scheduled_for DATETIME,
    cancelled_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_user_id ON data_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_status ON data_deletion_requests(status);

-- User security alert preferences
CREATE TABLE IF NOT EXISTS user_security_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    email_suspicious_login INTEGER DEFAULT 1,
    email_new_device INTEGER DEFAULT 1,
    email_password_change INTEGER DEFAULT 1,
    email_mfa_change INTEGER DEFAULT 1,
    push_notifications INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_security_alerts_user_id ON user_security_alerts(user_id);

-- Trusted devices for MFA
CREATE TABLE IF NOT EXISTS trusted_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    device_fingerprint TEXT NOT NULL,
    device_name TEXT,
    device_type TEXT DEFAULT 'unknown' CHECK(device_type IN ('desktop', 'mobile', 'tablet', 'laptop', 'unknown')),
    browser TEXT,
    os TEXT,
    ip_address TEXT,
    location TEXT,
    trusted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint);

-- Consent audit log for compliance
CREATE TABLE IF NOT EXISTS consent_audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    changes TEXT, -- JSON of consent changes
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_consent_audit_log_user_id ON consent_audit_log(user_id);

-- Security events for user audit log
-- Note: security_events table may already exist, adding IF NOT EXISTS
CREATE TABLE IF NOT EXISTS security_events (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    organization_id TEXT REFERENCES organizations(id),
    event_type TEXT NOT NULL,
    severity TEXT DEFAULT 'info' CHECK(severity IN ('info', 'warning', 'critical')),
    ip_address TEXT,
    user_agent TEXT,
    location TEXT,
    metadata TEXT, -- JSON additional data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_org_id ON security_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);










