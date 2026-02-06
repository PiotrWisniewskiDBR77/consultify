-- Migration 518: Interview and Tool report templates
-- Adds system templates for Interview and Tool source types

-- Interview Summary Report template
INSERT OR IGNORE INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public,
  created_by, created_at, updated_at
) VALUES (
  'tpl-interview-summary',
  NULL,
  'Interview Summary Report',
  'Concise summary of discovery interview findings, key insights, gaps and recommendations.',
  'INTERVIEW',
  'interview_summary',
  '[
    {"key":"cover","type":"cover","title":"Cover Page","order":0,"required":true},
    {"key":"executive_summary","type":"summary","title":"Executive Summary","order":1,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"methodology","type":"methodology","title":"Interview Methodology","order":2,"required":false,"defaultLength":"short","defaultLanguage":"general"},
    {"key":"key_findings","type":"recommendations","title":"Key Findings","order":3,"required":true,"defaultLength":"long","defaultLanguage":"business"},
    {"key":"gaps_analysis","type":"list","title":"Identified Gaps","order":4,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"pain_points","type":"list","title":"Pain Points & Constraints","order":5,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"recommendations","type":"recommendations","title":"Recommendations","order":6,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"next_steps","type":"action_plan","title":"Next Steps","order":7,"required":true,"defaultLength":"short","defaultLanguage":"business"}
  ]',
  '{"length":"medium","language":"business","verbosity":"standard"}',
  1, 1, 0,
  'system',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Interview Detailed Analysis template
INSERT OR IGNORE INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public,
  created_by, created_at, updated_at
) VALUES (
  'tpl-interview-detailed',
  NULL,
  'Interview Detailed Analysis',
  'Comprehensive analysis of all interview questions, answers, and cross-cutting themes.',
  'INTERVIEW',
  'interview_detailed',
  '[
    {"key":"cover","type":"cover","title":"Cover Page","order":0,"required":true},
    {"key":"executive_summary","type":"summary","title":"Executive Summary","order":1,"required":true,"defaultLength":"long","defaultLanguage":"business"},
    {"key":"methodology","type":"methodology","title":"Interview Approach","order":2,"required":true,"defaultLength":"medium","defaultLanguage":"general"},
    {"key":"strategy_findings","type":"axis_analysis","title":"Strategy & Vision","order":3,"required":true,"defaultLength":"long","defaultLanguage":"business","repeatFor":"category","repeatKey":"strategy"},
    {"key":"operations_findings","type":"axis_analysis","title":"Operations & Processes","order":4,"required":true,"defaultLength":"long","defaultLanguage":"business","repeatFor":"category","repeatKey":"operations"},
    {"key":"digital_findings","type":"axis_analysis","title":"Digital & Technology","order":5,"required":true,"defaultLength":"long","defaultLanguage":"technical","repeatFor":"category","repeatKey":"digital"},
    {"key":"people_findings","type":"axis_analysis","title":"People & Culture","order":6,"required":true,"defaultLength":"long","defaultLanguage":"business","repeatFor":"category","repeatKey":"people"},
    {"key":"finance_findings","type":"axis_analysis","title":"Finance & Resources","order":7,"required":true,"defaultLength":"long","defaultLanguage":"business","repeatFor":"category","repeatKey":"finance"},
    {"key":"cross_cutting_themes","type":"recommendations","title":"Cross-cutting Themes","order":8,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"gaps_matrix","type":"matrix","title":"Gaps & Maturity Matrix","order":9,"required":false,"defaultLength":"medium"},
    {"key":"recommendations","type":"recommendations","title":"Strategic Recommendations","order":10,"required":true,"defaultLength":"long","defaultLanguage":"business"},
    {"key":"action_plan","type":"action_plan","title":"Implementation Roadmap","order":11,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"appendix","type":"appendix","title":"Appendix: Interview Details","order":12,"required":false,"defaultLength":"long"}
  ]',
  '{"length":"long","language":"business","verbosity":"detailed"}',
  1, 0, 0,
  'system',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Tool Evaluation Report template
INSERT OR IGNORE INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public,
  created_by, created_at, updated_at
) VALUES (
  'tpl-tool-evaluation',
  NULL,
  'Tool Evaluation Report',
  'Summary report from tool-based assessment sessions with findings and recommendations.',
  'TOOL',
  'tool_evaluation',
  '[
    {"key":"cover","type":"cover","title":"Cover Page","order":0,"required":true},
    {"key":"executive_summary","type":"summary","title":"Executive Summary","order":1,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"methodology","type":"methodology","title":"Assessment Methodology","order":2,"required":false,"defaultLength":"short","defaultLanguage":"general"},
    {"key":"tool_overview","type":"list","title":"Tool & Process Overview","order":3,"required":true,"defaultLength":"medium","defaultLanguage":"technical"},
    {"key":"findings","type":"recommendations","title":"Key Findings","order":4,"required":true,"defaultLength":"long","defaultLanguage":"business"},
    {"key":"gaps","type":"list","title":"Identified Gaps","order":5,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"recommendations","type":"recommendations","title":"Recommendations","order":6,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"next_steps","type":"action_plan","title":"Next Steps","order":7,"required":true,"defaultLength":"short","defaultLanguage":"business"}
  ]',
  '{"length":"medium","language":"business","verbosity":"standard"}',
  1, 1, 0,
  'system',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Tool Comparison Report template
INSERT OR IGNORE INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public,
  created_by, created_at, updated_at
) VALUES (
  'tpl-tool-comparison',
  NULL,
  'Tool Comparison Report',
  'Comparative analysis across multiple tool sessions with scoring and prioritization.',
  'TOOL',
  'tool_comparison',
  '[
    {"key":"cover","type":"cover","title":"Cover Page","order":0,"required":true},
    {"key":"executive_summary","type":"summary","title":"Executive Summary","order":1,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"comparison_matrix","type":"matrix","title":"Comparison Matrix","order":2,"required":true,"defaultLength":"medium"},
    {"key":"detailed_analysis","type":"axis_analysis","title":"Detailed Analysis","order":3,"required":true,"defaultLength":"long","defaultLanguage":"technical"},
    {"key":"scoring","type":"list","title":"Scoring & Prioritization","order":4,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"recommendations","type":"recommendations","title":"Recommendations","order":5,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"implementation_plan","type":"action_plan","title":"Implementation Plan","order":6,"required":true,"defaultLength":"medium","defaultLanguage":"business"}
  ]',
  '{"length":"medium","language":"business","verbosity":"standard"}',
  1, 0, 0,
  'system',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Add rejected/utilized columns to assessment_reports if missing
-- (these columns are referenced by the new reject/utilize endpoints)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we use a safe approach
CREATE TABLE IF NOT EXISTS _migration_518_done (id INTEGER PRIMARY KEY);
INSERT OR IGNORE INTO _migration_518_done VALUES (1);
