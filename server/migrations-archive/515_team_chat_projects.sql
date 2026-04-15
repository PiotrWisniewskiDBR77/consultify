-- Migration: 515_team_chat_projects.sql
-- Description: Enable team-shared chat projects & conversations
--
-- Changes:
-- 1. chat_projects.scope: 'personal' (default) or 'team'
-- 2. conversations.created_by: track who started the conversation
-- 3. conversation_messages.author_user_id: track who wrote each message
-- 4. conversations.language: per-conversation language (if missing)
-- 5. Index for team project listing

-- ============================================
-- 1. chat_projects: add scope column
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'chat_projects' AND column_name = 'scope'
    ) THEN
        ALTER TABLE chat_projects ADD COLUMN scope TEXT DEFAULT 'personal'
            CHECK (scope IN ('personal', 'team'));
    END IF;
END $$;

-- ============================================
-- 2. conversations: add created_by column
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversations' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE conversations ADD COLUMN created_by TEXT REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Backfill created_by from user_id for existing rows
UPDATE conversations SET created_by = user_id WHERE created_by IS NULL;

-- ============================================
-- 3. conversation_messages: add author_user_id
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_messages' AND column_name = 'author_user_id'
    ) THEN
        ALTER TABLE conversation_messages ADD COLUMN author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================
-- 4. conversations: add language column (if missing)
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversations' AND column_name = 'language'
    ) THEN
        ALTER TABLE conversations ADD COLUMN language VARCHAR(10) DEFAULT 'en';
    END IF;
END $$;

-- ============================================
-- 5. conversation_messages: add voice type
-- ============================================
-- Ensure 'voice' is an allowed message_type (some DBs may have CHECK constraint)
-- We drop and recreate the CHECK if needed - safe because we only ADD a value
DO $$
BEGIN
    -- Try to drop existing check; ignore if not present
    ALTER TABLE conversation_messages DROP CONSTRAINT IF EXISTS conversation_messages_message_type_check;
    ALTER TABLE conversation_messages ADD CONSTRAINT conversation_messages_message_type_check
        CHECK (message_type IN ('text', 'action_request', 'summary', 'file', 'tool_call', 'voice'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ============================================
-- 6. Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_chat_projects_scope
    ON chat_projects(scope);

CREATE INDEX IF NOT EXISTS idx_chat_projects_team
    ON chat_projects(organization_id, scope)
    WHERE scope = 'team';

CREATE INDEX IF NOT EXISTS idx_conversations_created_by
    ON conversations(created_by)
    WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_author
    ON conversation_messages(author_user_id)
    WHERE author_user_id IS NOT NULL;

-- ============================================
-- 7. Comments
-- ============================================
COMMENT ON COLUMN chat_projects.scope IS 'personal = visible only to creator, team = visible to all org members';
COMMENT ON COLUMN conversations.created_by IS 'User who started this conversation (important for team chats)';
COMMENT ON COLUMN conversation_messages.author_user_id IS 'User who wrote this message (null for AI messages)';
