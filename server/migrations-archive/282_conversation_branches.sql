-- Migration: Conversation Branches Support
-- Enables conversation forking/branching from any message

-- Add branch support columns to conversation_messages
ALTER TABLE conversation_messages ADD COLUMN parent_message_id TEXT REFERENCES conversation_messages(id);
ALTER TABLE conversation_messages ADD COLUMN branch_id TEXT;
ALTER TABLE conversation_messages ADD COLUMN is_branch_root INTEGER DEFAULT 0;
ALTER TABLE conversation_messages ADD COLUMN version INTEGER DEFAULT 1;

-- Create conversation_branches table for branch metadata
CREATE TABLE IF NOT EXISTS conversation_branches (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    root_message_id TEXT NOT NULL REFERENCES conversation_messages(id),
    name TEXT,
    description TEXT,
    is_main INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create message_edits table to track message edit history
CREATE TABLE IF NOT EXISTS message_edits (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
    original_content TEXT NOT NULL,
    edited_content TEXT NOT NULL,
    edited_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient branch queries
CREATE INDEX IF NOT EXISTS idx_messages_branch ON conversation_messages(branch_id);
CREATE INDEX IF NOT EXISTS idx_messages_parent ON conversation_messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_branches_conversation ON conversation_branches(conversation_id);
CREATE INDEX IF NOT EXISTS idx_branches_root_message ON conversation_branches(root_message_id);
CREATE INDEX IF NOT EXISTS idx_message_edits_message ON message_edits(message_id);

-- Add version tracking trigger (SQLite compatible)
-- Note: In production with PostgreSQL, use a proper trigger
-- For SQLite, we handle version incrementing in application code
