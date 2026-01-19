-- Rollback Migration: Chat Projects Ownership Enhancement
-- Use this ONLY if you need to revert the 280_chat_projects_ownership.sql migration
-- WARNING: This will remove data stored in these columns!

-- Drop indexes first
DROP INDEX IF EXISTS idx_chat_projects_ownership;
DROP INDEX IF EXISTS idx_chat_projects_team;
DROP INDEX IF EXISTS idx_chat_projects_created_by;

-- Note: SQLite doesn't support DROP COLUMN directly
-- For SQLite, you'd need to recreate the table
-- For PostgreSQL:
ALTER TABLE chat_projects DROP COLUMN IF EXISTS ownership;
ALTER TABLE chat_projects DROP COLUMN IF EXISTS team_id;
ALTER TABLE chat_projects DROP COLUMN IF EXISTS instructions;
ALTER TABLE chat_projects DROP COLUMN IF EXISTS created_by;
