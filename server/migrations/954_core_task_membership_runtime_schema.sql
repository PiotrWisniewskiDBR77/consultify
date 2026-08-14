-- 954: Materialize task and project-membership schema required by mounted runtime.
--
-- These objects previously existed only in the migrations-v2 snapshot,
-- never-ran/001_upgrade_tasks.sql.sql, or runtime ALTER TABLE helpers. A fresh
-- database produced by migrate.postgres.ts therefore booted successfully but
-- TaskController writes failed because task_history did not exist.

ALTER TABLE project_members
  ADD COLUMN IF NOT EXISTS normalized_project_role TEXT;
ALTER TABLE project_members
  ADD COLUMN IF NOT EXISTS role_template_id TEXT;
ALTER TABLE project_members
  ADD COLUMN IF NOT EXISTS legacy_project_role TEXT;

CREATE TABLE IF NOT EXISTS task_history (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT,
  changed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_history_task_id_fkey'
  ) THEN
    ALTER TABLE task_history
      ADD CONSTRAINT task_history_task_id_fkey
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_history_changed_by_fkey'
  ) THEN
    ALTER TABLE task_history
      ADD CONSTRAINT task_history_changed_by_fkey
      FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_task_history_task_changed_at
  ON task_history (task_id, changed_at DESC);
