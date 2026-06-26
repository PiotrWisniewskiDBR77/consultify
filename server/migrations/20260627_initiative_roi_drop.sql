-- Drop legacy estimated_roi column.
-- Canonical column is expected_roi; all rows backfilled via 20260624_initiative_column_dedup.
-- NL-query readers (textToSqlService) migrated to expected_roi in E4 (2026-06-26).
ALTER TABLE initiatives DROP COLUMN IF EXISTS estimated_roi;
