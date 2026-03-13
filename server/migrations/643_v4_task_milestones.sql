-- V4-TASK-04: Add milestone fields to tasks table
-- Allows marking any task as a milestone with a target date

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS milestone_target_date DATE;

CREATE INDEX IF NOT EXISTS idx_tasks_is_milestone ON tasks(is_milestone) WHERE is_milestone IS TRUE;
