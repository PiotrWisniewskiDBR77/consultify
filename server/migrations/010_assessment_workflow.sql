-- Assessment Workflow Tables for Enterprise Features
-- Migration: 010_assessment_workflow.sql

-- ============================================
-- Assessment Workflows
-- Manages the review and approval process
-- ============================================
CREATE TABLE IF NOT EXISTS assessment_workflows (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    project_id INTEGER,
    organization_id INTEGER NOT NULL,
    
    -- Workflow State
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_REVIEW', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED')),
    current_version INTEGER DEFAULT 1,
    
    -- Submission
    submitted_by TEXT,
    submitted_at DATETIME,
    
    -- Approval
    approved_by TEXT,
    approved_at DATETIME,
    approval_notes TEXT,
    
    -- Rejection
    rejected_by TEXT,
    rejected_at DATETIME,
    rejection_reason TEXT,
    axis_issues TEXT, -- JSON: { axisId: "issue description" }
    
    -- Metadata
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_workflows_assessment ON assessment_workflows(assessment_id);
CREATE INDEX IF NOT EXISTS idx_workflows_org ON assessment_workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON assessment_workflows(status);

-- ============================================
-- Assessment Reviews
-- Stakeholder review records
-- ============================================
CREATE TABLE IF NOT EXISTS assessment_reviews (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    
    -- Reviewer Info
    reviewer_id TEXT NOT NULL,
    reviewer_role TEXT, -- e.g., 'CTO', 'Finance Director', 'Operations Lead'
    
    -- Review Status
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
    
    -- Review Content
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comments TEXT,
    axis_comments TEXT, -- JSON: { axisId: { score: number, comment: string } }
    recommendation TEXT CHECK (recommendation IN ('APPROVE', 'APPROVE_WITH_CHANGES', 'REQUEST_CHANGES', 'REJECT')),
    
    -- Timeline
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME,
    started_at DATETIME,
    completed_at DATETIME,
    
    FOREIGN KEY (workflow_id) REFERENCES assessment_workflows(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reviews_workflow ON assessment_reviews(workflow_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON assessment_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON assessment_reviews(status);

-- ============================================
-- Assessment Axis Comments
-- Discussion threads on specific axes
-- ============================================
CREATE TABLE IF NOT EXISTS assessment_axis_comments (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    axis_id TEXT NOT NULL, -- processes, digitalProducts, etc.
    
    -- Comment Content
    user_id TEXT NOT NULL,
    comment TEXT NOT NULL,
    parent_comment_id TEXT, -- For threaded replies
    
    -- Metadata
    is_resolved BOOLEAN DEFAULT 0,
    resolved_by TEXT,
    resolved_at DATETIME,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (parent_comment_id) REFERENCES assessment_axis_comments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_axis_comments_assessment ON assessment_axis_comments(assessment_id);
CREATE INDEX IF NOT EXISTS idx_axis_comments_axis ON assessment_axis_comments(assessment_id, axis_id);
CREATE INDEX IF NOT EXISTS idx_axis_comments_parent ON assessment_axis_comments(parent_comment_id);

-- ============================================
-- Assessment Versions
-- Historical snapshots for versioning
-- ============================================
CREATE TABLE IF NOT EXISTS assessment_versions (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    
    -- Snapshot Data
    assessment_data TEXT NOT NULL, -- JSON: Complete axis scores and analysis
    
    -- Change Info
    change_summary TEXT,
    changed_axes TEXT, -- JSON: List of axes that changed from previous version
    
    -- Metadata
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(assessment_id, version)
);

CREATE INDEX IF NOT EXISTS idx_versions_assessment ON assessment_versions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_versions_version ON assessment_versions(assessment_id, version);

-- ============================================
-- Assessment Benchmarks
-- Industry and peer group comparisons
-- ============================================
CREATE TABLE IF NOT EXISTS assessment_benchmarks (
    id TEXT PRIMARY KEY,
    
    -- Benchmark Scope
    industry TEXT NOT NULL,
    company_size TEXT, -- 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'
    region TEXT,
    
    -- Axis Benchmarks (averages)
    axis_id TEXT NOT NULL,
    percentile_25 REAL,
    percentile_50 REAL, -- Median
    percentile_75 REAL,
    percentile_90 REAL,
    
    -- Sample Info
    sample_size INTEGER,
    last_updated DATETIME,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_benchmarks_industry ON assessment_benchmarks(industry);
CREATE INDEX IF NOT EXISTS idx_benchmarks_axis ON assessment_benchmarks(axis_id);

-- ============================================
-- Add columns to existing maturity_assessments table
-- ============================================
-- Note: Run these only if columns don't exist
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE

-- Check and add is_approved column
SELECT CASE 
    WHEN (SELECT COUNT(*) FROM pragma_table_info('maturity_assessments') WHERE name = 'is_approved') = 0 
    THEN 'ALTER TABLE maturity_assessments ADD COLUMN is_approved BOOLEAN DEFAULT 0' 
END;

-- For SQLite, we use a workaround with INSERT OR IGNORE
-- These columns should be added manually if needed

-- ============================================
-- Seed Initial Benchmark Data (Manufacturing Industry)
-- ============================================
INSERT OR IGNORE INTO assessment_benchmarks (id, industry, company_size, axis_id, percentile_25, percentile_50, percentile_75, percentile_90, sample_size, last_updated)
VALUES 
    ('bench_mfg_proc', 'MANUFACTURING', NULL, 'processes', 2.5, 3.5, 4.5, 5.5, 150, datetime('now')),
    ('bench_mfg_prod', 'MANUFACTURING', NULL, 'digitalProducts', 2.0, 3.0, 4.0, 5.0, 150, datetime('now')),
    ('bench_mfg_bmod', 'MANUFACTURING', NULL, 'businessModels', 2.0, 3.0, 3.8, 4.5, 150, datetime('now')),
    ('bench_mfg_data', 'MANUFACTURING', NULL, 'dataManagement', 2.5, 3.5, 4.5, 5.5, 150, datetime('now')),
    ('bench_mfg_cult', 'MANUFACTURING', NULL, 'culture', 2.0, 3.0, 4.0, 5.0, 150, datetime('now')),
    ('bench_mfg_cyber', 'MANUFACTURING', NULL, 'cybersecurity', 3.0, 4.0, 5.0, 6.0, 150, datetime('now')),
    ('bench_mfg_ai', 'MANUFACTURING', NULL, 'aiMaturity', 1.5, 2.5, 3.5, 4.5, 150, datetime('now'));

-- Technology Industry Benchmarks
INSERT OR IGNORE INTO assessment_benchmarks (id, industry, company_size, axis_id, percentile_25, percentile_50, percentile_75, percentile_90, sample_size, last_updated)
VALUES 
    ('bench_tech_proc', 'TECHNOLOGY', NULL, 'processes', 3.5, 4.5, 5.5, 6.5, 200, datetime('now')),
    ('bench_tech_prod', 'TECHNOLOGY', NULL, 'digitalProducts', 4.0, 5.0, 6.0, 6.8, 200, datetime('now')),
    ('bench_tech_bmod', 'TECHNOLOGY', NULL, 'businessModels', 3.5, 4.5, 5.5, 6.5, 200, datetime('now')),
    ('bench_tech_data', 'TECHNOLOGY', NULL, 'dataManagement', 3.5, 4.5, 5.5, 6.5, 200, datetime('now')),
    ('bench_tech_cult', 'TECHNOLOGY', NULL, 'culture', 3.0, 4.0, 5.0, 6.0, 200, datetime('now')),
    ('bench_tech_cyber', 'TECHNOLOGY', NULL, 'cybersecurity', 4.0, 5.0, 6.0, 6.8, 200, datetime('now')),
    ('bench_tech_ai', 'TECHNOLOGY', NULL, 'aiMaturity', 3.0, 4.0, 5.0, 6.0, 200, datetime('now'));

-- Financial Services Benchmarks
INSERT OR IGNORE INTO assessment_benchmarks (id, industry, company_size, axis_id, percentile_25, percentile_50, percentile_75, percentile_90, sample_size, last_updated)
VALUES 
    ('bench_fin_proc', 'FINANCIAL_SERVICES', NULL, 'processes', 3.0, 4.0, 5.0, 6.0, 180, datetime('now')),
    ('bench_fin_prod', 'FINANCIAL_SERVICES', NULL, 'digitalProducts', 3.5, 4.5, 5.5, 6.5, 180, datetime('now')),
    ('bench_fin_bmod', 'FINANCIAL_SERVICES', NULL, 'businessModels', 3.0, 4.0, 5.0, 6.0, 180, datetime('now')),
    ('bench_fin_data', 'FINANCIAL_SERVICES', NULL, 'dataManagement', 4.0, 5.0, 6.0, 6.8, 180, datetime('now')),
    ('bench_fin_cult', 'FINANCIAL_SERVICES', NULL, 'culture', 2.5, 3.5, 4.5, 5.5, 180, datetime('now')),
    ('bench_fin_cyber', 'FINANCIAL_SERVICES', NULL, 'cybersecurity', 5.0, 6.0, 6.5, 7.0, 180, datetime('now')),
    ('bench_fin_ai', 'FINANCIAL_SERVICES', NULL, 'aiMaturity', 2.5, 3.5, 4.5, 5.5, 180, datetime('now'));

