-- Migration: 614_report_builder_results_kpi_report_template.sql
-- Report Builder — default template for Results KPI Reports (R1)
-- Date: 2026-02-28

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
  'system',
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

