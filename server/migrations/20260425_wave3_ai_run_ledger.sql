-- Wave 3 - AI Actions, AIRun, Run Ledger and Audit Viewer

CREATE TABLE IF NOT EXISTS ai_run_ledger (
  run_id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL UNIQUE,
  trigger TEXT NOT NULL,
  user_id TEXT,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  tool TEXT,
  source_context TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  output_refs TEXT NOT NULL DEFAULT '[]',
  audit TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS ai_run_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_user_id TEXT,
  status TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_run_ledger_org_status
  ON ai_run_ledger(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_run_ledger_action
  ON ai_run_ledger(action_id);

CREATE INDEX IF NOT EXISTS idx_ai_run_events_action
  ON ai_run_events(action_id, created_at);
