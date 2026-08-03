-- P35-B: Complete canonical object model per §2.3.1
-- Adds: sessions, message attachments, governance metadata, audit purge log

-- 1) Conversation Sessions (§2.3.1 — runtime snapshot per conversation segment)
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    chat_project_id TEXT,
    title VARCHAR(255) NOT NULL DEFAULT 'New conversation',
    title_source VARCHAR(20) DEFAULT 'auto' CHECK (title_source IN ('auto', 'user')),
    starred BOOLEAN DEFAULT FALSE,
    archived BOOLEAN DEFAULT FALSE,
    tags JSONB DEFAULT '[]'::jsonb,
    pmo_context JSONB DEFAULT '{}'::jsonb,
    message_count INTEGER DEFAULT 0,
    last_message_preview VARCHAR(200),
    last_message_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- `conversations` already exists by the time this runs (created earlier by
-- 073_conversations.sql without a `deleted_at` column), so the CREATE TABLE
-- IF NOT EXISTS above is a no-op and never actually adds `deleted_at` — the
-- same "CREATE TABLE IF NOT EXISTS won't add new columns" gotcha the
-- indexes at the bottom of this file need guarded for (strict-schema
-- repair, 2026-08; additive, matches the guard pattern already used below
-- for visibility_scope/access_policy_version/etc.).
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE TABLE IF NOT EXISTS conversation_messages (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'ai', 'assistant', 'system')),
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'action_request', 'summary', 'file', 'tool_call')),
    metadata JSONB DEFAULT '{}'::jsonb,
    token_count INTEGER,
    model_used VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_list
  ON conversations(user_id, archived, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_project
  ON conversations(project_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation
  ON conversation_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS conversation_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  model_id VARCHAR(100),
  preset_id VARCHAR(100),
  locale VARCHAR(10),
  tools_enabled JSONB DEFAULT '[]',
  retrieval_params JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_sessions_conv
  ON conversation_sessions (conversation_id, started_at DESC);

-- 2) Link messages to sessions (optional)
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES conversation_sessions(id) ON DELETE SET NULL;

-- 3) Message-level fields from §2.3.1
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS redaction_state VARCHAR(20) DEFAULT NULL;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS safety_flags JSONB DEFAULT NULL;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT NULL;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS delivery_state VARCHAR(20) DEFAULT 'delivered';

-- 4) Attachment pointers (§2.3.1 — links/pointers, not storage)
CREATE TABLE IF NOT EXISTS conversation_message_attachments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  message_id TEXT NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('file', 'link', 'artifact', 'snapshot', 'reference')),
  target_id VARCHAR(500),
  target_url VARCHAR(2000),
  display_name VARCHAR(500) NOT NULL,
  mime VARCHAR(200),
  size_bytes BIGINT,
  provenance_pointer VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msg_attachments_message
  ON conversation_message_attachments (message_id);

CREATE INDEX IF NOT EXISTS idx_msg_attachments_conv
  ON conversation_message_attachments (conversation_id);

-- 5) Governance metadata on conversations (§2.3.1)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS visibility_scope VARCHAR(20) DEFAULT 'private';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS access_policy_version VARCHAR(50) DEFAULT NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS client_info VARCHAR(200) DEFAULT NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS retention_policy VARCHAR(50) DEFAULT NULL;

-- 6) Audit purge log (§2.3.3 — minimal trace after destructive delete)
CREATE TABLE IF NOT EXISTS conversation_purge_audit (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id TEXT NOT NULL,
  purged_by_user_id TEXT NOT NULL,
  organization_id TEXT,
  message_count INT DEFAULT 0,
  title_hash VARCHAR(64),
  purged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purge_audit_user
  ON conversation_purge_audit (purged_by_user_id, purged_at DESC);

-- 7) Optimistic concurrency control (§2.3.5 E9 — write conflict detection)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

-- 8) Composite indexes for efficient listing (§2.3.1)
CREATE INDEX IF NOT EXISTS idx_conversations_private_list
  ON conversations (organization_id, user_id, deleted_at, last_message_at DESC NULLS LAST)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_team_list
  ON conversations (organization_id, chat_project_id, deleted_at, last_message_at DESC NULLS LAST)
  WHERE deleted_at IS NULL AND chat_project_id IS NOT NULL;
