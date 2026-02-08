-- Migration: 505_assessment_initiative_batches_report_id
-- Purpose: Link initiative generation batches to a specific assessment report (optional)
-- Date: 2026-02-01
--
-- Notes:
-- - SQLite doesn't support ADD COLUMN IF NOT EXISTS; this migration assumes it runs once.
-- - In environments where the column already exists, the migration runner should ignore the error.

ALTER TABLE assessment_initiative_batches ADD COLUMN report_id TEXT REFERENCES assessment_reports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assessment_batches_report ON assessment_initiative_batches(report_id);

