-- Migration 731: Add missing columns to tasks table for beta launch

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS list_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workstream_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS story_points INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_hours REAL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sprint_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS idea_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_list ON tasks(list_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workstream ON tasks(workstream_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
