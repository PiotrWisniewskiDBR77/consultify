-- Migration: 508_report_builder_template_id.sql
-- Report Builder - Persist selected template on report
-- Date: 2026-02-04
--
-- Notes:
-- - SQLite doesn't support ADD COLUMN IF NOT EXISTS. Migration runner should ignore duplicate-column errors if re-run.

ALTER TABLE report_builder_reports ADD COLUMN template_id TEXT;

CREATE INDEX IF NOT EXISTS idx_rb_reports_template_id ON report_builder_reports(template_id);

