-- P35-B: Complete canonical object model per §2.3.1
-- Adds: sessions, message attachments, governance metadata, audit purge log

-- 1) Conversation Sessions (§2.3.1 — runtime snapshot per conversation segment)
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
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
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES conversation_sessions(id) ON DELETE SET NULL;

-- 3) Message-level fields from §2.3.1
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS redaction_state VARCHAR(20) DEFAULT NULL;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS safety_flags JSONB DEFAULT NULL;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT NULL;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS delivery_state VARCHAR(20) DEFAULT 'delivered';

-- 4) Attachment pointers (§2.3.1 — links/pointers, not storage)
CREATE TABLE IF NOT EXISTS conversation_message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  purged_by_user_id UUID NOT NULL,
  organization_id UUID,
  message_count INT DEFAULT 0,
  title_hash VARCHAR(64),
  purged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purge_audit_user
  ON conversation_purge_audit (purged_by_user_id, purged_at DESC);

-- 7) Composite indexes for efficient listing (§2.3.1)
CREATE INDEX IF NOT EXISTS idx_conversations_private_list
  ON conversations (organization_id, user_id, deleted_at, last_message_at DESC NULLS LAST)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_team_list
  ON conversations (organization_id, chat_project_id, deleted_at, last_message_at DESC NULLS LAST)
  WHERE deleted_at IS NULL AND chat_project_id IS NOT NULL;
