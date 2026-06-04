-- F4c: nested folders. A folder may live inside another (same scope). NULL
-- parent_id = top level. Additive + idempotent.
ALTER TABLE chat_projects ADD COLUMN IF NOT EXISTS parent_id TEXT;
CREATE INDEX IF NOT EXISTS idx_chat_projects_parent ON chat_projects(parent_id);
