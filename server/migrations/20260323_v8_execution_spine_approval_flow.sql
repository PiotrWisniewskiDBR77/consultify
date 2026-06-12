-- V8 Execution/Approval Spine — Approval Flow tracking columns
-- WP-20W4-02 + WP-20W4-03: Approval Flow, Rebaseline, Review Reuse

-- Review lifecycle tracking
ALTER TABLE v8_execution_runs ADD COLUMN IF NOT EXISTS review_submitted_at TEXT;
ALTER TABLE v8_execution_runs ADD COLUMN IF NOT EXISTS review_completed_at TEXT;
ALTER TABLE v8_execution_runs ADD COLUMN IF NOT EXISTS review_completed_by TEXT;

-- Partial index for active (non-terminal) runs per org
CREATE INDEX IF NOT EXISTS idx_v8_exec_runs_active
  ON v8_execution_runs(organization_id, state)
  WHERE state NOT IN ('completed', 'cancelled', 'expired');
