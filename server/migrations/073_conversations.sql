-- Migration: 073_conversations.sql
-- Description: AI Chat Conversation History System
-- Created: 2024-12-31

-- ============================================
-- CONVERSATIONS TABLE
-- ============================================
-- Main table for storing conversation metadata
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    chat_project_id TEXT,
    
    -- Conversation metadata
    title VARCHAR(255) NOT NULL DEFAULT '',
    title_source VARCHAR(20) DEFAULT 'auto' CHECK (title_source IN ('auto', 'user')),
    
    -- Organization flags
    starred BOOLEAN DEFAULT FALSE,
    archived BOOLEAN DEFAULT FALSE,
    
    -- Auto-tags for categorization (assessment, initiative, roadmap, report, general)
    -- Using JSONB array representation for PostgreSQL compatibility
    tags JSONB DEFAULT '[]'::jsonb,
    
    -- PMO context linking
    pmo_context JSONB DEFAULT '{}'::jsonb,
    -- Example: { "assessmentId": "uuid", "initiativeIds": ["uuid"], "roadmapId": "uuid" }
    
    -- Conversation state tracking
    message_count INTEGER DEFAULT 0,
    last_message_preview VARCHAR(200),
    last_message_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONVERSATION MESSAGES TABLE
-- ============================================
-- Separate table for messages (for performance and query optimization)
CREATE TABLE IF NOT EXISTS conversation_messages (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    
    -- Message content
    role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'ai')),
    content TEXT NOT NULL,
    
    -- Message type for special handling
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'action_request', 'summary', 'file', 'tool_call')),
    
    -- Rich metadata (citations, actions, tool calls, etc.)
    metadata JSONB DEFAULT '{}'::jsonb,
    -- Example: { 
    --   "citations": [{ "id": "1", "type": "assessment", "title": "...", "reference": "..." }],
    --   "actions": [{ "id": "1", "type": "navigate", "label": "...", "payload": {...} }],
    --   "toolCalls": [{ "name": "...", "args": {...}, "result": {...} }]
    -- }
    
    -- Token tracking for cost analysis
    token_count INTEGER,
    model_used VARCHAR(100),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Conversations: User's conversation list (most common query)
CREATE INDEX IF NOT EXISTS idx_conversations_user_list 
ON conversations(user_id, archived, updated_at DESC);

-- Conversations: Filter by project
CREATE INDEX IF NOT EXISTS idx_conversations_project 
ON conversations(project_id) 
WHERE project_id IS NOT NULL;

-- Conversations: Starred conversations
CREATE INDEX IF NOT EXISTS idx_conversations_starred 
ON conversations(user_id, starred) 
WHERE starred = TRUE;

-- Conversations: Filter by chat project
CREATE INDEX IF NOT EXISTS idx_conversations_chat_project
ON conversations(chat_project_id)
WHERE chat_project_id IS NOT NULL;

-- Add foreign key constraint to chat_projects if the table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_projects') THEN
        -- Drop existing constraint if it exists
        ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_chat_project_id_fkey;
        -- Add foreign key constraint
        ALTER TABLE conversations 
        ADD CONSTRAINT conversations_chat_project_id_fkey 
        FOREIGN KEY (chat_project_id) REFERENCES chat_projects(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Conversations: Full-text search on title
CREATE INDEX IF NOT EXISTS idx_conversations_title_search 
ON conversations USING gin(to_tsvector('english', title));

-- Messages: Fetch messages for conversation
CREATE INDEX IF NOT EXISTS idx_messages_conversation 
ON conversation_messages(conversation_id, created_at ASC);

-- Messages: Recent messages (for preview)
CREATE INDEX IF NOT EXISTS idx_messages_recent 
ON conversation_messages(conversation_id, created_at DESC);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at on conversations
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_conversations_updated_at ON conversations;
CREATE TRIGGER trg_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- Auto-update conversation metadata when message is added
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET 
        message_count = message_count + 1,
        last_message_preview = LEFT(NEW.content, 200),
        last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_message_insert_update_conversation ON conversation_messages;
CREATE TRIGGER trg_message_insert_update_conversation
    AFTER INSERT ON conversation_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_on_message();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE conversations IS 'Stores AI chat conversation metadata and organization';
COMMENT ON TABLE conversation_messages IS 'Stores individual messages within conversations';
COMMENT ON COLUMN conversations.pmo_context IS 'Links to PMO entities (assessments, initiatives, roadmaps) discussed in conversation';
COMMENT ON COLUMN conversations.tags IS 'Auto-generated tags based on conversation content';
COMMENT ON COLUMN conversation_messages.metadata IS 'Rich data: citations, actions, tool calls, etc.';



















