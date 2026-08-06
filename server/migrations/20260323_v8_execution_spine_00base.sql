-- Ordering guard: approval/context-binding extensions sort before the
-- historical execution-spine base filename.

CREATE TABLE IF NOT EXISTS v8_execution_runs (
  run_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  context_snapshot_id TEXT NOT NULL,
  initiator_user_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'drafting' CHECK (state IN (
    'drafting', 'planning', 'proposals_ready', 'waiting_for_review',
    'approved_for_apply', 'rejected', 'applying', 'completed', 'failed',
    'cancelled', 'expired'
  )),
  plan_version INTEGER NOT NULL DEFAULT 1,
  goal TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  expires_at TEXT,
  metadata TEXT NOT NULL DEFAULT '{}'
);
