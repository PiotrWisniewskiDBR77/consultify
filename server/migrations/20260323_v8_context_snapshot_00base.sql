-- Ordering guard: identity-chain migration sorts before the historical base
-- filename. Create the base idempotently before any extensions reference it.

CREATE TABLE IF NOT EXISTS v8_context_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  snapshot_version INTEGER NOT NULL DEFAULT 1,
  captured_at TEXT NOT NULL DEFAULT (datetime('now')),
  workspace_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  conversation_id TEXT,
  execution_run_id TEXT,
  artifact_refs TEXT NOT NULL DEFAULT '[]',
  effective_scope_ref TEXT NOT NULL,
  resolved_role_ref TEXT NOT NULL,
  initiator_user_id TEXT NOT NULL,
  consumer_class TEXT NOT NULL CHECK (
    consumer_class IN ('chat', 'execution', 'retrieval', 'background', 'worker')
  ),
  privacy_mode INTEGER NOT NULL DEFAULT 0,
  source_context_refs TEXT NOT NULL DEFAULT '[]',
  drift_events TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
