-- Agent Audit Layer persistence (Enterprise MVP)
-- Stores each audit run + per-agent reviews for transparency and history.

CREATE TABLE IF NOT EXISTS ai_agent_audit_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  conversation_id TEXT,
  dt_session_id TEXT,
  user_intent TEXT NOT NULL,
  loop_iteration INTEGER DEFAULT 1,
  decision_context_json TEXT,
  selected_agent_ids_json TEXT,
  verdict_json TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_runs_org_time
  ON ai_agent_audit_runs (organization_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_audit_runs_conversation
  ON ai_agent_audit_runs (conversation_id);

CREATE TABLE IF NOT EXISTS ai_agent_audit_reviews (
  id BIGSERIAL PRIMARY KEY,
  run_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  overreach TEXT,
  review_json TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(run_id) REFERENCES ai_agent_audit_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_reviews_run
  ON ai_agent_audit_reviews (run_id);

