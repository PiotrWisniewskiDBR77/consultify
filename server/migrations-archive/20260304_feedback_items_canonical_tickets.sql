-- Migration: 20260304_feedback_items_canonical_tickets
-- Purpose: Make `feedback_items` canonical ticket stream for feedback → tasks workflow.
-- Adds env/severity fields and task linkage + status history.

-- --------------------------------------------
-- Canonical ticket metadata
-- --------------------------------------------
ALTER TABLE feedback_items ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE feedback_items ADD COLUMN IF NOT EXISTS source_env TEXT; -- production|staging|development
ALTER TABLE feedback_items ADD COLUMN IF NOT EXISTS linked_task_id TEXT;

-- Admin response fields (for SuperAdmin triage parity)
ALTER TABLE feedback_items ADD COLUMN IF NOT EXISTS admin_response TEXT;
ALTER TABLE feedback_items ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;
ALTER TABLE feedback_items ADD COLUMN IF NOT EXISTS responded_by TEXT;

-- --------------------------------------------
-- Status history (separate from system_feedback history)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS feedback_items_status_history (
  id TEXT PRIMARY KEY,
  feedback_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feedback_items_status_history_feedback
  ON feedback_items_status_history(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_items_status_history_created
  ON feedback_items_status_history(created_at);

