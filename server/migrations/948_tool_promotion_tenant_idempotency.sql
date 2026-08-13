-- 948_tool_promotion_tenant_idempotency.sql
--
-- Consolidation of two independently-developed workstreams against
-- `tool_initiative_links`, merged per binding coordinator decision
-- (2026-08-13, MIGRATION stream wt-mig948):
--
--   * codex/tools-wt-idem-20260813 @ ef29137d1e
--       948_tool_promotion_idempotency.sql — output_type, idempotency_key,
--       payload_hash, source_revision; Path A (bulk initiative generation)
--       vs Path B (promoteToOutput) distinction; historical-duplicate
--       disambiguation WITHOUT delete; DB-level unique protection.
--   * codex/tools-wt-bootstrap-20260813 @ 5d5646b3e3
--       949_tool_initiative_links_org_scope.sql — organization_id;
--       deterministic backfill from tool_sessions; matched/orphaned/
--       ambiguous/unchanged accounting; tenant-first indexes; a
--       BEFORE INSERT/UPDATE trigger that derives organization_id from the
--       parent tool_session and rejects a mismatched caller-supplied value
--       (never guesses, never trusts the client payload).
--
-- This file REPLACES both of the above. Neither source migration is kept
-- as a separate file; there is exactly one migration for this table at
-- this stage: this one.
--
-- CANONICAL PRODUCER (coordinator decision, binding — do not relitigate):
--   `tool_initiative_links` is produced by
--   `server/migrations/20260719_baseline_gap.sql:9533`
--   (`create table if not exists "public"."tool_initiative_links"`).
--   `server/migrations/291_tools_initiatives.sql` is the *historical*
--   producer (same table, plus FKs to `tool_initiative_batches` that the
--   canonical shape does not have) but `isSqliteOnlyMigration()` in
--   `server/scripts/migrate.postgres.ts` blanket-excludes every <500
--   numbered file from the strict/managed run and 291 is NOT on the
--   `PROMOTED_LEGACY_PRODUCERS` allow-list, so on a strict managed run 291
--   never executes. This migration is a CONSUMER of the canonical
--   producer's shape. It does not, and must not, CREATE TABLE
--   tool_initiative_links, and it must not attempt to repair a missing
--   producer — see the precondition block in section 0.
--
-- ORDERING: `20260719_baseline_gap.sql` is a phase-1 (dated) migration.
-- This file's own numeric prefix ("948") would otherwise sort it into
-- phase 0 (numbered), which runs strictly BEFORE phase 1 under
-- `server/scripts/migrate.postgres.ts`'s `phaseAndKeyFor()` — i.e. before
-- its own canonical producer even exists. This migration is therefore
-- listed in that runner's `LATE_PHASE_MANIFEST` (phase 2 — after both
-- phase 0 and phase 1) so it is guaranteed to run after
-- `20260719_baseline_gap.sql` regardless of its filename's numeric prefix.
-- See the `LATE_PHASE_MANIFEST` entry added alongside this file for the
-- matching comment on the runner side.
--
-- NULL / ADDITIVE DISCIPLINE (applies to this entire file):
--   * Every new column is added NULLABLE first (`ADD COLUMN IF NOT
--     EXISTS <col> <type>;`, no inline NOT NULL/DEFAULT), THEN backfilled
--     with an explicit deterministic UPDATE, THEN (only where the backfill
--     is total war/nothing left NULL) tightened to NOT NULL. This is
--     finishing a column's contract within the SAME migration that
--     introduced it — not an ALTER of a pre-existing column.
--   * No DROP. No DELETE. No ALTER of the TYPE or semantics of any
--     column that existed before this migration
--     (id / tool_session_id / batch_id / initiative_id / created_at are
--     never touched). `batch_id`'s historical meaning (Path A: shared
--     across every initiative in one generation batch; Path B:
--     `promote-<type>`) is preserved untouched by every statement below.
--
-- Full grounding / file:line citations for the semantics merged here:
--   docs/program/METHOD_TOOLS_2026-08-13/MIGRATION_GRAPH.md (this
--   workstream's deliverable) and the two source migrations' own header
--   comments (`git show codex/tools-wt-idem-20260813:server/migrations/948_tool_promotion_idempotency.sql`,
--   `git show codex/tools-wt-bootstrap-20260813:server/migrations/949_tool_initiative_links_org_scope.sql`).

-- =============================================================================
-- 0. SCHEMA PRECONDITION — fail fast, do not repair.
--
--    This migration is a CONSUMER. If the canonical producer has not run
--    yet (table absent) or produced an unexpected shape (required column
--    absent), we STOP with a clear, greppable error instead of either
--    (a) silently no-op'ing (ALTER ... IF EXISTS would do this and hide a
--    real ordering bug forever) or (b) creating/repairing the table
--    ourselves (which would hide the SAME ordering bug behind a
--    "fixed by accident" migration that only works because of the bug).
-- =============================================================================
DO $$
BEGIN
  IF to_regclass('public.tool_initiative_links') IS NULL THEN
    RAISE EXCEPTION 'canonical producer missing or ordered after consumer: table "tool_initiative_links" does not exist (expected producer: server/migrations/20260719_baseline_gap.sql:9533)';
  END IF;

  IF to_regclass('public.tool_sessions') IS NULL THEN
    RAISE EXCEPTION 'canonical producer missing or ordered after consumer: table "tool_sessions" does not exist (expected producer: server/migrations/942_ideas_collaboration_tool_sessions.sql or server/migrations/20260719_baseline_gap.sql)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tool_initiative_links' AND column_name = 'id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tool_initiative_links' AND column_name = 'tool_session_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tool_initiative_links' AND column_name = 'batch_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tool_initiative_links' AND column_name = 'created_at'
  ) THEN
    RAISE EXCEPTION 'canonical producer missing or ordered after consumer: "tool_initiative_links" exists but is missing a required column (need id, tool_session_id, batch_id, created_at) — producer ran with an unexpected shape or a different migration altered it first';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tool_sessions' AND column_name = 'id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tool_sessions' AND column_name = 'organization_id'
  ) THEN
    RAISE EXCEPTION 'canonical producer missing or ordered after consumer: "tool_sessions" exists but is missing a required column (need id, organization_id)';
  END IF;
