-- RED-RESULTS (2026-07-19) — seed the missing global default RESULTS_KPI_REPORT template.
--
-- Root cause of a 500 on POST /api/results/kpi-reports (and .../refresh):
--   routes/results-kpi-reports.routes.ts -> createReportArtifactFromSnapshot()
--   calls ReportBuilderService.createReport({ sourceType: 'RESULTS_KPI_REPORT' }),
--   which resolves a template via getTemplateForSource('RESULTS_KPI_REPORT', ...).
--   No template with source_type='RESULTS_KPI_REPORT' exists for ANY org, and the
--   fallback list only covers UPLOAD_BUNDLE / WORK_CANVAS, so it hard-throws
--   'No template found for this source type' -> uncaught -> 500 for every org.
--
-- The route writes exactly these five section keys, so the default template
-- declares them (plus a cover): executive_summary, kpi_overview,
-- deviation_cases, action_plan, appendix.
--
-- Additive + idempotent (ON CONFLICT (id) DO NOTHING). Global default
-- (organization_id NULL) mirrors the other is_default=true system templates.

INSERT INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, is_system, is_default, is_public, category, created_at, updated_at
) VALUES (
  'tpl-results-kpi-report-default',
  NULL,
  'KPI Review Report',
  'Default template for scheduled/ad-hoc KPI review reports promoted from Results KPI snapshots.',
  'RESULTS_KPI_REPORT',
  'RESULTS_KPI_REPORT',
  $json$[
    {"key":"cover","type":"cover","title":"Cover Page","required":true,"order":0,"defaultLength":"short","defaultLanguage":"business","config":{"showLogo":true,"showDate":true,"showOrganization":true}},
    {"key":"executive_summary","type":"summary","title":"Executive Summary","required":true,"order":1,"defaultLength":"long","defaultLanguage":"business"},
    {"key":"kpi_overview","type":"content","title":"KPI Overview","required":true,"order":2,"defaultLength":"long","defaultLanguage":"business"},
    {"key":"deviation_cases","type":"content","title":"Deviation Cases","required":false,"order":3,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"action_plan","type":"content","title":"Action Plan","required":false,"order":4,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"appendix","type":"appendix","title":"Appendix","required":false,"order":5,"defaultLength":"short","defaultLanguage":"business"}
  ]$json$,
  true,
  true,
  true,
  'results',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;
