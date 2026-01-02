-- Migration: 134_advanced_security.sql
-- Description: Advanced security features - password history, IP allowlist, recovery options
-- Date: 2026-01-02

-- ==========================================
-- PASSWORD HISTORY TABLE
-- Stores hashed passwords to prevent reuse
-- ==========================================
CREATE TABLE IF NOT EXISTS password_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created_at ON password_history(created_at);

-- ==========================================
-- PASSWORD POLICY TABLE
-- Stores password policy settings per user/org
-- ==========================================
CREATE TABLE IF NOT EXISTS password_policy (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    user_id TEXT,
    -- Policy settings
    min_length INTEGER DEFAULT 8,
    require_uppercase INTEGER DEFAULT 1,
    require_lowercase INTEGER DEFAULT 1,
    require_numbers INTEGER DEFAULT 1,
    require_special_chars INTEGER DEFAULT 1,
    max_age_days INTEGER DEFAULT 90, -- Password expiration (0 = never)
    history_count INTEGER DEFAULT 5, -- Number of previous passwords to check
    lockout_threshold INTEGER DEFAULT 5, -- Failed attempts before lockout
    lockout_duration_minutes INTEGER DEFAULT 30,
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_policy_org ON password_policy(organization_id);
CREATE INDEX IF NOT EXISTS idx_password_policy_user ON password_policy(user_id);

-- ==========================================
-- IP ALLOWLIST/BLOCKLIST TABLE
-- IP-based access control
-- ==========================================
CREATE TABLE IF NOT EXISTS ip_access_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    ip_address TEXT NOT NULL, -- Single IP or CIDR notation
    rule_type TEXT NOT NULL DEFAULT 'allow', -- 'allow' or 'block'
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ip_access_rules_user ON ip_access_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_ip_access_rules_org ON ip_access_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_ip_access_rules_ip ON ip_access_rules(ip_address);

-- ==========================================
-- SECURITY QUESTIONS TABLE
-- Backup authentication method
-- ==========================================
CREATE TABLE IF NOT EXISTS security_questions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    question_id INTEGER NOT NULL, -- Reference to predefined questions
    custom_question TEXT, -- If user creates custom question
    answer_hash TEXT NOT NULL, -- Hashed answer
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_security_questions_user ON security_questions(user_id);

-- ==========================================
-- RECOVERY CONTACTS TABLE
-- Backup recovery methods
-- ==========================================
CREATE TABLE IF NOT EXISTS recovery_contacts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    contact_type TEXT NOT NULL, -- 'email', 'phone', 'trusted_person'
    contact_value TEXT NOT NULL, -- Email address, phone number, or name
    is_verified INTEGER DEFAULT 0,
    verification_token TEXT,
    verification_sent_at DATETIME,
    verified_at DATETIME,
    is_primary INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recovery_contacts_user ON recovery_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_contacts_type ON recovery_contacts(contact_type);

-- ==========================================
-- GEOLOCATION SECURITY TABLE
-- Track login locations for anomaly detection
-- ==========================================
CREATE TABLE IF NOT EXISTS login_geolocations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT,
    ip_address TEXT NOT NULL,
    country TEXT,
    region TEXT,
    city TEXT,
    latitude REAL,
    longitude REAL,
    isp TEXT,
    is_vpn INTEGER DEFAULT 0,
    is_proxy INTEGER DEFAULT 0,
    is_tor INTEGER DEFAULT 0,
    risk_score INTEGER DEFAULT 0, -- 0-100
    is_trusted INTEGER DEFAULT 0, -- User marked as trusted location
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_login_geolocations_user ON login_geolocations(user_id);
CREATE INDEX IF NOT EXISTS idx_login_geolocations_ip ON login_geolocations(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_geolocations_country ON login_geolocations(country);

-- ==========================================
-- SUSPICIOUS ACTIVITY TABLE
-- Track and alert on suspicious activities
-- ==========================================
CREATE TABLE IF NOT EXISTS suspicious_activities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    activity_type TEXT NOT NULL, -- 'failed_login', 'new_location', 'unusual_time', 'rapid_requests', etc.
    severity TEXT DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
    description TEXT,
    metadata TEXT, -- JSON with additional context
    ip_address TEXT,
    user_agent TEXT,
    is_acknowledged INTEGER DEFAULT 0,
    acknowledged_by TEXT,
    acknowledged_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_suspicious_activities_user ON suspicious_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_suspicious_activities_type ON suspicious_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_suspicious_activities_severity ON suspicious_activities(severity);
CREATE INDEX IF NOT EXISTS idx_suspicious_activities_created ON suspicious_activities(created_at);

-- ==========================================
-- USER SECURITY SETTINGS TABLE
-- Extended security preferences per user
-- ==========================================
CREATE TABLE IF NOT EXISTS user_security_settings (
    user_id TEXT PRIMARY KEY,
    -- Password settings
    password_last_changed DATETIME,
    password_expires_at DATETIME,
    force_password_change INTEGER DEFAULT 0,
    -- Geolocation settings
    enable_geolocation_alerts INTEGER DEFAULT 1,
    trusted_countries TEXT, -- JSON array of country codes
    -- Login settings
    require_reauth_minutes INTEGER DEFAULT 60, -- Require re-auth after inactivity
    single_session_only INTEGER DEFAULT 0, -- Only allow one active session
    -- Notification preferences
    notify_new_login INTEGER DEFAULT 1,
    notify_password_change INTEGER DEFAULT 1,
    notify_suspicious_activity INTEGER DEFAULT 1,
    notify_recovery_change INTEGER DEFAULT 1,
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- PREDEFINED SECURITY QUESTIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS predefined_security_questions (
    id INTEGER PRIMARY KEY,
    question_text TEXT NOT NULL,
    category TEXT DEFAULT 'general', -- 'general', 'personal', 'professional'
    is_active INTEGER DEFAULT 1
);

-- Insert predefined questions
INSERT OR IGNORE INTO predefined_security_questions (id, question_text, category) VALUES
(1, 'What was the name of your first pet?', 'personal'),
(2, 'What city were you born in?', 'personal'),
(3, 'What is your mother''s maiden name?', 'personal'),
(4, 'What was the name of your elementary school?', 'personal'),
(5, 'What was the make of your first car?', 'personal'),
(6, 'What is the name of the street you grew up on?', 'personal'),
(7, 'What was your childhood nickname?', 'personal'),
(8, 'What is the name of your favorite childhood friend?', 'personal'),
(9, 'What was the first company you worked for?', 'professional'),
(10, 'What is your favorite book?', 'general'),
(11, 'What is your favorite movie?', 'general'),
(12, 'What was the destination of your first flight?', 'general');

-- ==========================================
-- TRIGGERS
-- ==========================================
CREATE TRIGGER IF NOT EXISTS update_user_security_settings_timestamp
    AFTER UPDATE ON user_security_settings
    FOR EACH ROW
BEGIN
    UPDATE user_security_settings 
    SET updated_at = datetime('now') 
    WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER IF NOT EXISTS update_password_policy_timestamp
    AFTER UPDATE ON password_policy
    FOR EACH ROW
BEGIN
    UPDATE password_policy 
    SET updated_at = datetime('now') 
    WHERE id = NEW.id;
END;

