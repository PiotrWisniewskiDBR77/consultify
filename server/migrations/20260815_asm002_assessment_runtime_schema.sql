-- ASM-002: ordered migration authority for the DRD Assessment runtime.
-- Runtime application roles must not require CREATE or ALTER privileges.

CREATE TABLE IF NOT EXISTS assessment_definitions (
  id TEXT PRIMARY KEY,
  methodology_id TEXT NOT NULL,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  is_read_only INTEGER NOT NULL DEFAULT 0,
  definition_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_definitions_methodology_version
  ON assessment_definitions(methodology_id, version);
CREATE INDEX IF NOT EXISTS idx_assessment_definitions_status
  ON assessment_definitions(status, methodology_id);

ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'DRAFT';
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS builder_report_id TEXT;
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS axis_data TEXT;
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS executive_summary TEXT;
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS detailed_analysis TEXT;
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS recommendations TEXT;
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS generated_by TEXT;
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS generation_params TEXT;
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS rejected_by TEXT;
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS utilized_by TEXT;
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS utilized_at TIMESTAMP;
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS utilization_notes TEXT;

CREATE TABLE IF NOT EXISTS assessment_report_sections (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  section_type TEXT NOT NULL,
  axis_id TEXT,
  area_id TEXT,
  title TEXT NOT NULL,
  content TEXT,
  data_snapshot TEXT,
  order_index INTEGER DEFAULT 0,
  is_ai_generated INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE assessment_report_sections ADD COLUMN IF NOT EXISTS section_type TEXT;
ALTER TABLE assessment_report_sections ADD COLUMN IF NOT EXISTS axis_id TEXT;
ALTER TABLE assessment_report_sections ADD COLUMN IF NOT EXISTS area_id TEXT;
ALTER TABLE assessment_report_sections ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE assessment_report_sections ADD COLUMN IF NOT EXISTS data_snapshot TEXT;
ALTER TABLE assessment_report_sections ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
ALTER TABLE assessment_report_sections ADD COLUMN IF NOT EXISTS is_ai_generated INTEGER DEFAULT 0;
ALTER TABLE assessment_report_sections ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE assessment_report_sections ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE assessment_report_sections ADD COLUMN IF NOT EXISTS updated_by TEXT;

CREATE INDEX IF NOT EXISTS idx_ars_report ON assessment_report_sections(report_id);
CREATE INDEX IF NOT EXISTS idx_ars_report_order
  ON assessment_report_sections(report_id, order_index);

CREATE TABLE IF NOT EXISTS assessment_report_section_history (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  title TEXT,
  content TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_arsh_section
  ON assessment_report_section_history(report_id, section_id, version);