END $$;

-- gen_random_uuid() is used below for the backfill report's synthetic id.
-- It is core in PG16+, but this environment (pgvector/pgvector:pg15) still
-- needs the pgcrypto extension for it. server/migrations/502_assessment_permissions.sql
-- already creates it (phase 0, runs well before this phase-2 migration),
-- but this file does not rely on that ordering — creating it again here is
-- a cheap, idempotent, self-sufficiency guard (same pattern several other
-- migrations already use, e.g. 553_cloud_data_sources.sql).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. Backfill report table — durable record of the accounting required by
--    hard requirement 3 (matched / orphaned / ambiguous / unchanged /
--    duplicate groups), computed BEFORE any column is tightened to NOT
--    NULL. Mirrors the existing repo pattern for per-migration backfill
--    reports (see `presentation_migration_reports`,
--    server/migrations/760_presentation_legacy_normalization.sql).
-- =============================================================================
CREATE TABLE IF NOT EXISTS tool_initiative_links_backfill_reports (
  id                        TEXT PRIMARY KEY DEFAULT ('bkr_' || gen_random_uuid()::text),
  migration_filename        TEXT NOT NULL,
  run_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_rows                INTEGER NOT NULL,
  org_matched_count         INTEGER NOT NULL,
  org_orphaned_count        INTEGER NOT NULL,
  org_ambiguous_count       INTEGER NOT NULL,
  org_unchanged_count       INTEGER NOT NULL,
  duplicate_groups          INTEGER NOT NULL,
  duplicate_rows_suffixed   INTEGER NOT NULL,
  organization_id_not_null  BOOLEAN NOT NULL,
  notes                     TEXT
);

CREATE INDEX IF NOT EXISTS idx_tool_initiative_links_backfill_reports_run_at
  ON tool_initiative_links_backfill_reports (run_at DESC);

-- =============================================================================
-- 2. New columns — NULLABLE first (hard requirement 2). No DEFAULT/NOT NULL
--    inline; every value below is set by an explicit, deterministic UPDATE
--    in the sections that follow.
-- =============================================================================
ALTER TABLE tool_initiative_links ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE tool_initiative_links ADD COLUMN IF NOT EXISTS output_type TEXT;
ALTER TABLE tool_initiative_links ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
-- payload_hash has no retroactive source of truth: the raw promotion
-- payload that would hash to it was never persisted by any pre-existing
-- write path, so there is nothing deterministic to backfill it from. It
-- stays NULLable indefinitely and is populated only by future writes
-- (ToolController.ts application-code change, out of this migration's
-- scope). This is an intentional, permanent NULL — not an omission.
ALTER TABLE tool_initiative_links ADD COLUMN IF NOT EXISTS payload_hash TEXT;
-- source_revision: every row written before this migration was written by
-- code that behaved as revision 1 (promoteToOutput hardcoded
-- `const sourceVersion = 1`); Path A (bulk generation) has no revisioning
-- concept at all, so 1 is also the correct default there. Still added
-- nullable-first per hard requirement 2, backfilled explicitly below.
ALTER TABLE tool_initiative_links ADD COLUMN IF NOT EXISTS source_revision INTEGER;

