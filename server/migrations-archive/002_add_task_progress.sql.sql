-- Add progress and blocked_reason columns to tasks table
ALTER TABLE tasks ADD COLUMN progress INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN blocked_reason TEXT DEFAULT '';
