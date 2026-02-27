-- Migration: 503_report_builder.sql
-- Report Builder Module - Generic report generation from various sources
-- Date: 2026-01-31

-- ==========================================
-- REPORTS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS report_builder_reports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  
  -- Source reference (polymorphic)
  source_type TEXT NOT NULL,  -- 'ASSESSMENT' | 'INTERVIEW' | 'TOOL' | 'INITIATIVE'
  source_id TEXT NOT NULL,
  source_name TEXT,
  source_framework TEXT,  -- e.g., 'DRD', 'SIRI' for assessments
  
  -- Report metadata
  title TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL,  -- 'ASSESSMENT_DRD' | 'ASSESSMENT_SIRI' | etc.
  
  -- Configuration (JSON)
  config_json TEXT,
  
  -- Company context (JSON) - snapshot at report creation
  company_context_json TEXT,
  
  -- Status workflow
  status TEXT NOT NULL DEFAULT 'DRAFT',
  -- DRAFT -> CONFIGURING -> GENERATING -> GENERATED -> IN_REVIEW -> APPROVED -> UTILIZED
  
  -- Ownership & timestamps
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT,
  
  -- Workflow timestamps
  generated_at TIMESTAMP,
  finalized_at TIMESTAMP,
  submitted_at TIMESTAMP,
  approved_at TIMESTAMP,
  approved_by TEXT,
  utilized_at TIMESTAMP,
  
  -- Version tracking
  version INTEGER DEFAULT 1,
  parent_report_id TEXT,
  
  -- Export paths
  pdf_path TEXT,
  pptx_path TEXT,
  
  -- Generation metadata (JSON)
  generation_metadata TEXT,
  
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (parent_report_id) REFERENCES report_builder_reports(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rb_reports_organization ON report_builder_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_rb_reports_source ON report_builder_reports(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_rb_reports_status ON report_builder_reports(status);
CREATE INDEX IF NOT EXISTS idx_rb_reports_created_by ON report_builder_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_rb_reports_type ON report_builder_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_rb_reports_created_at ON report_builder_reports(created_at DESC);

-- ==========================================
-- REPORT SECTIONS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS report_builder_sections (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  
  -- Section identity
  section_key TEXT NOT NULL,  -- Unique key within report
  section_type TEXT NOT NULL,  -- 'cover', 'summary', 'matrix', 'axis_analysis', etc.
  title TEXT NOT NULL,
  
  -- Ordering
  order_index INTEGER NOT NULL DEFAULT 0,
  
  -- Configuration
  enabled BOOLEAN DEFAULT true,
  required BOOLEAN DEFAULT false,
  
  -- Generation options
  length TEXT DEFAULT 'medium',  -- 'short' | 'medium' | 'long'
  language TEXT DEFAULT 'business',  -- 'technical' | 'business' | 'general'
  custom_prompt TEXT,
  
  -- Content
  generated_content TEXT,  -- AI-generated content (markdown or JSON)
  edited_content TEXT,  -- User-edited content (takes precedence)
  content_format TEXT DEFAULT 'markdown',  -- 'markdown' | 'json' | 'tiptap'
  
  -- TipTap editor content (JSON)
  tiptap_content TEXT,
  
  -- Source data snapshot for this section (JSON)
  source_data_snapshot TEXT,
  
  -- Generation metadata
  generated_at TIMESTAMP,
  tokens_used INTEGER,
  generation_model TEXT,
  
  -- Edit metadata
  edited_at TIMESTAMP,
  edited_by TEXT,
  
  -- Repeat info (for axis/area sections)
  repeat_for TEXT,  -- NULL | 'axis' | 'area'
  repeat_key TEXT,  -- e.g., '1' for axis 1, '1A' for area 1A
  repeat_name TEXT,  -- e.g., 'Digital Processes'
  repeat_data TEXT,  -- JSON with axis/area specific data
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (report_id) REFERENCES report_builder_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (edited_by) REFERENCES users(id),
  
  UNIQUE(report_id, section_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rb_sections_report ON report_builder_sections(report_id);
CREATE INDEX IF NOT EXISTS idx_rb_sections_key ON report_builder_sections(report_id, section_key);
CREATE INDEX IF NOT EXISTS idx_rb_sections_order ON report_builder_sections(report_id, order_index);

-- ==========================================
-- REPORT TEMPLATES TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS report_builder_templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT,  -- NULL for system templates
  
  -- Template metadata
  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL,  -- 'ASSESSMENT' | 'INTERVIEW' | etc.
  report_type TEXT,  -- 'ASSESSMENT_DRD' | etc. (NULL for generic)
  
  -- Template configuration (JSON)
  sections_json TEXT NOT NULL,  -- Array of section definitions
  default_options_json TEXT,  -- Default options
  
  -- Flags
  is_system BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,
  
  -- Ownership
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_rb_templates_org ON report_builder_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_rb_templates_type ON report_builder_templates(source_type, report_type);

-- ==========================================
-- REPORT SESSIONS (Dynamic Menu)
-- ==========================================

CREATE TABLE IF NOT EXISTS report_builder_sessions (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  
  -- Session state
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Navigation state (JSON)
  navigation_state TEXT,
  
  UNIQUE(report_id, user_id),
  FOREIGN KEY (report_id) REFERENCES report_builder_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_rb_sessions_user ON report_builder_sessions(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_rb_sessions_opened ON report_builder_sessions(opened_at DESC);

-- ==========================================
-- REPORT ACTIVITY LOG
-- ==========================================

CREATE TABLE IF NOT EXISTS report_builder_activity (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  
  -- Activity details
  action_type TEXT NOT NULL,
  action_by TEXT NOT NULL,
  action_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Details (JSON)
  metadata TEXT,
  
  FOREIGN KEY (report_id) REFERENCES report_builder_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (action_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_rb_activity_report ON report_builder_activity(report_id);
CREATE INDEX IF NOT EXISTS idx_rb_activity_time ON report_builder_activity(action_at DESC);

-- ==========================================
-- INSERT DEFAULT TEMPLATES
-- ==========================================

INSERT INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type, 
  sections_json, default_options_json, is_system, is_default, created_at
) VALUES 
(
  'tpl-assessment-drd-standard',
  NULL,
  'Standard DRD Assessment Report',
  'Comprehensive digital maturity assessment report with all 7 axes analysis',
  'ASSESSMENT',
  'ASSESSMENT_DRD',
  '[
    {"key": "cover", "type": "cover", "title": "Cover Page", "required": true, "order": 0, "defaultLength": "short", "defaultLanguage": "business"},
    {"key": "executive_summary", "type": "summary", "title": "Executive Summary", "required": true, "order": 1, "defaultLength": "medium", "defaultLanguage": "business"},
    {"key": "methodology", "type": "methodology", "title": "Assessment Methodology", "required": true, "order": 2, "defaultLength": "short", "defaultLanguage": "technical"},
    {"key": "maturity_matrix", "type": "matrix", "title": "Maturity Matrix", "required": true, "order": 3, "defaultLength": "medium", "defaultLanguage": "business"},
    {"key": "axis_1", "type": "axis_analysis", "title": "Digital Processes", "required": true, "order": 10, "repeatFor": "axis", "repeatKey": "1", "defaultLength": "long", "defaultLanguage": "business"},
    {"key": "axis_2", "type": "axis_analysis", "title": "Digital Products", "required": true, "order": 11, "repeatFor": "axis", "repeatKey": "2", "defaultLength": "long", "defaultLanguage": "business"},
    {"key": "axis_3", "type": "axis_analysis", "title": "Digital Business Models", "required": true, "order": 12, "repeatFor": "axis", "repeatKey": "3", "defaultLength": "long", "defaultLanguage": "business"},
    {"key": "axis_4", "type": "axis_analysis", "title": "Data & Analytics", "required": true, "order": 13, "repeatFor": "axis", "repeatKey": "4", "defaultLength": "long", "defaultLanguage": "business"},
    {"key": "axis_5", "type": "axis_analysis", "title": "Organizational Culture", "required": true, "order": 14, "repeatFor": "axis", "repeatKey": "5", "defaultLength": "long", "defaultLanguage": "business"},
    {"key": "axis_6", "type": "axis_analysis", "title": "Cybersecurity", "required": true, "order": 15, "repeatFor": "axis", "repeatKey": "6", "defaultLength": "long", "defaultLanguage": "business"},
    {"key": "axis_7", "type": "axis_analysis", "title": "AI Maturity", "required": true, "order": 16, "repeatFor": "axis", "repeatKey": "7", "defaultLength": "long", "defaultLanguage": "business"},
    {"key": "strengths", "type": "list", "title": "Strengths", "required": true, "order": 100, "defaultLength": "medium", "defaultLanguage": "business"},
    {"key": "weaknesses", "type": "list", "title": "Areas for Improvement", "required": true, "order": 101, "defaultLength": "medium", "defaultLanguage": "business"},
    {"key": "recommendations", "type": "recommendations", "title": "Strategic Recommendations", "required": true, "order": 102, "defaultLength": "long", "defaultLanguage": "business"},
    {"key": "next_steps", "type": "action_plan", "title": "Next Steps", "required": true, "order": 103, "defaultLength": "medium", "defaultLanguage": "business"},
    {"key": "appendix", "type": "appendix", "title": "Appendix", "required": false, "order": 200, "defaultLength": "long", "defaultLanguage": "technical"}
  ]',
  '{"length": "medium", "language": "business"}',
  true,
  true,
  CURRENT_TIMESTAMP
),
(
  'tpl-assessment-siri-standard',
  NULL,
  'Standard SIRI Assessment Report',
  'Smart Industry Readiness Index assessment report',
  'ASSESSMENT',
  'ASSESSMENT_SIRI',
  '[
    {"key": "cover", "type": "cover", "title": "Cover Page", "required": true, "order": 0, "defaultLength": "short", "defaultLanguage": "business"},
    {"key": "executive_summary", "type": "summary", "title": "Executive Summary", "required": true, "order": 1, "defaultLength": "medium", "defaultLanguage": "business"},
    {"key": "methodology", "type": "methodology", "title": "SIRI Methodology", "required": true, "order": 2, "defaultLength": "short", "defaultLanguage": "technical"},
    {"key": "maturity_matrix", "type": "matrix", "title": "Readiness Matrix", "required": true, "order": 3, "defaultLength": "medium", "defaultLanguage": "business"},
    {"key": "strengths", "type": "list", "title": "Strengths", "required": true, "order": 100, "defaultLength": "medium", "defaultLanguage": "business"},
    {"key": "weaknesses", "type": "list", "title": "Areas for Improvement", "required": true, "order": 101, "defaultLength": "medium", "defaultLanguage": "business"},
    {"key": "recommendations", "type": "recommendations", "title": "Strategic Recommendations", "required": true, "order": 102, "defaultLength": "long", "defaultLanguage": "business"},
    {"key": "next_steps", "type": "action_plan", "title": "Next Steps", "required": true, "order": 103, "defaultLength": "medium", "defaultLanguage": "business"}
  ]',
  '{"length": "medium", "language": "business"}',
  true,
  false,
  CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;
