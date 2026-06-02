-- V8 Context Snapshot — universal identity spine
-- WP-W1-AI-01: Core ContextSnapshot primitives

CREATE TABLE IF NOT EXISTS v8_context_snapshots (
  snapshot_id       TEXT PRIMARY KEY,
  snapshot_version  INTEGER NOT NULL DEFAULT 1,
  captured_at       TEXT NOT NULL DEFAULT (datetime('now')),
  workspace_id      TEXT NOT NULL,
  organization_id   TEXT NOT NULL,
  project_id        TEXT,
  conversation_id   TEXT,
  execution_run_id  TEXT,
  artifact_refs     TEXT NOT NULL DEFAULT '[]',
  effective_scope_ref TEXT NOT NULL,
  resolved_role_ref TEXT NOT NULL,
  initiator_user_id TEXT NOT NULL,
  consumer_class    TEXT NOT NULL CHECK (consumer_class IN ('chat', 'execution', 'retrieval', 'background', 'worker')),
  privacy_mode      INTEGER NOT NULL DEFAULT 0,
  source_context_refs TEXT NOT NULL DEFAULT '[]',
  drift_events      TEXT NOT NULL DEFAULT '[]',
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_ctx_snap_org      ON v8_context_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_ctx_snap_conv     ON v8_context_snapshots(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_v8_ctx_snap_run      ON v8_context_snapshots(execution_run_id) WHERE execution_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_v8_ctx_snap_user     ON v8_context_snapshots(initiator_user_id);
CREATE INDEX IF NOT EXISTS idx_v8_ctx_snap_captured ON v8_context_snapshots(captured_at);
