-- Migration 041: Report Sections for DRD Audit Report Builder
-- Creates the report_sections table for storing editable report content

-- Report sections table
CREATE TABLE IF NOT EXISTS report_sections (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    section_type TEXT NOT NULL CHECK(section_type IN (
        'cover_page',
        'executive_summary', 
        'methodology',
        'maturity_overview',
        'axis_detail',
        'area_detail',
        'gap_analysis',
        'initiatives',
        'roadmap',
        'appendix',
        'custom'
    )),
    axis_id TEXT,                    -- For axis_detail sections (e.g., 'processes', 'digitalProducts')
    area_id TEXT,                    -- For area_detail sections (e.g., '1A', '2B')
    title TEXT NOT NULL,
    content TEXT,                    -- Rich text content (HTML/Markdown)
    data_snapshot TEXT,              -- JSON with table data at generation time
    order_index INTEGER DEFAULT 0,
    is_ai_generated INTEGER DEFAULT 0,
    ai_model_used TEXT,              -- Track which AI model generated content
    last_edited_by TEXT,
    version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(report_id) REFERENCES assessment_reports(id) ON DELETE CASCADE,
    FOREIGN KEY(last_edited_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for report_sections
CREATE INDEX IF NOT EXISTS idx_report_sections_report_id ON report_sections(report_id);
CREATE INDEX IF NOT EXISTS idx_report_sections_type ON report_sections(report_id, section_type);
CREATE INDEX IF NOT EXISTS idx_report_sections_order ON report_sections(report_id, order_index);
CREATE INDEX IF NOT EXISTS idx_report_sections_axis ON report_sections(report_id, axis_id);

-- Section version history for tracking changes
CREATE TABLE IF NOT EXISTS report_section_history (
    id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    content TEXT,
    data_snapshot TEXT,
    edited_by TEXT,
    edit_source TEXT CHECK(edit_source IN ('manual', 'ai_chat', 'ai_action', 'import')),
    ai_prompt TEXT,                  -- If AI-edited, store the prompt used
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(section_id) REFERENCES report_sections(id) ON DELETE CASCADE,
    FOREIGN KEY(edited_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Index for version history
CREATE INDEX IF NOT EXISTS idx_section_history_section ON report_section_history(section_id, version);

-- Add columns to assessment_reports if not exists
-- Check for template_id column
SELECT CASE 
    WHEN COUNT(*) = 0 THEN 'ALTER TABLE assessment_reports ADD COLUMN template_id TEXT;'
    ELSE 'SELECT 1;'
END FROM pragma_table_info('assessment_reports') WHERE name = 'template_id';

-- Report templates for reusable report structures
CREATE TABLE IF NOT EXISTS report_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    organization_id TEXT,            -- NULL for system templates
    section_config TEXT NOT NULL,    -- JSON array of section types and order
    is_default INTEGER DEFAULT 0,
    is_system INTEGER DEFAULT 0,     -- System templates can't be deleted
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Insert default DRD report template
INSERT OR IGNORE INTO report_templates (id, name, description, section_config, is_default, is_system, created_at)
VALUES (
    'default-drd-report',
    'Standard DRD Assessment Report',
    'Complete Digital Readiness Diagnosis report with all 7 axes and gap analysis',
    '[
        {"type": "cover_page", "title": "Cover Page"},
        {"type": "executive_summary", "title": "Executive Summary"},
        {"type": "methodology", "title": "DRD Methodology"},
        {"type": "maturity_overview", "title": "Maturity Overview"},
        {"type": "axis_detail", "axisId": "processes", "title": "Axis 1: Digital Processes"},
        {"type": "axis_detail", "axisId": "digitalProducts", "title": "Axis 2: Digital Products"},
        {"type": "axis_detail", "axisId": "businessModels", "title": "Axis 3: Digital Business Models"},
        {"type": "axis_detail", "axisId": "dataManagement", "title": "Axis 4: Data Management"},
        {"type": "axis_detail", "axisId": "culture", "title": "Axis 5: Culture of Transformation"},
        {"type": "axis_detail", "axisId": "cybersecurity", "title": "Axis 6: Cybersecurity"},
        {"type": "axis_detail", "axisId": "aiMaturity", "title": "Axis 7: AI Maturity"},
        {"type": "gap_analysis", "title": "Gap Analysis"},
        {"type": "initiatives", "title": "Recommended Initiatives"},
        {"type": "roadmap", "title": "Transformation Roadmap"},
        {"type": "appendix", "title": "Appendix"}
    ]',
    1,
    1,
    CURRENT_TIMESTAMP
);

-- Insert executive summary template
INSERT OR IGNORE INTO report_templates (id, name, description, section_config, is_default, is_system, created_at)
VALUES (
    'executive-summary-only',
    'Executive Summary Report',
    'Concise report with key findings for board-level presentation',
    '[
        {"type": "cover_page", "title": "Cover Page"},
        {"type": "executive_summary", "title": "Executive Summary"},
        {"type": "maturity_overview", "title": "Maturity Overview"},
        {"type": "gap_analysis", "title": "Key Gaps"},
        {"type": "initiatives", "title": "Priority Initiatives"}
    ]',
    0,
    1,
    CURRENT_TIMESTAMP
);

