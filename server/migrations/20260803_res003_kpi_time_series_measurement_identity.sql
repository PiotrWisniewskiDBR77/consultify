-- RES-003: give kpi_time_series a real measurement identity.
--
-- Today every writer (canonical v8 route, legacy /api/benefits fallback, the
-- IRIS bulk-ingest loop, and connector ingestion) does a bare INSERT with no
-- unique key beyond the row `id`. Resubmitting the same (kpi, period,
-- source) — a double-click, a browser retry, a re-run import, a corrected
-- value — silently creates a second row. This migration is additive only
-- (no DROP, no data-shape change for existing consumers) and idempotent —
-- safe to re-run.
--
-- Ordering vs RES-02: this file's date prefix (20260803) ties it with
-- 20260803_res002_kpi_definition_versions.sql; the migration runner sorts
-- filenames lexicographically and "res002" < "res003", so RES-02's file
-- (which adds kpi_time_series.definition_version_id) always applies first.
-- This file does not reference that column at all — independent concerns,
-- ordering is a non-issue in practice, documented here in case someone
-- renames one of the two files later.
--
-- Before running on a populated database (demo/prod): the dedupe step below
-- deletes exact-duplicate rows automatically (keeping the newest per group).
-- Review the RAISE NOTICE counts in the migration log before/after on any
-- environment that is not a fresh/local test database.

BEGIN;

ALTER TABLE kpi_time_series
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Backfill updated_at for pre-existing rows so it is never NULL going forward.
UPDATE kpi_time_series SET updated_at = created_at WHERE updated_at IS NULL;

-- source has a DEFAULT but was never declared NOT NULL; a NULL source would
-- be treated as distinct-from-every-other-NULL by a unique index (Postgres
-- NULL semantics), silently reopening the same duplicate hole for rows that
-- happen to have a NULL source. Close it before adding the constraint.
UPDATE kpi_time_series SET source = 'manual' WHERE source IS NULL;
ALTER TABLE kpi_time_series ALTER COLUMN source SET NOT NULL;

-- Dedupe pass: for any (kpi_id, period_start, source) group with more than
-- one row, keep the most recently created row (tie-broken by id) and delete
-- the rest. Logged via RAISE NOTICE so a human can review the count on any
-- non-fresh database before this migration is applied there.
DO $$
DECLARE
  removed_count INTEGER;
BEGIN
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY kpi_id, period_start, source
        ORDER BY created_at DESC, id DESC
      ) AS rn
    FROM kpi_time_series
  ), to_delete AS (
    DELETE FROM kpi_time_series
    WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    RETURNING id
  )
  SELECT count(*) INTO removed_count FROM to_delete;

  RAISE NOTICE 'RES-003 kpi_time_series dedupe: removed % duplicate row(s)', removed_count;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_kpi_time_series_kpi_period_source
  ON kpi_time_series (kpi_id, period_start, source);

COMMIT;
