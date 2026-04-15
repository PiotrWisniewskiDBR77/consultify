-- Migration: Add chat_projects table
--
-- Creates the chat_projects table for organizing conversations into folders/projects
-- similar to Claude AI's project organization feature.

-- Create chat_projects table
CREATE TABLE IF NOT EXISTS chat_projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT 'folder',
    conversation_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_chat_projects_user ON chat_projects(user_id);

-- Create index for organization lookups
CREATE INDEX IF NOT EXISTS idx_chat_projects_org ON chat_projects(organization_id);

-- Add chat_project_id column to conversations table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = 'chat_project_id'
    ) THEN
        ALTER TABLE conversations ADD COLUMN chat_project_id TEXT REFERENCES chat_projects(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index for the new column (if it was added)
CREATE INDEX IF NOT EXISTS idx_conversations_chat_project ON conversations(chat_project_id);
