-- GAP-AI-001: Track usage alerts sent to prevent duplicate notifications
-- Migration: 240_usage_alerts_tracking.sql

CREATE TABLE IF NOT EXISTS usage_alerts_sent (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    alert_type TEXT NOT NULL, -- 'token' or 'storage'
    threshold INTEGER NOT NULL, -- 80, 90, or 100
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, alert_type, threshold)
);

CREATE INDEX IF NOT EXISTS idx_usage_alerts_sent_org ON usage_alerts_sent(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_alerts_sent_lookup ON usage_alerts_sent(organization_id, alert_type, threshold);
