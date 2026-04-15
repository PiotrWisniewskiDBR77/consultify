-- P35-B: Add soft-delete support for conversations (grace window before purge)
-- deleted_at IS NULL = active; deleted_at IS NOT NULL = soft-deleted (grace period)

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at
  ON conversations (deleted_at)
  WHERE deleted_at IS NOT NULL;
