CREATE INDEX IF NOT EXISTS idx_v8_exec_runs_ctx_snapshot
  ON v8_execution_runs(context_snapshot_id)
  WHERE context_snapshot_id IS NOT NULL;
-- V8 Execution Spine context_snapshot_id binding index (WP-20W2-03)
-- The v8_execution_runs table already has context_snapshot_id (from WP-W1-AI-03).
-- SQLite does not support ADD CONSTRAINT on existing columns (FK is a design contract).
-- Partial index: look up execution runs by their bound snapshot (only non-null rows).
