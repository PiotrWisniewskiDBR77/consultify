-- ===========================================
-- 211_settings_advanced.sql
-- Settings Advanced Features: Templates, History, API Keys, Webhooks, GDPR
-- ===========================================

-- Settings Templates (user-saved configuration presets)
CREATE TABLE IF NOT EXISTS settings_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '📋',
    type TEXT DEFAULT 'custom', -- 'system' | 'custom'
    settings_data TEXT NOT NULL, -- JSON blob of all settings
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_settings_templates_user ON settings_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_templates_type ON settings_templates(type);

-- Settings Audit Log (History of all settings changes)
CREATE TABLE IF NOT EXISTS settings_audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL, -- 'profile', 'ai', 'notifications', etc.
    setting_key TEXT NOT NULL,
    action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'restored'
    old_value TEXT,
    new_value TEXT,
    device TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_settings_audit_user ON settings_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_audit_category ON settings_audit_log(category);
CREATE INDEX IF NOT EXISTS idx_settings_audit_created ON settings_audit_log(created_at);

-- User API Keys (for external integrations)
CREATE TABLE IF NOT EXISTS user_api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL, -- bcrypt hash of the key
    key_prefix TEXT NOT NULL, -- first 8 chars for identification
    permissions TEXT DEFAULT '[]', -- JSON array of permissions
    rate_limit INTEGER DEFAULT 1000, -- requests per hour
    last_used_at TEXT,
    expires_at TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_prefix ON user_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_active ON user_api_keys(is_active);

-- User Webhooks (for notifications and integrations)
CREATE TABLE IF NOT EXISTS user_webhooks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT NOT NULL, -- JSON array of event types
    secret TEXT, -- for signature verification
    headers TEXT DEFAULT '{}', -- custom headers JSON
    is_active INTEGER DEFAULT 1,
    last_triggered_at TEXT,
    last_status INTEGER, -- HTTP status code
    failure_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_webhooks_user ON user_webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_webhooks_active ON user_webhooks(is_active);

-- GDPR Requests (export and deletion requests)
CREATE TABLE IF NOT EXISTS gdpr_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'export' | 'deletion'
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
    reason TEXT, -- for deletion requests
    download_url TEXT, -- for export requests
    file_path TEXT, -- server-side file path
    expires_at TEXT, -- when download expires
    scheduled_at TEXT, -- for deletion, when it will execute
    processed_at TEXT,
    completed_at TEXT,
    error_message TEXT,
    metadata TEXT DEFAULT '{}', -- JSON for additional data
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user ON gdpr_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_type ON gdpr_requests(type);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status ON gdpr_requests(status);

-- Developer Settings (stored per user)
CREATE TABLE IF NOT EXISTS developer_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    developer_mode INTEGER DEFAULT 0,
    api_logging INTEGER DEFAULT 0,
    verbose_errors INTEGER DEFAULT 0,
    show_debug_info INTEGER DEFAULT 0,
    beta_features TEXT DEFAULT '[]', -- JSON array of enabled beta feature IDs
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_developer_settings_user ON developer_settings(user_id);

-- Feature Flags (user-level overrides)
CREATE TABLE IF NOT EXISTS user_feature_flags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    flag_key TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    value TEXT, -- optional value override
    source TEXT DEFAULT 'user', -- 'user', 'admin', 'system'
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, flag_key)
);

CREATE INDEX IF NOT EXISTS idx_user_feature_flags_user ON user_feature_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feature_flags_key ON user_feature_flags(flag_key);

-- Webhook Logs (for debugging)
CREATE TABLE IF NOT EXISTS webhook_logs (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT,
    response_status INTEGER,
    response_body TEXT,
    duration_ms INTEGER,
    success INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (webhook_id) REFERENCES user_webhooks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_user ON webhook_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at);
