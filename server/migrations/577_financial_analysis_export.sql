-- Migration 577: V3-I01 Finance Export to Report/Presentation
-- Adds FINANCIAL_ANALYSIS source type support and default template for report builder.

-- Template: Financial Analysis Report (default for FINANCIAL_ANALYSIS source)
INSERT INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  is_public, is_system, is_active, is_default, sections_json
)
VALUES (
  'tpl-financial-analysis-export',
  NULL,
  'Financial Analysis Report',
  'Draft report from financial analysis. Covers overview, key metrics, and recommendations.',
  'FINANCIAL_ANALYSIS',
  'FINANCIAL_ANALYSIS',
  TRUE, TRUE, TRUE, TRUE,
  '[
    {"key":"cover","type":"cover","title":"Cover Page","order":0,"enabled":true,"defaultLength":"short"},
    {"key":"executive_summary","type":"summary","title":"Executive Summary","order":1,"enabled":true,"defaultLength":"medium","required":true},
    {"key":"financial_overview","type":"analysis","title":"Financial Overview & Key Metrics","order":2,"enabled":true,"defaultLength":"medium"},
    {"key":"recommendations","type":"recommendations","title":"Recommendations","order":3,"enabled":true,"defaultLength":"medium"},
    {"key":"appendix","type":"appendix","title":"Appendix","order":4,"enabled":true,"defaultLength":"short"}
  ]'::JSONB
)
ON CONFLICT (id) DO UPDATE SET
  source_type = EXCLUDED.source_type,
  report_type = EXCLUDED.report_type,
  is_default = EXCLUDED.is_default,
  sections_json = EXCLUDED.sections_json;
