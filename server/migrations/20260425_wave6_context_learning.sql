CREATE TABLE IF NOT EXISTS wave6_context_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  user_id TEXT NOT NULL,
  snapshot_type TEXT NOT NULL,
  facts_json TEXT NOT NULL DEFAULT '{}',
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  permissions_json TEXT NOT NULL DEFAULT '{}',
  freshness_at TEXT,
  private_mode INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wave6_context_ledger (
  ledger_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  user_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  source_title TEXT,
  source_url TEXT,
  freshness_at TEXT,
  permission_scope TEXT NOT NULL DEFAULT 'tenant',
  forgotten_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wave6_memory_candidates (
  candidate_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  user_id TEXT NOT NULL,
  assistant_scope TEXT NOT NULL,
  memory_scope TEXT NOT NULL,
  status TEXT NOT NULL,
  memory_key TEXT NOT NULL,
  memory_value TEXT NOT NULL,
  source_label TEXT,
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  consent_required INTEGER NOT NULL DEFAULT 1,
  private_mode INTEGER NOT NULL DEFAULT 0,
  retention_until TEXT,
  decision_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wave6_memory_stewardship_decisions (
  decision_id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wave6_snapshots_org_project
  ON wave6_context_snapshots(organization_id, project_id, created_at);

CREATE INDEX IF NOT EXISTS idx_wave6_ledger_org_project
  ON wave6_context_ledger(organization_id, project_id, created_at);

CREATE INDEX IF NOT EXISTS idx_wave6_memory_queue
  ON wave6_memory_candidates(organization_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_wave6_memory_scope
  ON wave6_memory_candidates(organization_id, user_id, assistant_scope, project_id);

