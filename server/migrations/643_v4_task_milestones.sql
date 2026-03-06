-- V4-TASK-04: Add milestone fields to tasks table
-- Allows marking any task as a milestone with a target date

ALTER TABLE tasks ADD COLUMN is_milestone BOOLEAN DEFAULT 0;
ALTER TABLE tasks ADD COLUMN milestone_target_date DATE;

CREATE INDEX IF NOT EXISTS idx_tasks_is_milestone ON tasks(is_milestone) WHERE is_milestone = 1;