-- =============================================================================
-- 3. organization_id backfill (FROM A/949) — deterministic join to the
--    owning tool_session. NEVER guessed, NEVER taken from a client
--    payload: the only source of truth is `tool_sessions.organization_id`
--    for the row's own `tool_session_id`.
--
--    Pre-image snapshot captured first so the report in section 3b can
--    distinguish "already had an org before this run" (unchanged / a
--    prior/idempotent run of this same migration) from "resolved by this
--    run's backfill" (matched) and "could not be resolved" (orphaned).
-- =============================================================================
CREATE TEMP TABLE _tll_org_pre ON COMMIT DROP AS
SELECT id, organization_id AS pre_organization_id
FROM tool_initiative_links;

UPDATE tool_initiative_links l
   SET organization_id = s.organization_id
  FROM tool_sessions s
 WHERE l.tool_session_id = s.id
   AND l.organization_id IS NULL;

-- 3b. Report. "ambiguous" is not queried for — it is structurally
--    impossible for this specific backfill and is recorded as a
--    documented 0, not measured, because the join key
--    (`tool_sessions.id`) is that table's PRIMARY KEY: at most one
--    candidate row can ever match a given `tool_session_id`, so there is
--    no multi-candidate case this backfill could ever need to
--    disambiguate (unlike a backfill keyed on a non-unique business
--    identifier, where "ambiguous" would be a real, measured bucket).
DO $$
DECLARE
  v_total       INTEGER;
  v_matched     INTEGER;
  v_orphaned    INTEGER;
  v_unchanged   INTEGER;
BEGIN
  SELECT count(*) INTO v_total FROM tool_initiative_links;

  SELECT count(*) INTO v_unchanged
  FROM _tll_org_pre
  WHERE pre_organization_id IS NOT NULL;

  SELECT count(*) INTO v_matched
  FROM tool_initiative_links l
  JOIN _tll_org_pre p ON p.id = l.id
  WHERE p.pre_organization_id IS NULL
    AND l.organization_id IS NOT NULL;

  SELECT count(*) INTO v_orphaned
  FROM tool_initiative_links l
  JOIN _tll_org_pre p ON p.id = l.id
  WHERE p.pre_organization_id IS NULL
    AND l.organization_id IS NULL;

  -- Stash the counts in session-local temp storage (a one-row temp table)
  -- so later sections (dup accounting, the conditional NOT NULL, and the
  -- final INSERT into the durable report table) can all read them without
  -- recomputing.
  CREATE TEMP TABLE _tll_org_report ON COMMIT DROP AS
  SELECT v_total AS total_rows, v_matched AS matched, v_orphaned AS orphaned, v_unchanged AS unchanged;
END $$;

-- =============================================================================
-- 4. output_type / idempotency_key backfill (FROM B/948) — distinguishes
--    the two write paths that share this table:
--      Path A — ToolInitiativeService.persistInitiatives (bulk "generate N
--        initiatives"): one batch_id legitimately maps to MANY rows (one
--        per generated initiative). output_type is always 'initiative'
--        there is exactly one INSERT target on that path.
--      Path B — ToolController.promoteToOutput: batch_id is written as
--        `promote-<type>`, one row per (tool_session_id, outputType).
-- =============================================================================
UPDATE tool_initiative_links
   SET output_type = substring(batch_id from '^promote-(.+)$')
 WHERE output_type IS NULL
   AND batch_id ~ '^promote-';

UPDATE tool_initiative_links
   SET output_type = 'initiative'
 WHERE output_type IS NULL;

-- idempotency_key:
--   Path B rows: batch_id (`promote-<type>`) was ALREADY functioning as the
--     de-facto idempotency key (deterministic per session+type) — reuse it
--     verbatim so historical promotions keep dedup-matching exactly as
--     they did before this migration.
--   Path A rows: batch_id is shared across every initiative in the same
--     generation run, so it CANNOT be reused as-is (that would immediately
--     collide across the N sibling rows of one batch). Each row's own
--     primary key `id` is already unique, so deriving the key from it
--     keeps every Path A row distinguishable while staying deterministic.
UPDATE tool_initiative_links
   SET idempotency_key = batch_id
 WHERE idempotency_key IS NULL
   AND batch_id ~ '^promote-';

