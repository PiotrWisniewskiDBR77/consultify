-- 20260720_report_builder_kpi_review_template.sql
-- E-MIG6XX: re-issue of server/migrations/614_report_builder_results_kpi_report_template.sql
--
-- WHY: 614_report_builder_results_kpi_report_template.sql was never applied to the live
-- database — it predates the "Table Platform" boot autorun regex
-- (/^(7\d{2}|\d{8})_.*\.sql$/ in runTablePlatformMigrations(), DatabaseInitializer.ts) and was
-- never run through server/scripts/migrate.postgres.ts on the current demo/staging DB.
-- Confirmed empirically: report_builder_templates has 16 rows on the live-mirrored parity DB
-- (:5443), none with id = 'tpl-results-kpi-review'. The table + all columns already exist
-- (created inline by DatabaseInitializer.ts, confirmed present), so only this ONE seed row
-- is missing.
--
-- LIVE CALLER: Report Builder template picker (src/components/ReportBuilder/TemplatesManager.tsx)
-- reads report_builder_templates via the report-builder templates endpoint.
--
-- Note: a conceptually similar template ('tpl-results-kpi-report-default', "KPI Review Report")
-- already exists on the live DB via a different, inline seeding path — this migration does not
-- touch that row (different id). Re-issuing 614 verbatim adds this specific named template back
-- as originally intended; the two can be reconciled/merged as a separate content decision if
-- Piotr wants a single canonical KPI report template.
--
-- Content is a copy of 614's SQL body: already Postgres-native, already idempotent
-- (ON CONFLICT (id) DO UPDATE) — no dialect translation needed. ONE fix applied: 614's
-- `created_by = 'system'` violates `report_builder_templates_created_by_fkey` (FOREIGN KEY
-- created_by REFERENCES users(id)) -- there is no users row with id 'system' (confirmed via
-- psql dry-run against parity :5443 -- this bug was never caught because 614 never actually
-- ran). Every other system/default template in this table uses NULL created_by, so this
-- migration does the same instead of inventing a fake user.

INSERT INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public,
  created_by, created_at, updated_at
) VALUES (
  'tpl-results-kpi-review',
  NULL,
  'Results - KPI Performance Review',
  'KPI performance review report with deviation cases and action plan (R1).',
  'RESULTS_KPI_REPORT',
  'RESULTS_KPI_REPORT',
  '[
    {"key":"cover","type":"cover","title":"Cover Page","order":0,"required":false,"defaultLength":"short","defaultLanguage":"business"},
    {"key":"executive_summary","type":"summary","title":"Executive Summary","order":1,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"kpi_overview","type":"list","title":"KPI Overview","order":2,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"deviation_cases","type":"list","title":"Deviation Cases","order":3,"required":false,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"action_plan","type":"action_plan","title":"Action Plan","order":4,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"appendix","type":"appendix","title":"Appendix","order":5,"required":false,"defaultLength":"long","defaultLanguage":"technical"}
  ]',
  '{"length":"medium","language":"business","verbosity":"standard","invocationProfile":"results_kpi_review"}',
  true, true, false,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  source_type = EXCLUDED.source_type,
  report_type = EXCLUDED.report_type,
  sections_json = EXCLUDED.sections_json,
  default_options_json = EXCLUDED.default_options_json,
  is_system = EXCLUDED.is_system,
  is_default = EXCLUDED.is_default,
  is_public = EXCLUDED.is_public,
  created_by = EXCLUDED.created_by,
  updated_at = EXCLUDED.updated_at;
