-- Migration 131: Integration Extensions
-- Adds integration health and sync settings

-- Integration health & settings
CREATE TABLE IF NOT EXISTS integration_settings (
    integration_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    sync_frequency TEXT DEFAULT 'realtime', -- realtime, 5min, 15min, hourly, daily
    conflict_resolution TEXT DEFAULT 'ask', -- ours, theirs, ask
    field_mapping TEXT DEFAULT '{}', -- JSON object
    error_notifications INTEGER DEFAULT 1,
    retry_policy TEXT DEFAULT 'exponential', -- none, linear, exponential
    max_retries INTEGER DEFAULT 3,
    health_status TEXT DEFAULT 'unknown', -- healthy, degraded, down, unknown
    last_sync_at DATETIME,
    last_error_at DATETIME,
    last_error_message TEXT,
    usage_statistics TEXT DEFAULT '{}', -- JSON object
    FOREIGN KEY(integration_id) REFERENCES integrations(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Webhook retry policy
ALTER TABLE webhooks ADD COLUMN retry_policy TEXT DEFAULT 'exponential';
ALTER TABLE webhooks ADD COLUMN max_retries INTEGER DEFAULT 3;
ALTER TABLE webhooks ADD COLUMN retry_delay_seconds INTEGER DEFAULT 60;

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_integration_settings_user ON integration_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_settings_health ON integration_settings(health_status);








