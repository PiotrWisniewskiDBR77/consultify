-- Day 314 — the same divergence day313 closed for `coverage_percent`, for the
-- two sibling columns it left behind.
--
-- DatabaseInitializer's runtime DDL creates imported_reports with
-- canonical_markdown / auto_summary / coverage_percent. The migration set only
-- ever gained coverage_percent (20261913). On a database built from migrations
-- the other two are absent, so on a fresh install:
--   * GET /api/report-builder/sources/upload_bundle/:sourceId SELECTs both and
--     fails with `column "canonical_markdown" does not exist`;
--   * reportImportService's post-processing UPDATE writes both and fails too,
--     so an imported report can never persist its canonical markdown/summary.
--
-- Verified against a database migrated from zero:
--   SELECT id, canonical_markdown, auto_summary FROM imported_reports
--   -> ERROR: column "canonical_markdown" does not exist
--
-- Additive only: no data is moved, no column is dropped, safe to re-run.
ALTER TABLE IF EXISTS imported_reports
  ADD COLUMN IF NOT EXISTS canonical_markdown TEXT;

ALTER TABLE IF EXISTS imported_reports
  ADD COLUMN IF NOT EXISTS auto_summary TEXT;
