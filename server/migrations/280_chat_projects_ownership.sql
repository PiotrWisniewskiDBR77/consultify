-- Migration: Chat Projects Ownership Enhancement
-- Description: Add ownership, team_id, instructions, created_by columns to chat_projects table
-- for Personal/Team project separation and project-specific AI instructions

-- Add ownership column (personal or team)
ALTER TABLE chat_projects ADD COLUMN IF NOT EXISTS ownership TEXT DEFAULT 'personal' CHECK (ownership IN ('personal', 'team'));

-- Add team_id for team projects (references teams table)
ALTER TABLE chat_projects ADD COLUMN IF NOT EXISTS team_id TEXT REFERENCES teams(id);

-- Add instructions for project-specific AI instructions
ALTER TABLE chat_projects ADD COLUMN IF NOT EXISTS instructions TEXT;

-- Add created_by to track who created the project
ALTER TABLE chat_projects ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_projects_ownership ON chat_projects(ownership);
CREATE INDEX IF NOT EXISTS idx_chat_projects_team ON chat_projects(team_id);
CREATE INDEX IF NOT EXISTS idx_chat_projects_created_by ON chat_projects(created_by);

-- Update existing projects to have created_by = user_id (for backwards compatibility)
UPDATE chat_projects SET created_by = user_id WHERE created_by IS NULL;
