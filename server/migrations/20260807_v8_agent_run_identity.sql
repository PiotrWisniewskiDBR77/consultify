CREATE TABLE IF NOT EXISTS v8_agent_run_identities (
  canonical_run_id TEXT PRIMARY KEY REFERENCES v8_execution_runs(run_id),
  organization_id TEXT NOT NULL,
  transformation_case_id TEXT UNIQUE,
  conversation_id TEXT,
  lineage_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v8_agent_run_aliases (
  alias_id TEXT PRIMARY KEY,
  canonical_run_id TEXT NOT NULL REFERENCES v8_agent_run_identities(canonical_run_id),
  organization_id TEXT NOT NULL,
  alias_type TEXT NOT NULL CHECK (alias_type IN ('wave8_run', 'agent_plan', 'schedule', 'work_graph')),
  external_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, alias_type, external_id)
);

CREATE TABLE IF NOT EXISTS v8_agent_run_reconciliation_events (
  reconciliation_id TEXT PRIMARY KEY,
  canonical_run_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  transformation_case_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  projection_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO v8_agent_run_identities
  (canonical_run_id, organization_id, transformation_case_id, conversation_id, lineage_id)
SELECT execution_run_id, organization_id, transformation_case_id, conversation_id, lineage_id
  FROM transformation_cases
 WHERE execution_run_id IS NOT NULL
ON CONFLICT(canonical_run_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_agent_run_identity_case
  ON v8_agent_run_identities(organization_id, transformation_case_id);
