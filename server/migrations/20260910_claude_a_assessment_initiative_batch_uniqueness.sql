-- 20260910_claude_a_assessment_initiative_batch_uniqueness.sql
--
-- ASM-BVP-001 (part 2) — "exactly-one initiative batch per assessment".
--
-- VERIFIED PROBLEM: `assessment_initiative_batches` has only
-- PRIMARY KEY (id) plus FKs (assessment_id -> assessments, organization_id
-- -> organizations, report_id -> assessment_reports). No unique index on
-- assessment_id, no idempotency key, no CAS/version column. The table's
-- shape is assembled across server/migrations/293_assessment_workflow.sql:97,
-- server/migrations/730_beta_schema_fixes.sql:115,
-- server/migrations/505_assessment_initiative_batches_report_id.sql:9,
-- server/migrations/512_assessment_initiative_generation_runs.sql,
-- server/migrations/20260719_baseline_gap.sql, and
-- server/migrations/20260719_red_assessdep_workflow_schema_fixes.sql — none
-- of them add a uniqueness guard. FOUR independent unconditional INSERT
-- sites exist for this table: server/src/controllers/AssessmentController.ts:1547,
-- server/src/routes/assessment-workflow-v2.routes.ts:1438,
-- server/src/services/assessmentInitiativeGenerationRunService.ts:146/154,
-- server/src/services/assessment/AssessmentWorkbenchService.ts:599 — a
-- DB-level guard is the only protection that reaches all four (two of
-- those files are outside this lane's ownership; see the closure report's
-- INTEGRATOR_CHANGE_REQUEST entries for AssessmentController.ts and
-- assessmentInitiativeGenerationRunService.ts).
--
-- PATTERN PRECEDENT: server/migrations/947_tool_outputs_idempotency_guard.sql
-- (`uq_tool_outputs_active_snapshot_per_session ON tool_outputs
-- (tool_session_id) WHERE status <> 'superseded'`) plus
-- server/src/services/tools/toolOutputSnapshotService.ts's
-- `INSERT ... ON CONFLICT ... DO NOTHING` / re-SELECT-on-conflict fallback.
-- This migration applies the identical shape to
-- assessment_initiative_batches: a PARTIAL unique index scoped to
-- non-superseded rows. Historical rows are never deleted, multiple
-- SUPERSEDED rows per assessment stay structurally legal (revision
-- history), and at most one ACTIVE (non-superseded) batch can exist per
-- (assessment_id, organization_id) at any time.
--
-- TENANCY: organization_id is included in the uniqueness key, per the
-- closure brief's requirement ("must include the organization/tenant
-- column IF the table has one"). Documented for the record: this is
-- defense-in-depth, not a correctness requirement for THIS table, because
-- assessment_id already carries a NOT NULL FK to assessments(id), and
-- assessments.organization_id is itself NOT NULL — one assessment_id value
-- can only ever belong to one organization, so a bare unique-on-assessment_id
-- could not actually collide across tenants here. It is kept anyway for
-- defense-in-depth and to match the brief's stated architecture.
--
-- CORRECTION TO AN EXISTING CODE COMMENT: several call sites (e.g.
-- AssessmentController.ts, assessment-workflow-v2.routes.ts,
-- assessmentInitiativeGenerationRunService.ts) carry a comment claiming
-- "organization_id is NOT NULL with no DB default (Postgres) — omitting it
-- 500s with 23502". The LIVE migrated schema (verified via `\d
-- assessment_initiative_batches` against a fresh full-migration Postgres
-- instance before writing this file) shows organization_id IS nullable on
-- THIS table (unlike assessments.organization_id, which really is NOT
-- NULL). The comment's claim does not hold at the DB level on this schema;
-- COALESCE(organization_id, '') below defends against that nullability so
-- legacy/never-set NULL rows for the SAME assessment still collide with
-- each other under the new index, instead of Postgres treating every NULL
-- as distinct and letting them multiply unchecked.
--
-- PRE-EXISTING DUPLICATES: reconciled BEFORE the index is created. A bare
-- `CREATE UNIQUE INDEX` would fail outright on any database that already
-- has >1 non-superseded row for the same (assessment_id, organization_id)
-- — breaking the shared migration runner for every other lane. Chosen
-- strategy: deterministic KEEP-NEWEST reconciliation. Within each
-- (assessment_id, COALESCE(organization_id,'')) group, the row with the
-- latest created_at wins (ties broken by id DESC, giving a total order);
-- every OTHER row in the group is marked status = 'superseded' — never
-- deleted, so assessment_initiative_links FKs (ON DELETE CASCADE from
-- batch_id) never orphan and full history stays queryable. "Keep newest"
-- was chosen over "keep oldest" because the newest batch reflects the most
-- recent generation/edit attempt for that assessment, which is the row a
-- human operator resolving a legacy duplicate would expect to remain
-- authoritative.
--
-- IDEMPOTENCY: the reconciliation step is guarded by a one-row-per-migration
-- report table (assessment_initiative_batch_dedup_reports) so a second full
-- run of this file is a true no-op: the DO block RETURNs immediately
-- without rescanning the table, and `CREATE TABLE/INDEX/EXTENSION IF NOT
-- EXISTS` make every remaining statement idempotent too.
--
-- Additive only: no DROP, no DELETE, no destructive ALTER. No pre-existing
-- column/constraint is touched; only new objects are added and, for
-- historical duplicates only, an existing row's `status` value is set to a
-- new sentinel ('superseded') that no application code has ever written
-- before this migration (verified: grep found no writer setting
-- assessment_initiative_batches.status to anything but the default
-- 'pending' or AssessmentWorkbenchService.ts's 'draft').

-- =============================================================================
-- 0. Precondition — fail fast, do not repair. This migration is a CONSUMER
--    of a table produced elsewhere; if it is missing, the ordering/producer
--    assumption behind this file is wrong and must be investigated, not
--    silently no-op'd.
-- =============================================================================
DO $$
BEGIN
  IF to_regclass('public.assessment_initiative_batches') IS NULL THEN
    RAISE EXCEPTION 'canonical producer missing or ordered after consumer: table "assessment_initiative_batches" does not exist (expected producer: server/migrations/293_assessment_workflow.sql or server/migrations/20260719_baseline_gap.sql)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_initiative_batches' AND column_name = 'assessment_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_initiative_batches' AND column_name = 'organization_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_initiative_batches' AND column_name = 'status'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_initiative_batches' AND column_name = 'created_at'
  ) THEN
    RAISE EXCEPTION 'canonical producer missing or ordered after consumer: "assessment_initiative_batches" exists but is missing a required column (need assessment_id, organization_id, status, created_at)';
  END IF;
END $$;

-- pgcrypto for gen_random_uuid() — cheap self-sufficiency guard, matches the
-- pattern already used in server/migrations/948_tool_promotion_tenant_idempotency.sql.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. Durable reconciliation report — holds AT MOST ONE row (unique on
--    migration_filename), so re-running this file never appends a second
--    row and section 2 below can use its existence as the "already ran"
--    idempotency guard.
-- =============================================================================
CREATE TABLE IF NOT EXISTS assessment_initiative_batch_dedup_reports (
  id                        TEXT PRIMARY KEY DEFAULT ('aibdr_' || gen_random_uuid()::text),
  migration_filename        TEXT NOT NULL UNIQUE,
  run_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_rows_before         INTEGER NOT NULL,
  duplicate_groups          INTEGER NOT NULL,
  duplicate_rows_superseded INTEGER NOT NULL,
  notes                     TEXT
);

-- =============================================================================
-- 2. Deterministic keep-newest reconciliation of pre-existing duplicates.
--    No-ops on the second run (report row already present -> RETURN).
-- =============================================================================
DO $$
DECLARE
  v_total      INTEGER;
  v_groups     INTEGER;
  v_superseded INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM assessment_initiative_batch_dedup_reports
    WHERE migration_filename = '20260910_claude_a_assessment_initiative_batch_uniqueness.sql'
  ) THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_total FROM assessment_initiative_batches;

  CREATE TEMP TABLE _aib_dupe_rank ON COMMIT DROP AS
  SELECT
    id,
    row_number() OVER (
      PARTITION BY assessment_id, COALESCE(organization_id, '')
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn,
    count(*) OVER (
      PARTITION BY assessment_id, COALESCE(organization_id, '')
    ) AS group_size
  FROM assessment_initiative_batches
  WHERE status IS DISTINCT FROM 'superseded';

  SELECT count(*) FILTER (WHERE rn = 1 AND group_size > 1) INTO v_groups FROM _aib_dupe_rank;
  SELECT count(*) FILTER (WHERE rn > 1) INTO v_superseded FROM _aib_dupe_rank;

  UPDATE assessment_initiative_batches b
     SET status = 'superseded',
         updated_at = NOW()
    FROM _aib_dupe_rank r
   WHERE b.id = r.id
     AND r.rn > 1;

  INSERT INTO assessment_initiative_batch_dedup_reports (
    migration_filename, total_rows_before, duplicate_groups, duplicate_rows_superseded, notes
  ) VALUES (
    '20260910_claude_a_assessment_initiative_batch_uniqueness.sql',
    v_total,
    COALESCE(v_groups, 0),
    COALESCE(v_superseded, 0),
    CASE WHEN COALESCE(v_superseded, 0) = 0
      THEN 'No pre-existing duplicates found; nothing reconciled.'
      ELSE v_superseded || ' row(s) across ' || v_groups || ' group(s) marked status=''superseded'' (keep-newest by created_at, tie-break id DESC).'
    END
  );
END $$;

-- =============================================================================
-- 3. The actual DB-level "at most one ACTIVE batch per assessment"
--    guarantee. Section 2 above guarantees every pre-existing duplicate is
--    already resolved (and is itself idempotent), so this CREATE succeeds
--    on both a fresh DB and one carrying historical duplicates, on the
--    first run AND on every subsequent run (IF NOT EXISTS).
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_initiative_batches_one_active_per_assessment
  ON assessment_initiative_batches (assessment_id, (COALESCE(organization_id, '')))
  WHERE status IS DISTINCT FROM 'superseded';

-- Temp table _aib_dupe_rank is declared ON COMMIT DROP: this file runs as a
-- single implicit transaction under server/scripts/migrate.postgres.ts's
-- applySql(), so it is dropped the moment this migration's transaction
-- commits — no leftover session state even if the pool reuses the same
-- physical connection for a later migration.
