-- RES-02: canonical KPI definition owner + immutable versioning.
--
-- Canonical owner object stays `initiative_kpis` (id = canonical KPI identity).
-- This migration adds an immutable version ledger next to it, a CAS-safe
-- "current version" pointer, an archive flag (delete = archive, no history
-- loss), and an ADDITIVE pin from `kpi_time_series` to the definition version
-- that was current when each measurement was recorded. It does not touch
-- `rollout_kpis` or `tp_kpi_definitions` (explicitly out of RES-02 scope) and
-- does not rebuild RES-03 beyond that one additive column + backfill.
--
-- Idempotent: every DDL statement uses IF NOT EXISTS / ON CONFLICT, and the
-- backfill INSERT is guarded by NOT EXISTS so re-running this file is a no-op
-- once converged. Safe to run as part of the standard --safe migration chain;
-- if `initiative_kpis` does not exist yet at the point this file is attempted
-- (see the ordering note below), the run fails loudly and the operator's next
-- invocation of the migration runner converges it — same convergence pattern
-- already required for every other 2026-dated migration in this repo, because
-- `server/scripts/migrate.postgres.ts` sorts filenames lexicographically and
-- "2026..." sorts before 3-digit legacy filenames like "565_..." that create
-- `initiative_kpis`. This is pre-existing migration-runner debt (confirmed
-- 2026-08-02, RES-02 discovery), not something introduced here, and is out of
-- RES-02's scope to fix.
--
-- Fail-closed backfill: if any pre-existing `initiative_kpis` row has no
-- resolvable organization scope (neither its own organization_id nor its
-- initiative's), the migration RAISEs and refuses to proceed rather than
-- guessing. No heuristic name-matching against v8_kpi_definitions is used
-- anywhere in this file.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 0. Defensive column guards on the owner object.
--
-- `initiative_kpis.organization_id`, `baseline_value`, `direction`,
-- `threshold_mode`, `amber/red_threshold_pct|abs`, `owner_user_id` and
-- `current_value` are normally added by
-- `20260802_results_deviation_schema_parity.sql`, and `category` by
-- `20260719_baseline_gap.sql`. On a genuinely fresh Postgres run through
-- `server/scripts/migrate.postgres.ts`, `baseline_gap.sql` reliably fails on
-- an UNRELATED statement deep in that ~18k-line file (an `error_class` column
-- on a completely different table) and rolls back as one batch — so
-- `category` never lands, no matter how many convergence passes are run.
-- That is pre-existing, unrelated migration debt (confirmed 2026-08-02,
-- out of RES-02 scope to fix). RES-02's own version snapshot must not have a
-- silent hidden dependency on that file succeeding, so every column the
-- definition snapshot below reads is guaranteed to exist here too. Adding a
-- column that another migration will also (successfully, elsewhere) add is a
-- harmless no-op via IF NOT EXISTS.
-- ============================================================

ALTER TABLE initiative_kpis
  ADD COLUMN IF NOT EXISTS organization_id TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS baseline_value REAL,
  ADD COLUMN IF NOT EXISTS current_value REAL,
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT,
  ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'HIGHER_IS_BETTER',
  ADD COLUMN IF NOT EXISTS threshold_mode TEXT DEFAULT 'PERCENT_FROM_TARGET',
  ADD COLUMN IF NOT EXISTS amber_threshold_pct REAL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS red_threshold_pct REAL DEFAULT 0.20,
  ADD COLUMN IF NOT EXISTS amber_threshold_abs REAL,
  ADD COLUMN IF NOT EXISTS red_threshold_abs REAL;

-- ============================================================
-- 1. Immutable version ledger
-- ============================================================

CREATE TABLE IF NOT EXISTS kpi_definition_versions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  kpi_id TEXT NOT NULL REFERENCES initiative_kpis(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL CHECK (version_no > 0),
  definition JSONB NOT NULL,
  definition_hash TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'service',
  UNIQUE (kpi_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_kpi_definition_versions_org
  ON kpi_definition_versions(organization_id);
CREATE INDEX IF NOT EXISTS idx_kpi_definition_versions_org_kpi
  ON kpi_definition_versions(organization_id, kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_definition_versions_kpi_created
  ON kpi_definition_versions(kpi_id, created_at DESC);

-- ============================================================
-- 2. CAS-safe "current version" pointer + archive flag on the owner object
-- ============================================================

ALTER TABLE initiative_kpis
  ADD COLUMN IF NOT EXISTS current_definition_version INTEGER,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by TEXT;

-- Composite FK ties `current_definition_version` to a version row that
-- genuinely exists for THIS kpi (via the UNIQUE(kpi_id, version_no) above).
-- A dangling/forged pointer is impossible at the DB layer, not just in the
-- service. DEFERRABLE so a transaction can insert the version row and update
-- the pointer in either order and still only be checked at COMMIT — this is
-- what makes kpiDefinitionService's single-transaction create/update safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_initiative_kpis_current_version'
  ) THEN
    ALTER TABLE initiative_kpis
      ADD CONSTRAINT fk_initiative_kpis_current_version
      FOREIGN KEY (id, current_definition_version)
      REFERENCES kpi_definition_versions (kpi_id, version_no)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- ============================================================
-- 3. RES-03 additive pin: which definition version was current when a
--    measurement was recorded. Nullable (pre-RES-02 rows), no rebuild of
--    RES-03's own logic.
-- ============================================================

ALTER TABLE kpi_time_series
  ADD COLUMN IF NOT EXISTS definition_version_id TEXT
  REFERENCES kpi_definition_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kpi_time_series_definition_version
  ON kpi_time_series(definition_version_id);

-- ============================================================
-- 4. V8/ROI adapter: v8_kpi_definitions is NOT a second owner. Add an
--    explicit, nullable pointer to the canonical identity. Existing rows are
--    left NULL (an explicit "unmapped" state) — no heuristic name-matching.
--    New writes from resultsROIService.createKPI must populate this going
--    forward (enforced in application code, FAZA B).
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.v8_kpi_definitions') IS NOT NULL THEN
    ALTER TABLE v8_kpi_definitions
      ADD COLUMN IF NOT EXISTS canonical_kpi_id TEXT REFERENCES initiative_kpis(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_v8_kpi_definitions_canonical
      ON v8_kpi_definitions(canonical_kpi_id);
  END IF;
END $$;

-- ============================================================
-- 5. Backfill: fail-closed org-scope check, then v1 for every existing
--    initiative_kpis row, then pin every existing kpi_time_series row to v1
--    (the only version that could ever have been "current" before RES-02
--    existed). Idempotent throughout.
-- ============================================================

DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM initiative_kpis k
  LEFT JOIN initiatives i ON i.id = k.initiative_id
  WHERE NOT EXISTS (SELECT 1 FROM kpi_definition_versions v WHERE v.kpi_id = k.id)
    AND COALESCE(k.organization_id, i.organization_id) IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'RES-02 backfill fail-closed: % initiative_kpis row(s) have no resolvable organization_id (neither their own nor via their initiative). Resolve manually (assign organization_id or archive the row) before re-running this migration.',
      orphan_count;
  END IF;
END $$;

INSERT INTO kpi_definition_versions (
  organization_id, kpi_id, version_no, definition, definition_hash,
  created_by, reason, source, created_at
)
SELECT
  organization_id,
  kpi_id,
  1,
  definition,
  encode(digest(definition::text, 'sha256'), 'hex') AS definition_hash,
  NULL,
  'backfill:res-02-v1',
  'backfill',
  created_at
FROM (
  SELECT
    COALESCE(k.organization_id, i.organization_id) AS organization_id,
    k.id AS kpi_id,
    jsonb_build_object(
      'name', k.name,
      'description', k.description,
      'category', k.category,
      'unit', k.unit,
      'direction', k.direction,
      'measurementFrequency', k.measurement_frequency,
      'baselineValue', k.baseline_value,
      'targetValue', k.target_value,
      'thresholdMode', k.threshold_mode,
      'amberThresholdPct', k.amber_threshold_pct,
      'redThresholdPct', k.red_threshold_pct,
      'amberThresholdAbs', k.amber_threshold_abs,
      'redThresholdAbs', k.red_threshold_abs,
      'alertThreshold', k.alert_threshold,
      'alertDirection', k.alert_direction,
      'ownerUserId', k.owner_user_id,
      'kpiKind', k.kpi_kind,
      'leadsKpiId', k.leads_kpi_id
    ) AS definition,
    COALESCE(k.updated_at, k.created_at, CURRENT_TIMESTAMP) AS created_at
  FROM initiative_kpis k
  LEFT JOIN initiatives i ON i.id = k.initiative_id
  WHERE NOT EXISTS (SELECT 1 FROM kpi_definition_versions v WHERE v.kpi_id = k.id)
) backfill_source;

UPDATE initiative_kpis k
SET current_definition_version = 1
WHERE k.current_definition_version IS NULL
  AND EXISTS (
    SELECT 1 FROM kpi_definition_versions v
    WHERE v.kpi_id = k.id AND v.version_no = 1
  );

UPDATE kpi_time_series ts
SET definition_version_id = v.id
FROM kpi_definition_versions v
WHERE ts.definition_version_id IS NULL
  AND v.kpi_id = ts.kpi_id
  AND v.version_no = 1;
