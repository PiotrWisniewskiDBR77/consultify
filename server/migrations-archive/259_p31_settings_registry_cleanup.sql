-- Migration 259: P31 settings registry cleanup
-- Canonicalizes P31 registry tables and backfills legacy key names.

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS settings_audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    category TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_audit_log_key ON settings_audit_log(setting_key);

-- Backfill legacy global/module key names to canonical P31 names.
INSERT OR IGNORE INTO settings (key, value, updated_at)
SELECT 'recording_auto_start', value, COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM settings
WHERE key = 'interview_recording_auto_start';

INSERT OR IGNORE INTO settings (key, value, updated_at)
SELECT 'scoring_scale', value, COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM settings
WHERE key = 'interview_default_scoring_scale';

INSERT OR IGNORE INTO settings (key, value, updated_at)
SELECT 'default_export_format', value, COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM settings
WHERE key = 'tools_default_export_format';

INSERT OR IGNORE INTO settings (key, value, updated_at)
SELECT 'ai_suggestions_enabled', value, COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM settings
WHERE key = 'copilot_suggestions_enabled';

INSERT OR IGNORE INTO settings (key, value, updated_at)
SELECT 'email_digest', value, COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM settings
WHERE key = 'notifications_email';

-- Backfill tenant-scoped legacy key names.
INSERT OR IGNORE INTO settings (key, value, updated_at)
SELECT REPLACE(key, ':mfa_enforcement', ':mfa_required'), value, COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM settings
WHERE key LIKE 'tenant:%:mfa_enforcement';

INSERT OR IGNORE INTO settings (key, value, updated_at)
SELECT REPLACE(key, ':sso_configuration', ':sso_enforced'), value, COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM settings
WHERE key LIKE 'tenant:%:sso_configuration';

INSERT OR IGNORE INTO settings (key, value, updated_at)
SELECT REPLACE(key, ':session_timeout', ':session_timeout_minutes'), value, COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM settings
WHERE key LIKE 'tenant:%:session_timeout';

INSERT OR IGNORE INTO settings (key, value, updated_at)
SELECT REPLACE(key, ':interview_recording_auto_start', ':recording_auto_start'), value, COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM settings
WHERE key LIKE 'tenant:%:interview_recording_auto_start';

INSERT OR IGNORE INTO settings (key, value, updated_at)
SELECT REPLACE(key, ':interview_default_scoring_scale', ':scoring_scale'), value, COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM settings
WHERE key LIKE 'tenant:%:interview_default_scoring_scale';

INSERT OR IGNORE INTO settings (key, value, updated_at)
SELECT REPLACE(key, ':tools_default_export_format', ':default_export_format'), value, COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM settings
WHERE key LIKE 'tenant:%:tools_default_export_format';

-- Backfill personal legacy key names in user_preferences.
INSERT OR IGNORE INTO user_preferences (user_id, key, value, updated_at)
SELECT user_id, 'settings:email_digest', value, COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM user_preferences
WHERE key = 'settings:notifications_email';

INSERT OR IGNORE INTO user_preferences (user_id, key, value, updated_at)
SELECT user_id, 'settings:ai_suggestions_enabled', value, COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM user_preferences
WHERE key = 'settings:copilot_suggestions_enabled';

INSERT OR IGNORE INTO user_preferences (user_id, key, value, updated_at)
SELECT user_id, 'settings:keyboard_shortcuts', value, COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM user_preferences
WHERE key = 'settings:shortcuts';
