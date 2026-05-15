-- Deep Thinking operational metrics (Enterprise MVP)
-- Tracks run_started/completed/aborted/force_depth/copied events.

CREATE TABLE IF NOT EXISTS ai_deep_thinking_metrics (
  id BIGSERIAL PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  conversation_id TEXT,
  event_type TEXT NOT NULL,
  payload_json TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dt_metrics_org_time
  ON ai_deep_thinking_metrics (organization_id, created_at);

CREATE INDEX IF NOT EXISTS idx_dt_metrics_session
  ON ai_deep_thinking_metrics (session_id);

CREATE INDEX IF NOT EXISTS idx_dt_metrics_event_type
  ON ai_deep_thinking_metrics (event_type);

