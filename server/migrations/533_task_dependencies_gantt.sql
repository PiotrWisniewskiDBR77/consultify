-- 533: Extend task_dependencies for Gantt-style dependency types
-- Adds dependency_type (FS/SS/FF/SF), lag_days, and created_by

ALTER TABLE task_dependencies ADD COLUMN dependency_type TEXT DEFAULT 'FS';
-- FS = Finish-to-Start (default, most common)
-- SS = Start-to-Start
-- FF = Finish-to-Finish
-- SF = Start-to-Finish

ALTER TABLE task_dependencies ADD COLUMN lag_days INTEGER DEFAULT 0;
-- Positive = lag (delay), Negative = lead (overlap)

ALTER TABLE task_dependencies ADD COLUMN created_by TEXT;
-- User who created the dependency

ALTER TABLE task_dependencies ADD COLUMN notes TEXT;
-- Optional description of the dependency

-- Ensure uniqueness: one dependency link per task pair + direction
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_deps_unique 
  ON task_dependencies(from_task_id, to_task_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_task_deps_from ON task_dependencies(from_task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_to ON task_dependencies(to_task_id);
