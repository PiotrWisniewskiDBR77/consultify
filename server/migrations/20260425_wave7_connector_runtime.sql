CREATE TABLE IF NOT EXISTS wave7_connectors (
  connector_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL,
  auth_state TEXT NOT NULL DEFAULT 'not_connected',
  scopes_json TEXT NOT NULL DEFAULT '[]',
  project_ids_json TEXT NOT NULL DEFAULT '[]',
  owner_user_id TEXT,
  tenant_policy_json TEXT NOT NULL DEFAULT '{}',
  last_sync_at TEXT,
  freshness_ttl_minutes INTEGER NOT NULL DEFAULT 240,
  failure_state TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wave7_connector_runs (
  run_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  connector_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT,
  tool_name TEXT NOT NULL,
  tool_kind TEXT NOT NULL,
  status TEXT NOT NULL,
  query TEXT,
  ai_run_id TEXT,
  source_trace_json TEXT NOT NULL DEFAULT '{}',
  acl_decision_json TEXT NOT NULL DEFAULT '{}',
  freshness_warning TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_wave7_connectors_org
  ON wave7_connectors(organization_id, provider);

CREATE INDEX IF NOT EXISTS idx_wave7_runs_org
  ON wave7_connector_runs(organization_id, created_at);
