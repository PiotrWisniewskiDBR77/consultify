-- RED #4 (audyt adwersaryjny W3/B10): management_reports_report_type_check
-- za wąski względem serwisu.
--
-- Live constraint (server/migrations/062_management_reports.sql /
-- 000_initdb_core_tables.sql) allows only ('TEAM_MEETING', 'STEERING_COMMITTEE').
-- managementReportsService (server/src/services/managementReportsService.ts,
-- DEFAULT_PERIODS + generateReport switch) and the /generate route's validTypes
-- list (server/src/routes/managementReports.routes.ts) both support 5 report
-- types: TEAM_MEETING, TEAM_WEEKLY, STEERING_COMMITTEE, PORTFOLIO_HEALTH, RAID.
-- INSERT of the 3 missing types 500s against the live schema.
--
-- migration 271_management_reports_extended.sql already ships the correct
-- 5-value CHECK, but it only takes effect via `ALTER TABLE ... RENAME TO
-- management_reports_old` + `CREATE TABLE IF NOT EXISTS management_reports`
-- — since the table already exists, CREATE TABLE IF NOT EXISTS is a no-op on
-- Postgres and the widened CHECK from 271 is never applied. This migration
-- fixes the constraint directly and is independent of whether 271 ran.
--
-- Safe, idempotent, additive (no data loss): drops the prior narrower CHECK
-- if present, then re-adds the superset. Same DO-block pattern as
-- 20260417_chat_message_types_execution_family.sql.

DO $$
BEGIN
  ALTER TABLE management_reports
    DROP CONSTRAINT IF EXISTS management_reports_report_type_check;

  ALTER TABLE management_reports
    ADD CONSTRAINT management_reports_report_type_check
    CHECK (report_type IN (
      'TEAM_MEETING',
      'TEAM_WEEKLY',
      'STEERING_COMMITTEE',
      'PORTFOLIO_HEALTH',
      'RAID'
    ));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Note: management_report_schedules / management_report_templates (which 271
-- also widens) do not exist on the live parity schema at all — out of scope
-- for RED #4 (no report is ever inserted into a table that isn't there; that
-- would 500 with "relation does not exist", a different failure than this
-- CHECK-constraint bug). Left untouched here.
