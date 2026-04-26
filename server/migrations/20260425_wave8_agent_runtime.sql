CREATE TABLE IF NOT EXISTS wave8_agent_definitions (
  agent_id TEXT PRIMARY KEY,
  organization_id TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  purpose TEXT NOT NULL,
  persona TEXT NOT NULL,
  allowed_tools_json TEXT NOT NULL DEFAULT '[]',
  blocked_tools_json TEXT NOT NULL DEFAULT '[]',
  source_scope_json TEXT NOT NULL DEFAULT '[]',
  output_schema_json TEXT NOT NULL DEFAULT '{}',
  approval_policy TEXT NOT NULL,
  cost_class TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  examples_json TEXT NOT NULL DEFAULT '[]',
  editable INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wave8_agent_runs (
  run_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT,
  status TEXT NOT NULL,
  goal TEXT NOT NULL,
  requested_tools_json TEXT NOT NULL DEFAULT '[]',
  output_json TEXT NOT NULL DEFAULT '{}',
  schema_valid INTEGER NOT NULL DEFAULT 0,
  audit_json TEXT NOT NULL DEFAULT '{}',
  schedule_json TEXT,
  owner_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS wave8_agent_schedules (
  schedule_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  cadence TEXT NOT NULL,
  next_run_at TEXT,
  scheduler_mode TEXT NOT NULL DEFAULT 'manual_process_due_endpoint',
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wave8_agent_notifications (
  notification_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wave8_agent_runs_org
  ON wave8_agent_runs(organization_id, created_at);

CREATE INDEX IF NOT EXISTS idx_wave8_agent_definitions_org
  ON wave8_agent_definitions(organization_id, role);

CREATE INDEX IF NOT EXISTS idx_wave8_agent_schedules_org
  ON wave8_agent_schedules(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_wave8_agent_notifications_org
  ON wave8_agent_notifications(organization_id, created_at);