UPDATE tool_initiative_links
   SET idempotency_key = 'bulk:' || batch_id || ':' || id
 WHERE idempotency_key IS NULL;

-- =============================================================================
-- 5. source_revision backfill — constant 1 for every pre-existing row (see
--    rationale in section 2).
-- =============================================================================
UPDATE tool_initiative_links
   SET source_revision = 1
 WHERE source_revision IS NULL;

-- =============================================================================
-- 6. Historical-duplicate disambiguation (FROM B/948) — BEFORE the unique
--    index is created, and BEFORE any DELETE-free guarantee could be at
--    risk. FAZA 0's C16 finding proved the live SELECT-then-INSERT race in
--    ToolController.promoteToOutput can already produce >1 row for what
--    should be a single (tool_session_id, outputType) promotion on an
--    unpatched server; those rows would otherwise collide when the unique
--    index below is created.
--
--    Canonical-row rule (documented, deterministic, reproducible):
--      within each (organization_id, tool_session_id, source_revision,
--      output_type, idempotency_key) group, the row with the EARLIEST
--      created_at wins as canonical (ties broken by `id` ascending, for a
--      total order). Every other row in the group is NOT deleted — only
--      its `idempotency_key` (a column this migration owns) is suffixed
--      with `:dup-<id>` so it becomes unique and queryable, while the
--      group's canonical row keeps the plain key untouched. `batch_id`
--      (pre-existing column) is never modified by this step.
-- =============================================================================
CREATE TEMP TABLE _tll_dupe_rank ON COMMIT DROP AS
SELECT
  id,
  row_number() OVER (
    PARTITION BY organization_id, tool_session_id, source_revision, output_type, idempotency_key
    ORDER BY created_at ASC, id ASC
  ) AS rn,
  count(*) OVER (
    PARTITION BY organization_id, tool_session_id, source_revision, output_type, idempotency_key
  ) AS group_size
FROM tool_initiative_links;

UPDATE tool_initiative_links l
   SET idempotency_key = l.idempotency_key || ':dup-' || l.id
  FROM _tll_dupe_rank r
 WHERE l.id = r.id
   AND r.rn > 1;

-- =============================================================================
-- 7. Finish the always-populated columns' contract: NOT NULL, now that
--    every row has a deterministic value (sections 4-6 leave no NULLs in
--    these three regardless of orphan status).
-- =============================================================================
ALTER TABLE tool_initiative_links ALTER COLUMN output_type SET NOT NULL;
ALTER TABLE tool_initiative_links ALTER COLUMN idempotency_key SET NOT NULL;
ALTER TABLE tool_initiative_links ALTER COLUMN source_revision SET NOT NULL;

-- =============================================================================
-- 8. organization_id NOT NULL — CONDITIONAL (hard requirement 4). Only
--    tightened when the backfill left zero orphans; otherwise the column
--    is deliberately left nullable as an explicit intermediate state
--    (never guessed, never forced) until a future migration proves, on
--    whatever real database it targets, that orphans are actually zero
--    there (this workstream's disposable container is not evidence about
--    demo/prod).
-- =============================================================================
DO $$
DECLARE
  v_orphaned INTEGER;
BEGIN
  SELECT orphaned INTO v_orphaned FROM _tll_org_report;

  IF v_orphaned = 0 THEN
    EXECUTE 'ALTER TABLE tool_initiative_links ALTER COLUMN organization_id SET NOT NULL';
  END IF;
END $$;

-- =============================================================================
-- 9. Record the backfill report (durable — hard requirement 3).
-- =============================================================================
INSERT INTO tool_initiative_links_backfill_reports (
  migration_filename, total_rows, org_matched_count, org_orphaned_count,
  org_ambiguous_count, org_unchanged_count, duplicate_groups,
  duplicate_rows_suffixed, organization_id_not_null, notes
)
SELECT
  '948_tool_promotion_tenant_idempotency.sql',
  o.total_rows,
  o.matched,
  o.orphaned,
  0, -- ambiguous: structurally impossible for a PK-keyed join, see section 3b
  o.unchanged,
  (SELECT count(*) FROM _tll_dupe_rank WHERE rn = 1 AND group_size > 1),
  (SELECT count(*) FROM _tll_dupe_rank WHERE rn > 1),
  (o.orphaned = 0),
  CASE
    WHEN o.orphaned = 0 THEN 'organization_id tightened to NOT NULL (zero orphans found).'
    ELSE 'organization_id LEFT NULLABLE: ' || o.orphaned || ' orphaned row(s) with no resolvable tool_sessions parent. Never guessed. Re-run this accounting after investigating those rows on the target database before tightening.'
  END
