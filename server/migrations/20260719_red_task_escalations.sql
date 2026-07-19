-- RED-MISSING-TABLES (2026-07-19): task_escalations — re-express in Postgres dialect.
--
-- ROOT CAUSE: the live migration runner (DatabaseInitializer.runTablePlatformMigrations)
-- only executes files matching /^(7\d{2}|\d{8})_.*\.sql$/. The table was defined only
-- in SQLite-dialect legacy migrations (DEFAULT (datetime('now'))) numbered outside that
-- range, so it NEVER ran on Postgres. Result on demo/parity:
--   * task_escalations — table missing -> 42P01 on escalateTask / resolveEscalation /
--     getTaskEscalationHistory (server/src/services/taskAssignmentService.ts) and
--     TaskController resolution lookup (server/src/controllers/TaskController.ts).
--
-- ADDITIVE + IDEMPOTENT. Column shapes mirror the service SQL:
--   INSERT (id, task_id, project_id, from_level, to_level, escalated_to_id, reason,
--           trigger_type, created_at); UPDATE sets resolved_at, resolution_note.

CREATE TABLE IF NOT EXISTS task_escalations (
  id               TEXT PRIMARY KEY,
  task_id          TEXT NOT NULL,
  project_id       TEXT,
  from_level       INTEGER,
  to_level         INTEGER,
  escalated_to_id  TEXT,
  reason           TEXT,
  trigger_type     TEXT,
  resolved_at      TIMESTAMPTZ,
  resolution_note  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_escalations_task
  ON task_escalations(task_id);
CREATE INDEX IF NOT EXISTS idx_task_escalations_unresolved
  ON task_escalations(task_id) WHERE resolved_at IS NULL;
