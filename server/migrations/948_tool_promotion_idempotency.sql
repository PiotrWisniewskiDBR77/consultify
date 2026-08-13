-- 948_tool_promotion_idempotency.sql
--
-- Closes FAZA 0 findings C15 (no UNIQUE backing tool_initiative_links'
-- SELECT-then-INSERT idempotency check in ToolController.promoteToOutput)
-- and C14 (tool_initiative_links has no organization_id, so tenant scoping
-- on that ledger is only ever indirect, via a join to tool_sessions).
-- See docs/program/METHOD_TOOLS_2026-08-13/IDP_SEMANTICS.md for the full
-- grounding (file:line citations) behind every choice made here.
--
-- WHY NOT a literal UNIQUE(tool_session_id, batch_id):
--   `tool_initiative_links` is shared by two write paths that both use
--   `batch_id` but mean different things by it:
--     Path A — ToolInitiativeService.persistInitiatives (bulk "generate N
--       initiatives"): ONE batch_id legitimately maps to MANY rows (one per
--       generated initiative). A literal (tool_session_id, batch_id) unique
--       index would break this path outright.
--     Path B — ToolController.promoteToOutput: batch_id = `promote-<type>`,
--       intended to be exactly one row per (tool_session_id, outputType).
--   The key shape below uses `idempotency_key` (a new column, populated
--   differently per path — see the application-code changes in
--   ToolController.ts / ToolInitiativeService.ts landed alongside this
--   migration) instead of `batch_id` as the differentiator, so it protects
--   Path B without touching Path A's many-rows-per-batch semantics.
--
-- Additive discipline: only ADD COLUMN / CREATE INDEX on this table. No
-- DROP, no ALTER of any PRE-EXISTING column, no DELETE of any row. The
-- five new columns introduced here are finished (backfilled + NOT NULL)
-- within this same migration, which is not the same thing as altering an
-- existing column's contract.
--
-- NULL DISCIPLINE (the point of this migration): all five columns backing
-- the uniqueness rule are NOT NULL with no partial-index NULL bypass. The
-- codebase has an existing pattern for OPTIONAL per-row idempotency
-- (946_tool_outputs_reports_lineage.sql's
-- `uq_tool_session_events_idempotency ... WHERE idempotency_key IS NOT NULL`)
-- which deliberately lets NULL-keyed rows skip the constraint. That shape is
-- correct for a table where idempotency is optional per event type; it is
-- the WRONG shape here, because tool_initiative_links' promotion rows always
-- require protection. Making the columns NOT NULL (backfilled first) removes
-- the NULL bypass instead of reproducing it.

