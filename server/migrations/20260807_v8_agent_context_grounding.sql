CREATE TABLE IF NOT EXISTS v8_agent_context_revalidations (
  revalidation_id TEXT PRIMARY KEY,
  canonical_run_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  transformation_case_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('allowed', 'blocked_drift', 'blocked_scope', 'blocked_snapshot')),
  reason TEXT NOT NULL,
  source_digest TEXT NOT NULL,
  policy_digest TEXT NOT NULL,
  drift_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  checked_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v8_agent_context_revalidation_run
  ON v8_agent_context_revalidations (organization_id, canonical_run_id, created_at DESC);

CREATE TABLE IF NOT EXISTS v8_agent_working_memory_bindings (
  binding_id TEXT PRIMARY KEY,
  canonical_run_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  memory_entry_id TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  content_digest TEXT NOT NULL,
  char_count INTEGER NOT NULL CHECK (char_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (canonical_run_id, memory_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_agent_memory_binding_run
  ON v8_agent_working_memory_bindings (organization_id, canonical_run_id, created_at);
