-- Chat reliability hardening (Faza 0): message idempotency + deterministic ordering
-- See docs/plans/CHAT_MODULE_DEEP_AUDIT_2026-06-02.md (§5 Idempotency, Ordering)

-- 0.3 — Idempotency: a client-generated id so a retried/duplicated POST collapses to one row.
ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS client_message_id TEXT DEFAULT NULL;

-- Unique per conversation, but allow many NULLs (legacy rows / server-originated messages).
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversation_messages_client_msg
  ON conversation_messages(conversation_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

-- 0.5 — Deterministic ordering: a monotonic per-conversation sequence so messages never
-- reorder on reload when two rows share the same created_at millisecond.
ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS seq BIGINT DEFAULT NULL;

-- Backfill seq for existing rows using current created_at ordering (id as stable tiebreaker).
WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY created_at ASC, id ASC) AS rn
  FROM conversation_messages
)
UPDATE conversation_messages cm
   SET seq = ordered.rn
  FROM ordered
 WHERE cm.id = ordered.id
   AND cm.seq IS NULL;

-- Non-unique: seq is an ordering hint (created_at, id remain tiebreakers), so a rare
-- concurrent MAX(seq)+1 collision never hard-fails an insert.
CREATE INDEX IF NOT EXISTS idx_conversation_messages_seq
  ON conversation_messages(conversation_id, seq);
