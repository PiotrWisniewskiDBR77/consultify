-- Digitization Analyses Tables for Economics Module
-- Migration: 060_digitization_analyses.sql
-- Purpose: Stores digital maturity assessments based on 6-axis evaluation framework

-- ============================================
-- Main Analyses Table
-- Stores metadata for each digitization assessment
-- ============================================
CREATE TABLE IF NOT EXISTS digitization_analyses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
    
    -- Relationships
    project_id TEXT,
    organization_id INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    
    -- Calculated Scores
    overall_score REAL,
    completion_percent INTEGER DEFAULT 0,
    
    -- JSON field for aggregated axis scores (for quick access)
    axis_scores TEXT, -- JSON: { axisId: { currentScore: number, targetScore: number, completedAreas: number, totalAreas: number } }
    
    -- Import metadata
    imported_from TEXT, -- Original Excel filename if imported
    import_date DATETIME,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_digitization_analyses_org ON digitization_analyses(organization_id);
CREATE INDEX IF NOT EXISTS idx_digitization_analyses_status ON digitization_analyses(status);
CREATE INDEX IF NOT EXISTS idx_digitization_analyses_project ON digitization_analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_digitization_analyses_created ON digitization_analyses(created_at);

-- ============================================
-- Axis Scores Table
-- Stores individual scores for each evaluation area
-- ============================================
CREATE TABLE IF NOT EXISTS digitization_axis_scores (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL,
    
    -- Axis and Area Identification
    axis_id TEXT NOT NULL, -- e.g., 'digital_processes', 'digital_products', etc.
    area_id TEXT NOT NULL, -- e.g., '1.1', '1.2', etc.
    area_code TEXT, -- e.g., '1.1'
    
    -- Score Data
    current_level INTEGER CHECK (current_level >= 0 AND current_level <= 7),
    target_level INTEGER CHECK (target_level >= 0 AND target_level <= 7),
    
    -- Additional Assessment Data
    notes TEXT,
    evidence TEXT, -- JSON array of evidence strings
    justification TEXT, -- Why this score was chosen
    
    -- Metadata
    assessed_by TEXT,
    assessed_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (analysis_id) REFERENCES digitization_analyses(id) ON DELETE CASCADE,
    UNIQUE(analysis_id, axis_id, area_id)
);

CREATE INDEX IF NOT EXISTS idx_axis_scores_analysis ON digitization_axis_scores(analysis_id);
CREATE INDEX IF NOT EXISTS idx_axis_scores_axis ON digitization_axis_scores(axis_id);
CREATE INDEX IF NOT EXISTS idx_axis_scores_area ON digitization_axis_scores(area_id);

-- ============================================
-- Analysis Comparisons Table
-- Stores saved comparison configurations
-- ============================================
CREATE TABLE IF NOT EXISTS digitization_comparisons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    organization_id INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    
    -- JSON array of analysis IDs being compared
    analysis_ids TEXT NOT NULL, -- JSON: ["id1", "id2", ...]
    
    -- Comparison type
    comparison_type TEXT DEFAULT 'side_by_side' CHECK (comparison_type IN ('side_by_side', 'timeline', 'benchmark')),
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_comparisons_org ON digitization_comparisons(organization_id);

-- ============================================
-- Analysis Export History
-- Tracks exports for audit purposes
-- ============================================
CREATE TABLE IF NOT EXISTS digitization_exports (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL,
    
    -- Export Details
    export_type TEXT NOT NULL CHECK (export_type IN ('excel', 'pdf', 'json')),
    export_filename TEXT,
    export_path TEXT,
    
    -- Metadata
    exported_by TEXT NOT NULL,
    exported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (analysis_id) REFERENCES digitization_analyses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exports_analysis ON digitization_exports(analysis_id);











