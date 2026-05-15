-- Origin tracking: link tasks/decisions back to their source artifact (idea or notebook page).
-- Canonical API: server/src/routes/my-work.routes.ts (conversion endpoints)
--
-- After converting an idea or notebook page into a task/decision,
-- source_type + source_id record the origin so detail views can show backlinks.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_id TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source_type, source_id);

ALTER TABLE decisions ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT NULL;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS source_id TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_decisions_source ON decisions(source_type, source_id);
