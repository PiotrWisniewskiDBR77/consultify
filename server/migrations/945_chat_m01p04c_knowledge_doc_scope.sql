-- M01-P04C: make `knowledge_docs.organization_id IS NULL` an ENFORCED,
-- explicit contract instead of an application-level convention only.
--
-- Number choice: 942 is already used twice on separate lanes
-- (942_chat_m01p04a_attachment_status.sql on this M01 track,
-- 942_ideas_collaboration_tool_sessions.sql on the M02 track) — verified via
-- `git ls-tree` across every local branch that 943-970 is unused anywhere,
-- see the M01-P04C return summary for the exact check performed.
--
-- Context (full detail in KnowledgeService.ts/ragService.ts comments and
-- docs/ui-standards/evidence/final-acceptance-2026-08-04/01-chat/
-- M01_P04C_BACKFILL_PLAN.md):
--
--   942 added `knowledge_docs.organization_id` but left every existing row
--   (and every row from a handful of still-live code paths) with
--   `organization_id IS NULL`. Application code (KnowledgeService.ts,
--   ragService.ts, knowledge.routes.ts) previously treated NULL as
--   "visible to any organization" — a confirmed cross-tenant leak for rows
--   whose owner was never resolved, not a deliberate design decision. That
--   application-level bug is fixed in this same packet (separate files).
--
--   Exactly the explicitly catalogued internal knowledge-pack classes are
--   legitimate NULL-org rows: `tool_pack`, `methodology`, and
--   `product_pill`. The latter is actively consumed by
--   annaKnowledgeService and is emitted by knowledgeIndexer; omitting it
--   would make those documents unreadable while the application still
--   advertises them as global. No user-facing route accepts or forwards a
--   `source_type` field.
--
-- This migration does NOT touch existing data (no UPDATE, no backfill —
-- explicitly out of scope for this packet, see M01_P04C_BACKFILL_PLAN.md)
-- and does NOT reject rows that already violate the contract (there are
-- confirmed pre-existing legacy rows with organization_id IS NULL and
-- source_type NOT IN ('tool_pack','methodology') — the CHECK constraint is
-- added NOT VALID for exactly this reason: NOT VALID skips validating
-- EXISTING rows, so this migration cannot fail on a database that already
-- contains legacy violations, while still enforcing the rule on every
-- INSERT/UPDATE from this point forward. `VALIDATE CONSTRAINT` (retroactively
-- checking existing rows) is deferred to the backfill's acceptance criteria,
-- run only once every legacy row has been assigned a real owner or an
-- explicit source_type — see the backfill plan.
--
-- Idempotent: re-running replaces the named NOT VALID constraint with the
-- same canonical definition and leaves the partial index unchanged.
--
-- `source_type` self-heal: on a database built from migrations ALONE (no
-- app boot yet — e.g. a fresh CI/Railway provision), `knowledge_docs
-- .source_type` does not exist at this point in the migration chain. It is
-- normally added by `PostgresDatabase.ts`'s runtime `ensureKnowledgeDocColumn`
-- at app startup, not by any migration file (verified: no migration below
-- 943 creates it on `knowledge_docs`). Confirmed the hard way — this
-- migration failed with "column source_type does not exist" on a
-- migrations-only fresh database during this packet's own verification
-- (see M01-P04C return summary). Guarded here so the CHECK constraint below
-- has something to reference regardless of which bootstrap path ran first,
-- mirroring the exact self-heal pattern `942_chat_m01p04a_attachment_status
-- .sql` already uses for `organization_id` itself.
ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS source_type TEXT;

-- Audit/observability aid: cheap lookup for "how many NULL-org rows exist,
-- broken down by source_type" — exactly the query the backfill plan's
-- dry-run step needs, and the same one used to produce the counts in
-- M01_P04C_BACKFILL_PLAN.md. Partial index (WHERE organization_id IS NULL)
-- keeps it small; it only ever serves audit/backfill tooling, not the hot
-- read path (KnowledgeService/ragService both filter on organization_id
-- first, which already has its own index from migration 942).
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_null_org_source_type
  ON knowledge_docs (source_type)
  WHERE organization_id IS NULL;

-- Enforce the contract for every future write, without touching existing
-- rows (NOT VALID). Mirrors the CHECK-constraint idempotency pattern from
-- 942_chat_m01p04a_attachment_status.sql (pg_constraint catalog probe,
-- since CHECK constraints have no native IF NOT EXISTS).
DO $$
BEGIN
  -- A prior local/candidate application may have created the narrower
  -- two-value version. Replace it deterministically so schema and runtime
  -- GLOBAL_KNOWLEDGE_SOURCE_TYPES cannot drift.
  ALTER TABLE knowledge_docs
    DROP CONSTRAINT IF EXISTS chk_knowledge_docs_org_or_global_source;

  -- COALESCE(source_type, '') is required, NOT cosmetic: plain
  -- `source_type IN (...)` evaluates to NULL (not FALSE) when source_type
  -- is NULL, and PostgreSQL CHECK constraints accept NULL.
  ALTER TABLE knowledge_docs
    ADD CONSTRAINT chk_knowledge_docs_org_or_global_source
    CHECK (
      organization_id IS NOT NULL
      OR COALESCE(source_type, '') IN ('tool_pack', 'methodology', 'product_pill')
    ) NOT VALID;
END $$;
