-- 932_report_builder_archive_columns.sql
-- Keep the formal PostgreSQL schema aligned with report archive/unarchive support.
-- DatabaseInitializer already creates these columns for newly initialized databases,
-- but existing databases upgraded through migrations did not receive them.

ALTER TABLE report_builder_reports
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

ALTER TABLE report_builder_reports
    ADD COLUMN IF NOT EXISTS archived_by TEXT;

CREATE INDEX IF NOT EXISTS idx_rb_reports_archived
    ON report_builder_reports (organization_id, archived_at);
