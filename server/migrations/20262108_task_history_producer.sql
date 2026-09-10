-- F5a: task_history is a FANTOM — TaskController.ts inserts into it (task
-- status/field changes at :1810, task moves at :2955) and deletes from it on
-- task delete (:2187), but no migration ever created the table. Every insert
-- is best-effort (.catch(logger.error)), so on Postgres it fails silently
-- with `relation "task_history" does not exist` and the task's change log is
-- permanently empty. Columns below match exactly what those two INSERTs
-- write: (id, task_id, field, old_value, new_value, changed_by).
--
-- organization_id is NOT supplied by either INSERT (both predate any
-- multi-tenant scoping on this table), so it is nullable here and backfilled
-- by a BEFORE INSERT trigger from tasks.organization_id — callers keep
-- writing exactly the 6 columns they already write; the row still ends up
-- tenant-scoped for any future reader that needs to filter by org.
--
-- Idempotent / additive only: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF
-- NOT EXISTS, CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS + CREATE
-- TRIGGER (safe to rerun — trigger definition doesn't change across reruns).

CREATE TABLE IF NOT EXISTS task_history (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    organization_id TEXT,
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_org_id ON task_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_task_history_task_changed_at ON task_history(task_id, changed_at DESC);

-- Backfill organization_id from the parent task when a caller (both current
-- INSERT sites do this) doesn't supply it directly.
CREATE OR REPLACE FUNCTION task_history_fill_org_id() RETURNS trigger AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id FROM tasks WHERE id = NEW.task_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_history_fill_org_id ON task_history;
CREATE TRIGGER trg_task_history_fill_org_id
  BEFORE INSERT ON task_history
  FOR EACH ROW EXECUTE FUNCTION task_history_fill_org_id();
