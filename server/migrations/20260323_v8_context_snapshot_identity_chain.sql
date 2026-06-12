-- V8 Context Snapshot — identity chain, archival
-- WP-20W2-02: Production ContextSnapshot wiring

ALTER TABLE v8_context_snapshots ADD COLUMN IF NOT EXISTS parent_snapshot_id TEXT REFERENCES v8_context_snapshots(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_v8_ctx_snap_parent ON v8_context_snapshots(parent_snapshot_id) WHERE parent_snapshot_id IS NOT NULL;

ALTER TABLE v8_context_snapshots ADD COLUMN IF NOT EXISTS archived_at TEXT;