FROM _tll_org_report o;

-- =============================================================================
-- 10. Unique key protecting promotion idempotency (hard requirement 5).
--
--    (organization_id, tool_session_id, source_revision, output_type,
--    idempotency_key) — a full (non-partial) unique index.
--
--    "Populate every key element" before creating the index: output_type,
--    idempotency_key, source_revision and tool_session_id are ALWAYS
--    non-NULL by this point (sections 4/5/7, plus tool_session_id was
--    NOT NULL on the canonical producer already). organization_id is the
--    one element that may remain NULL, and only for orphaned rows (section
--    8). This is safe and intentional: Postgres treats each NULL as
--    distinct from every other NULL in a unique index, so orphaned rows
--    never collide with each other OR with a matched row on this index —
--    the constraint is fully enforced for every row whose tenant is known,
--    and simply does not (cannot) enforce tenant-scoped uniqueness for the
--    handful of rows whose tenant is unknown, which is the correct,
--    honest behavior for data we refuse to guess about.
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_tool_initiative_links_promotion
  ON tool_initiative_links (organization_id, tool_session_id, source_revision, output_type, idempotency_key);

-- =============================================================================
-- 11. Tenant-first supporting indexes (FROM A/949) — organization_id leads,
--    matching the org-scope contract other tables in this codebase follow
--    (e.g. idx_tool_sessions_org).
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_tool_initiative_links_org
  ON tool_initiative_links (organization_id);
CREATE INDEX IF NOT EXISTS idx_tool_initiative_links_org_session
  ON tool_initiative_links (organization_id, tool_session_id);
CREATE INDEX IF NOT EXISTS idx_tool_initiative_links_org_batch
  ON tool_initiative_links (organization_id, batch_id);

-- =============================================================================
-- 12. Future-write guard (FROM A/949) — derives organization_id for every
--    future INSERT/UPDATE from the row's own tool_sessions parent, so
--    application code that does not (yet) pass organization_id explicitly
--    still produces a correctly-scoped row, and a caller that passes a
--    WRONG organization_id (inconsistent with the parent session) is
--    rejected outright rather than silently trusted. This is the
--    "organization mismatch detection" required by hard requirement 4 —
--    it is enforced at the database layer, not just in application code,
--    so it holds regardless of which write path (Path A or Path B, or any
--    future one) inserts the row.
-- =============================================================================
CREATE OR REPLACE FUNCTION tool_initiative_links_set_organization_id()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id TEXT;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM tool_sessions
  WHERE id = NEW.tool_session_id;

  IF v_org_id IS NOT NULL THEN
    IF NEW.organization_id IS NOT NULL AND NEW.organization_id <> v_org_id THEN
      RAISE EXCEPTION
        'tool_initiative_links.organization_id (%) does not match tool_sessions.organization_id (%) for tool_session_id %',
        NEW.organization_id, v_org_id, NEW.tool_session_id;
    END IF;
    NEW.organization_id := v_org_id;
  END IF;
  -- If the parent tool_sessions row does not exist (orphan), leave
  -- whatever the caller provided (including NULL) — never guess.

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tool_initiative_links_set_org_id'
  ) THEN
    CREATE TRIGGER trg_tool_initiative_links_set_org_id
      BEFORE INSERT OR UPDATE ON tool_initiative_links
      FOR EACH ROW
      EXECUTE FUNCTION tool_initiative_links_set_organization_id();
  END IF;
END $$;

-- Temp tables (_tll_org_pre, _tll_org_report, _tll_dupe_rank) are all
-- declared `ON COMMIT DROP`: the multi-statement string this file is
-- executed as runs as a single implicit transaction (per the simple query
-- protocol server/scripts/migrate.postgres.ts's `applySql()` relies on for
-- every .sql migration), so each temp table is dropped automatically the
-- moment this migration's transaction commits — no leftover session state
-- even if the pool later reuses the same physical connection for a
-- different migration.
