-- V8 Execution Spine ↔ Context Snapshot Binding
-- WP-20W2-03: Consumer Integration — bind execution runs to ContextSnapshot identity spine
--
-- The v8_execution_runs table already has a context_snapshot_id column (from WP-W1-AI-03).
-- This migration adds a formal FK reference and a partial index to support
-- the consumer binding queries introduced in WP-20W2-03.
--
-- SQLite does not support ADD CONSTRAINT on existing columns, so the FK
-- is documented here as a design contract. The partial index is the
-- actionable artifact.

-- Partial index: look up execution runs by their bound snapshot
-- (only rows that actually have a snapshot reference).
CREATE INDEX IF NOT EXISTS idx_v8_exec_runs_ctx_snapshot
  ON v8_execution_runs(context_snapshot_id)
  WHERE context_snapshot_id IS NOT NULL;
