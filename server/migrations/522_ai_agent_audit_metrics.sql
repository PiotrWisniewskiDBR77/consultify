-- Agent Audit operational metrics (Enterprise MVP)
-- Tracks run_started/completed/accepted/loop_triggered events.

CREATE TABLE IF NOT EXISTS ai_agent_audit_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  conversation_id TEXT,
  event_type TEXT NOT NULL,
  payload_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_metrics_org_time
  ON ai_agent_audit_metrics (organization_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_audit_metrics_run
  ON ai_agent_audit_metrics (run_id);

CREATE INDEX IF NOT EXISTS idx_agent_audit_metrics_event_type
  ON ai_agent_audit_metrics (event_type);

