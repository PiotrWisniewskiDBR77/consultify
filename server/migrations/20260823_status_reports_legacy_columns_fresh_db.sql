-- Fresh PostgreSQL replays create the ExecutionHub (rich) status_reports shape
-- before PostgresDatabase bootstrap. The later legacy CREATE TABLE IF NOT EXISTS
-- is therefore a no-op, leaving the live /status-reports routes and demo seed
-- without title/content/health/period. Older bootstrap-first databases already
-- have those columns and received the rich columns through the 20260719
-- backfill. Make both creation orders converge on the same additive superset.

ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS health TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS period TEXT;

-- Legacy status notes are project-scoped and do not carry ExecutionHub cadence
-- coordinates. These columns were nullable in the bootstrap-first convergence
-- path, so remove the fresh-db-only NOT NULL asymmetry.
ALTER TABLE status_reports ALTER COLUMN initiative_id DROP NOT NULL;
ALTER TABLE status_reports ALTER COLUMN period_start DROP NOT NULL;
ALTER TABLE status_reports ALTER COLUMN period_end DROP NOT NULL;
