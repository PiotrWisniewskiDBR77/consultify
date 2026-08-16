-- Legacy status/audit routes are mounted production surfaces. Earlier base
-- migrations created these tables before the route contracts gained the
-- columns below, so CREATE TABLE IF NOT EXISTS could never repair an upgrade.
-- Keep this migration additive and repeatable; no runtime route may own DDL.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS health TEXT DEFAULT 'green';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS progress_pct INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '{}';
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS health TEXT DEFAULT 'green';
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS period TEXT DEFAULT 'weekly';

-- The mounted legacy writer is project-scoped and does not accept initiative
-- or explicit date bounds. These constraints came from the newer M14 shape and
-- otherwise make every legacy POST a false 201 with no durable row.
ALTER TABLE status_reports ALTER COLUMN initiative_id DROP NOT NULL;
ALTER TABLE status_reports ALTER COLUMN period_start DROP NOT NULL;
ALTER TABLE status_reports ALTER COLUMN period_end DROP NOT NULL;

ALTER TABLE audits ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'internal';
ALTER TABLE audits ADD COLUMN IF NOT EXISTS auditor TEXT DEFAULT '';
ALTER TABLE audits ADD COLUMN IF NOT EXISTS scheduled_date TEXT;
ALTER TABLE audits ALTER COLUMN scheduled_date TYPE TEXT USING scheduled_date::TEXT;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS completed_date TIMESTAMP;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS score INTEGER;
