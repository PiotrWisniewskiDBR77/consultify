-- M01-P04A: honest attachment ingest status + idempotent target pointer.
--
-- Problem: conversation_message_attachments has no status column at all.
-- Today "ready" is purely a client-remembered UI state that is NEVER
-- attested by the server — a broken/malicious client could record a
-- pointer for a rejected or never-ingested file and the API would happily
-- return it forever. This closes packet requirement §3.1 ("plik pokazuje
-- realny status ingestu pending -> ready | failed; zakaz udawania ready").
--
-- Additive and replay-safe. Existing rows predate this column; they were
-- only ever created after ai.routes.ts's synchronous ingest already
-- succeeded, so backfilling them to 'ready' is a true statement, not an
-- assumption of success.
--
-- Ordering note: this file is a NUMBERED (phase-0) migration, but the
-- table's original producer (`conversation_message_attachments`) lives in
-- a DATED (phase-1) file (20260331_p35b_canonical_model_completion.sql),
-- and migrate.postgres.ts runs phase 0 before phase 1 on a fresh database
-- (see its documented phase-sort rationale). Rather than reordering the
-- shared runner's phase manifest (out of this packet's file ownership),
-- this migration is self-contained: it recreates the table with
-- `IF NOT EXISTS` using the exact canonical shape, so it is correct
-- whichever phase runs first, and the later `CREATE TABLE IF NOT EXISTS`
-- in the dated file becomes a harmless no-op either way.
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

ALTER TABLE conversation_message_attachments
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ready';

-- CHECK constraints cannot use IF NOT EXISTS; guard with a catalog probe so
-- this migration is replay-safe (re-running it must not error).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_msg_attachments_status'
  ) THEN
    ALTER TABLE conversation_message_attachments
      ADD CONSTRAINT chk_msg_attachments_status
      CHECK (status IN ('pending', 'ready', 'failed'));
  END IF;
END $$;

ALTER TABLE conversation_message_attachments
  ADD COLUMN IF NOT EXISTS status_reason VARCHAR(64);

ALTER TABLE conversation_message_attachments
  ADD COLUMN IF NOT EXISTS status_detail VARCHAR(500);

-- Idempotency (packet §6/§8 — "ponowny upload tego samego pliku nie tworzy
-- sieroty"). Scoped to kind IN ('file','link') only: those are the two
-- kinds this packet owns and validates; 'artifact'/'snapshot'/'reference'
-- pointers belong to other M01 packets (Canvas share, handoffs) with their
-- own object identity rules and are intentionally left unconstrained here.
-- COALESCE(...,'') is required because Postgres treats NULL <> NULL, so a
-- plain multi-column unique index on a nullable target_url would silently
-- fail to catch duplicate file attachments (target_url is always NULL for
-- kind='file').
CREATE UNIQUE INDEX IF NOT EXISTS uq_msg_attachments_message_target
  ON conversation_message_attachments (
    message_id,
    kind,
    COALESCE(target_id, ''),
    COALESCE(target_url, '')
  )
  WHERE kind IN ('file', 'link');

-- ACL (packet §8 / P0.9 / GF-CHAT-08): `knowledge_docs` — where chat
-- attachment content actually lives (see ai.routes.ts `/attachments/ingest`
-- and `/attachments/ingest-url`) — has NO `organization_id` column in any
-- reachable migration (verified: 000_z_core_baseline.sql's `knowledge_docs`
-- producer has only id/filename/filepath/status/created_at). This is a
-- confirmed, not assumed, gap: ai.routes.ts already contains
-- `UPDATE knowledge_docs SET organization_id = ? WHERE id = ?` right after
-- every chat-attachment ingest, wrapped in `{ fallback: true }` — i.e. that
-- write has been silently no-op'ing against a nonexistent column. Without
-- this column, this packet's tenant check for attachment pointers
-- (§8 "załącznik nieosiągalny spoza organizacji") has nothing to query:
-- ANY caller who learns a docId (server UUID) could attach — and thereby
-- grant Teresa read access to — another organization's already-ingested
-- attachment content, because no tenant boundary was ever persisted for it.
-- Adding the column here activates the ALREADY-WRITTEN ai.routes.ts write
-- (that file is out of this packet's ownership and is not modified) for
-- every ingest going forward. Rows ingested before this migration have
-- organization_id = NULL; the route-level ACL check (conversations.routes.ts,
-- owned by this packet) treats NULL as untracked legacy content and does not
-- reject on it — documented as a residual gap in the packet return summary,
-- not silently treated as solved for historical rows.
ALTER TABLE knowledge_docs
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_organization_id
  ON knowledge_docs (organization_id);
