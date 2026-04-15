-- V8 Workspace AI Facilitation — Wave 14
-- AI suggestions, session insights, collaborative decisions

CREATE TABLE IF NOT EXISTS v8_ai_suggestions (
  suggestion_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  suggestion_type TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  content TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  source_snapshot_id TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT
);

CREATE TABLE IF NOT EXISTS v8_session_insights (
  insight_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS v8_collaborative_decisions (
  decision_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'open',
  outcome TEXT,
  created_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_v8_suggestions_session ON v8_ai_suggestions(session_id, organization_id, state);
CREATE INDEX IF NOT EXISTS idx_v8_insights_session ON v8_session_insights(session_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_decisions_session ON v8_collaborative_decisions(session_id, organization_id, status);
