-- V4-TASK-01: Zunifikowana hierarchia programId → initiativeId → listId → taskId
-- Tasks already have initiative_id, project_id, workstream_id.
-- Initiatives have project_id, workstream_id.
-- Ensure list_id semantics: workstream_id serves as listId (task list / phase).
-- Add program_id to initiatives for explicit program level (optional; project_id can serve as program).

-- Add program_id to initiatives if we want explicit program above project (optional)
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS program_id TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS workstream_id TEXT;
CREATE INDEX IF NOT EXISTS idx_initiatives_program ON initiatives(program_id);

-- Ensure tasks have list_id for V4 contract (alias workstream as list)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workstream_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS list_id TEXT;
-- Backfill list_id from workstream_id
UPDATE tasks SET list_id = workstream_id WHERE list_id IS NULL AND workstream_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_list ON tasks(list_id);
