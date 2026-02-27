-- Migration: 507_imported_reports.sql
-- Description: Table for storing imported external assessment reports (DRD, SIRI, ADMA)
-- Date: 2026-02-04

-- ============================================
-- IMPORTED REPORTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS imported_reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    
    -- Source file information
    source_file_name TEXT NOT NULL,
    source_file_path TEXT,
    source_file_size INTEGER,
    source_format TEXT NOT NULL, -- pdf, xlsx, docx, json, csv
    
    -- Detection results
    detected_framework TEXT NOT NULL, -- DRD, SIRI, ADMA
    detection_confidence REAL DEFAULT 0, -- 0-100
    
    -- Extracted data
    extracted_data_json TEXT DEFAULT '{}', -- Raw extraction from AI
    mapped_data_json TEXT DEFAULT '{}', -- Mapped to target structure
    extraction_details_json TEXT DEFAULT '{}', -- Fields found, missing, warnings
    
    -- Metadata extracted from document
    document_metadata_json TEXT DEFAULT '{}', -- assessmentDate, organizationName, assessorName
    
    -- Target entity
    target_type TEXT, -- 'assessment' or 'report'
    target_id TEXT, -- FK to assessments or report_builder_reports
    
    -- Processing status
    status TEXT DEFAULT 'pending', -- pending, detecting, extracting, ready_for_review, processed, failed
    processing_error TEXT,
    processing_log TEXT,
    
    -- Audit fields
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_imported_reports_org ON imported_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_imported_reports_status ON imported_reports(status);
CREATE INDEX IF NOT EXISTS idx_imported_reports_framework ON imported_reports(detected_framework);
CREATE INDEX IF NOT EXISTS idx_imported_reports_target ON imported_reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_imported_reports_created ON imported_reports(created_at DESC);

-- ============================================
-- REPORT BUILDER VERSIONS TABLE (for version history)
-- ============================================

CREATE TABLE IF NOT EXISTS report_builder_versions (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    
    -- Snapshot of the report at this version
    snapshot_json TEXT NOT NULL,
    
    -- Change information
    change_summary TEXT,
    change_type TEXT, -- 'auto' (status change), 'manual' (user created), 'rollback'
    previous_status TEXT,
    new_status TEXT,
    
    -- Audit fields
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (report_id) REFERENCES report_builder_reports(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_report_versions_report ON report_builder_versions(report_id);
CREATE INDEX IF NOT EXISTS idx_report_versions_number ON report_builder_versions(report_id, version_number DESC);

-- ============================================
-- REPORT SCHEDULES TABLE (for cyclic reports)
-- ============================================

CREATE TABLE IF NOT EXISTS report_schedules (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Template to use
    report_template_id TEXT,
    
    -- Source assessment (optional - for assessment-based reports)
    source_assessment_id TEXT,
    
    -- Schedule configuration
    schedule_name TEXT NOT NULL,
    cron_expression TEXT NOT NULL, -- e.g., '0 9 * * 1' for every Monday at 9am
    timezone TEXT DEFAULT 'UTC',
    
    -- Execution tracking
    next_run_at TIMESTAMP,
    last_run_at TIMESTAMP,
    last_run_status TEXT, -- 'success', 'failed'
    last_run_report_id TEXT,
    run_count INTEGER DEFAULT 0,
    
    -- Configuration
    is_active BOOLEAN DEFAULT true,
    config_json TEXT DEFAULT '{}', -- Additional configuration
    
    -- Audit fields
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_report_schedules_org ON report_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_active ON report_schedules(is_active, next_run_at);

-- ============================================
-- TRIGGER: Update updated_at on imported_reports
-- ============================================

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_imported_reports_timestamp ON imported_reports;
CREATE TRIGGER update_imported_reports_timestamp
BEFORE UPDATE ON imported_reports
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS update_report_schedules_timestamp ON report_schedules;
CREATE TRIGGER update_report_schedules_timestamp
BEFORE UPDATE ON report_schedules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

-- ============================================
-- SCHEDULE EXECUTIONS TABLE (for execution history)
-- ============================================

CREATE TABLE IF NOT EXISTS schedule_executions (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL,
    status TEXT NOT NULL, -- 'pending', 'running', 'success', 'failed'
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    generated_report_id TEXT,
    error TEXT,
    delivery_results_json TEXT DEFAULT '[]',
    
    FOREIGN KEY (schedule_id) REFERENCES report_schedules(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_schedule_executions_schedule ON schedule_executions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_executions_started ON schedule_executions(started_at DESC);

-- ============================================
-- REPORT INITIATIVES LINK TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS report_initiatives (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    initiative_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(report_id, initiative_id)
);

CREATE INDEX IF NOT EXISTS idx_report_initiatives_report ON report_initiatives(report_id);
CREATE INDEX IF NOT EXISTS idx_report_initiatives_initiative ON report_initiatives(initiative_id);