-- ---------------------------------------------------------------------------
-- 0. Defensive CREATE TABLE IF NOT EXISTS.
--
--    Surprising but verified against a fresh strict run of
--    `server/scripts/migrate.postgres.ts`: `tool_initiative_links` is
--    normally created only by `server/migrations/291_tools_initiatives.sql`
--    (and mirrored by `ToolController.ts`'s own `ensureToolsSchema()`
--    self-bootstrap) — but 291 is version 291 (< 500), and
--    `isSqliteOnlyMigration()` in `migrate.postgres.ts` blanket-excludes
--    every <500-numbered file from the strict/managed run UNLESS it is
--    explicitly listed in that runner's `PROMOTED_LEGACY_PRODUCERS`. 291 is
--    NOT on that list, so on a from-scratch managed database
--    `tool_initiative_links` never exists before this migration runs, and
--    the ALTER TABLE statements below would fail outright with
--    `relation "tool_initiative_links" does not exist` — reproduced by
--    running the full migration set against an empty container. Rather than
--    editing the shared, highly sensitive `migrate.postgres.ts` ordering
--    config (out of this task's scope, and per this repo's own prior
--    incident notes, exactly the kind of shared file where an
--    isolated-looking fix silently breaks a fresh install for everyone
--    else), this migration is made self-sufficient: it creates the table
--    itself if some earlier step hasn't already, using the exact shape
--    `ToolController.ts`'s `ensureToolsSchema()` bootstraps
--    (`ToolController.ts:463-470` at the time this migration was written).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tool_initiative_links (
  id              TEXT PRIMARY KEY,
  tool_session_id TEXT NOT NULL,
  batch_id        TEXT NOT NULL,
  initiative_id   TEXT NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- 1. New columns (nullable first, so ADD COLUMN never needs a table lock
--    fight over backfilling under a NOT NULL+no-default add on old PG).
-- ---------------------------------------------------------------------------
ALTER TABLE tool_initiative_links ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE tool_initiative_links ADD COLUMN IF NOT EXISTS output_type TEXT;
ALTER TABLE tool_initiative_links ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE tool_initiative_links ADD COLUMN IF NOT EXISTS payload_hash TEXT;
-- source_revision has a real, universal historical value (every row written
-- before this migration was written by code that behaved as revision 1 —
-- promoteToOutput hardcoded `const sourceVersion = 1`, see
-- IDP_SEMANTICS.md §5), so a constant DEFAULT is both cheap and accurate.
ALTER TABLE tool_initiative_links ADD COLUMN IF NOT EXISTS source_revision INTEGER NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------------------
-- 2. Backfill organization_id from the owning session. No product code path
--    deletes tool_sessions rows (grepped server/src — zero `DELETE FROM
--    tool_sessions`), so in a real database this join covers every row.
-- ---------------------------------------------------------------------------
UPDATE tool_initiative_links l
   SET organization_id = s.organization_id
  FROM tool_sessions s
 WHERE l.tool_session_id = s.id
   AND l.organization_id IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Backfill output_type.
--    Path B rows (promoteToOutput) encode the type in batch_id as
--    `promote-<type>` — recover it by stripping the prefix.
--    Path A rows (persistInitiatives / generateInitiatives) always create
--    initiatives — ToolInitiativeService.persistInitiatives has exactly one
--    INSERT target (the `initiatives` table); there is no other output type
--    on that path.
-- ---------------------------------------------------------------------------
UPDATE tool_initiative_links
   SET output_type = substring(batch_id from '^promote-(.+)$')
 WHERE output_type IS NULL
   AND batch_id ~ '^promote-';

UPDATE tool_initiative_links
   SET output_type = 'initiative'
 WHERE output_type IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Backfill idempotency_key.
--    Path B rows: batch_id (`promote-<type>`) was ALREADY functioning as the
--    de-facto idempotency key (deterministic per session+type) — reuse it
--    verbatim so historical promotions keep dedup-matching exactly as they
--    did before this migration.
--    Path A rows: batch_id is shared across every initiative in the same
--    generation run, so it CANNOT be reused as-is (that would immediately
--    violate the new unique index across the N sibling rows of one batch).
--    Each row's own primary key `id` is already guaranteed unique, so
--    deriving the key from it keeps every Path A row distinguishable while
--    staying deterministic and reproducible.
-- ---------------------------------------------------------------------------
UPDATE tool_initiative_links
   SET idempotency_key = batch_id
 WHERE idempotency_key IS NULL
   AND batch_id ~ '^promote-';

UPDATE tool_initiative_links
   SET idempotency_key = 'bulk:' || batch_id || ':' || id
 WHERE idempotency_key IS NULL;

-- ---------------------------------------------------------------------------
-- 5. Disambiguate any residual duplicate key-groups BEFORE creating the
--    unique index. This is not hypothetical: FAZA 0's C16 test proved the
--    live race can already create >1 row for the same
--    (tool_session_id, batch_id) pair on an unpatched server, and those
--    duplicates would otherwise make CREATE UNIQUE INDEX fail. Keep every
--    row (zero DELETE) — only the newly-added idempotency_key of the
--    NON-canonical duplicates (older `created_at`/`id` wins as canonical)
--    is suffixed so all rows remain queryable and unique. This only ever
--    touches the column this migration just introduced, not any
--    pre-existing column.
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY organization_id, tool_session_id, source_revision, output_type, idempotency_key
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM tool_initiative_links
)
UPDATE tool_initiative_links l
   SET idempotency_key = l.idempotency_key || ':dup-' || l.id
  FROM ranked r
 WHERE l.id = r.id
   AND r.rn > 1;

-- ---------------------------------------------------------------------------
-- 6. Finish the columns' contract: NOT NULL, now that every row has a value.
-- ---------------------------------------------------------------------------
ALTER TABLE tool_initiative_links ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE tool_initiative_links ALTER COLUMN output_type SET NOT NULL;
ALTER TABLE tool_initiative_links ALTER COLUMN idempotency_key SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 7. The constraint. Full (non-partial) unique index over five NOT NULL
--    columns — no NULL can ever bypass it, by construction (step 6).
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_tool_initiative_links_promotion
  ON tool_initiative_links (organization_id, tool_session_id, source_revision, output_type, idempotency_key);

-- Supporting index for the tenant-scoped lookups the application now does
-- (organization_id first, matching how every other org-scoped table in this
-- codebase is indexed).
CREATE INDEX IF NOT EXISTS idx_tool_initiative_links_org
  ON tool_initiative_links (organization_id);
