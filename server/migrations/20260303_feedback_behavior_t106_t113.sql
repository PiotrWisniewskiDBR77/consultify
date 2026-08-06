-- Migration: 20260303_feedback_behavior_t106_t113
-- T106: Advanced User Feedback System + T113: Behavioral Intelligence Tracking

-- T106: Enhance system_feedback with context metadata
CREATE TABLE IF NOT EXISTS system_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    feedback_type TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS route_path TEXT;
ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS device_type TEXT;
ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS screen_size TEXT;
ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS user_agent_hash TEXT;
ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS ui_language TEXT;
ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS ui_theme TEXT;
ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS workspace_context_json TEXT;
ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'NORMAL';
ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS duplicate_of TEXT;
ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS notification_sent INTEGER DEFAULT 0;

-- Feedback status history for full traceability
CREATE TABLE IF NOT EXISTS feedback_status_history (
    id TEXT PRIMARY KEY,
    feedback_id TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by TEXT,
    note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feedback_id) REFERENCES system_feedback(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_feedback_status_history_feedback ON feedback_status_history(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status_history_created ON feedback_status_history(created_at);

-- T113: Behavior opt-out
ALTER TABLE users ADD COLUMN IF NOT EXISTS behavior_analytics_enabled INTEGER DEFAULT 1;

-- Baseline Postgres migrations skip the legacy SQLite-first superadmin overview migration (<500).
CREATE TABLE IF NOT EXISTS api_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    endpoint TEXT NOT NULL,
    method TEXT,
    status_code INTEGER,
    response_time_ms INTEGER,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint ON api_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_logs_status ON api_logs(status_code);

-- Add correlation_id to api_logs if missing
ALTER TABLE api_logs ADD COLUMN IF NOT EXISTS correlation_id TEXT;
ALTER TABLE api_logs ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE api_logs ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE api_logs ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add index for user-level journey queries
DO $$
BEGIN
  IF to_regclass('journey_events') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_journey_user_created ON journey_events(user_id, created_at);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('user_activation_status') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_activation_phase ON user_activation_status(current_phase);
  END IF;
END $$;
