-- Persist task creation origin for Initiative Tasks section (manual vs AI)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Backfill existing rows to keep UI badges deterministic
UPDATE tasks
SET source = 'manual'
WHERE source IS NULL OR TRIM(source) = '';
