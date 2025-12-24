-- Assessment Module Database Migration
-- Run this to add assessment tables to your database

-- 1. RapidLean Assessments
CREATE TABLE IF NOT EXISTS rapid_lean_assessments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    assessment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Scoring (6 dimensions, 1-5 scale)
    value_stream_score REAL DEFAULT 0,
    waste_elimination_score REAL DEFAULT 0,
    flow_pull_score REAL DEFAULT 0,
    quality_source_score REAL DEFAULT 0,
    continuous_improvement_score REAL DEFAULT 0,
    visual_management_score REAL DEFAULT 0,
    
    -- Aggregated
    overall_score REAL DEFAULT 0,
    industry_benchmark REAL DEFAULT 0,
    
    -- AI Analysis
    ai_recommendations TEXT DEFAULT '[]',
    top_gaps TEXT DEFAULT '[]',
    
    -- Raw Data
    questionnaire_responses TEXT DEFAULT '{}',
    
    -- Metadata
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 2. ADKAR Assessments
CREATE TABLE IF NOT EXISTS adkar_assessments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    assessment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Scoring (5 dimensions, 1-5 scale)
    awareness_score REAL DEFAULT 0,
    desire_score REAL DEFAULT 0,
    knowledge_score REAL DEFAULT 0,
    ability_score REAL DEFAULT 0,
    reinforcement_score REAL DEFAULT 0,
    
    -- Aggregated
    overall_score REAL DEFAULT 0,
    
    -- AI Analysis
    ai_recommendations TEXT DEFAULT '[]',
    
    -- Raw Data
    questionnaire_responses TEXT DEFAULT '{}',
    
    -- Metadata
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 3. External Digital Assessments (SIRI/ADMA/CMMI)
CREATE TABLE IF NOT EXISTS external_digital_assessments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    
    -- Framework Info
    framework_type TEXT NOT NULL CHECK(framework_type IN ('SIRI', 'ADMA', 'CMMI', 'DIGITAL_OTHER')),
    framework_version TEXT,
    assessment_date DATETIME,
    
    -- Scores
    raw_scores_json TEXT NOT NULL DEFAULT '{}',
    normalized_scores_json TEXT DEFAULT '{}',
    mapping_confidence REAL DEFAULT 0,
    
    -- Mapping to DRD
    drd_axis_mapping TEXT DEFAULT '{}',
    inconsistencies TEXT DEFAULT '[]',
    
    -- File Info
    file_path TEXT,
    file_name TEXT,
    file_size INTEGER,
    upload_method TEXT DEFAULT 'MANUAL' CHECK(upload_method IN ('PDF_PARSE', 'MANUAL', 'API')),
    
    -- Metadata
    uploaded_by TEXT NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processing_status TEXT DEFAULT 'uploaded' CHECK(processing_status IN ('uploaded', 'processing', 'mapped', 'error')),
    processing_error TEXT,
    
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 4. Generic Assessment Reports
CREATE TABLE IF NOT EXISTS generic_assessment_reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    
    -- Report Info
    title TEXT,
    report_type TEXT CHECK(report_type IN ('ISO_AUDIT', 'CONSULTING', 'COMPLIANCE', 'LEAN', 'OTHER')),
    consultant_name TEXT,
    report_date DATE,
    
    -- Content
    ai_summary TEXT,
    tags_json TEXT DEFAULT '[]',
    
    -- File Info
    file_path TEXT,
    file_name TEXT,
    file_size INTEGER,
    
    -- Metadata
    uploaded_by TEXT NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 5. Assessment Correlations (Gap tracking)
CREATE TABLE IF NOT EXISTS assessment_correlations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    
    -- Sources
    assessment1_id TEXT NOT NULL,
    assessment1_type TEXT NOT NULL,
    assessment2_id TEXT,
    assessment2_type TEXT,
    
    -- Analysis
    gap_theme TEXT,
    gap_score REAL DEFAULT 0,
    priority_score INTEGER DEFAULT 0,
    gap_description TEXT,
    ai_recommendation TEXT,
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 6. Assessment Snapshots (Temporal tracking)
CREATE TABLE IF NOT EXISTS assessment_snapshots (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    assessment_type TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    
    -- Snapshot Data
    snapshot_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    scores_json TEXT NOT NULL,
    metadata_json TEXT DEFAULT '{}',
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- 7. Audit Logs Table (if not exists)
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details TEXT DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rapidlean_org ON rapid_lean_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_rapidlean_project ON rapid_lean_assessments(project_id);
CREATE INDEX IF NOT EXISTS idx_adkar_org ON adkar_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_external_org ON external_digital_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_generic_org ON generic_assessment_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_correlations_org ON assessment_correlations(organization_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_assessment ON assessment_snapshots(assessment_id);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
