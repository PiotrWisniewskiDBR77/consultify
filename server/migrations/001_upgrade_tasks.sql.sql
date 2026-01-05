-- Add new columns to tasks table
ALTER TABLE tasks ADD COLUMN expected_outcome TEXT DEFAULT '';
ALTER TABLE tasks ADD COLUMN decision_impact TEXT DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN evidence_required TEXT DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN evidence_items TEXT DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN strategic_contribution TEXT DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN ai_insight TEXT DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN change_log TEXT DEFAULT '[]';

-- Rename/Backfill task_type (optional, usually just assume values are compatible or map them in code)
-- For now we keep the column and application logic handles the values.

-- Task History / Change Log Table
CREATE TABLE IF NOT EXISTS task_history (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY(changed_by) REFERENCES users(id) ON DELETE SET NULL
);
