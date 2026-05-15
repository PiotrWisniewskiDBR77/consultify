-- RapidLean Observations Migration
-- Adds support for production floor observations (Gemba Walk)
-- Run this migration after assessment-module.sql

-- 1. RapidLean Observations Table
CREATE TABLE IF NOT EXISTS rapid_lean_observations (
    id TEXT PRIMARY KEY,
    assessment_id TEXT,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    
    -- Template Info
    template_id TEXT NOT NULL,
    
    -- Observation Data
    location TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    answers TEXT DEFAULT '{}', -- JSON object with observation item answers
    photos TEXT DEFAULT '[]', -- JSON array of photo URLs/paths
    notes TEXT,
    
    -- Metadata
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(assessment_id) REFERENCES rapid_lean_assessments(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 2. RapidLean Reports Table
CREATE TABLE IF NOT EXISTS rapid_lean_reports (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    
    -- Report Info
    report_type TEXT DEFAULT 'detailed' CHECK(report_type IN ('executive', 'detailed', 'comparison')),
    format TEXT DEFAULT 'pdf' CHECK(format IN ('pdf', 'excel', 'powerpoint')),
    file_url TEXT,
    
    -- Report Data (JSON structure)
    report_data TEXT DEFAULT '{}',
    
    -- Metadata
    generated_by TEXT NOT NULL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(assessment_id) REFERENCES rapid_lean_assessments(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(generated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 3. Add new columns to rapid_lean_assessments table
ALTER TABLE rapid_lean_assessments ADD COLUMN drd_mapping TEXT DEFAULT '{}';
ALTER TABLE rapid_lean_assessments ADD COLUMN observation_count INTEGER DEFAULT 0;
ALTER TABLE rapid_lean_assessments ADD COLUMN report_generated INTEGER DEFAULT 0; -- Boolean: 0 = false, 1 = true

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_observations_assessment ON rapid_lean_observations(assessment_id);
CREATE INDEX IF NOT EXISTS idx_observations_org ON rapid_lean_observations(organization_id);
CREATE INDEX IF NOT EXISTS idx_observations_project ON rapid_lean_observations(project_id);
CREATE INDEX IF NOT EXISTS idx_observations_template ON rapid_lean_observations(template_id);
CREATE INDEX IF NOT EXISTS idx_reports_assessment ON rapid_lean_reports(assessment_id);
CREATE INDEX IF NOT EXISTS idx_reports_org ON rapid_lean_reports(organization_id);

