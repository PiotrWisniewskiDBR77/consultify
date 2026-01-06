-- Digitization Versioning and Evidence Tables
-- Migration: 061_digitization_versioning.sql
-- Purpose: Adds version history and evidence management for digital maturity assessments

-- ============================================
-- Analysis Versions (Snapshots/Baselines)
-- Enables tracking of assessment changes over time
-- ============================================
CREATE TABLE IF NOT EXISTS digitization_analysis_versions (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    version_name TEXT,
    version_type TEXT CHECK (version_type IN ('snapshot', 'baseline', 'milestone')) DEFAULT 'snapshot',
    
    -- Complete snapshot of analysis state
    snapshot_data TEXT NOT NULL, -- Full JSON snapshot including all scores
    
    -- Metadata
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    
    -- Summary metrics at time of snapshot
    overall_score REAL,
    completion_percent INTEGER,
    
    FOREIGN KEY (analysis_id) REFERENCES digitization_analyses(id) ON DELETE CASCADE,
    UNIQUE(analysis_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_versions_analysis ON digitization_analysis_versions(analysis_id);
CREATE INDEX IF NOT EXISTS idx_versions_type ON digitization_analysis_versions(version_type);
CREATE INDEX IF NOT EXISTS idx_versions_created ON digitization_analysis_versions(created_at);

-- ============================================
-- Evidence Attachments
-- Stores evidence and justification for scores
-- ============================================
CREATE TABLE IF NOT EXISTS digitization_evidence (
    id TEXT PRIMARY KEY,
    score_id TEXT NOT NULL,
    
    -- Evidence classification
    evidence_type TEXT CHECK (evidence_type IN ('document', 'link', 'screenshot', 'note')) DEFAULT 'note',
    title TEXT NOT NULL,
    
    -- Content storage
    content TEXT, -- URL, note text, or description
    file_path TEXT, -- For uploaded files (relative path)
    file_size INTEGER, -- File size in bytes
    mime_type TEXT, -- MIME type for files
    
    -- Metadata
    uploaded_by TEXT NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Optional categorization
    category TEXT, -- e.g., 'policy', 'screenshot', 'interview', 'audit'
    is_verified BOOLEAN DEFAULT 0,
    verified_by TEXT,
    verified_at DATETIME,
    
    FOREIGN KEY (score_id) REFERENCES digitization_axis_scores(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evidence_score ON digitization_evidence(score_id);
CREATE INDEX IF NOT EXISTS idx_evidence_type ON digitization_evidence(evidence_type);
CREATE INDEX IF NOT EXISTS idx_evidence_uploaded ON digitization_evidence(uploaded_at);

-- ============================================
-- Assessment Comments/Discussion
-- Enables collaborative review workflow
-- ============================================
CREATE TABLE IF NOT EXISTS digitization_comments (
    id TEXT PRIMARY KEY,
    
    -- Can be attached to analysis, score, or version
    analysis_id TEXT,
    score_id TEXT,
    version_id TEXT,
    
    -- Comment content
    comment_text TEXT NOT NULL,
    parent_comment_id TEXT, -- For threaded replies
    
    -- Metadata
    author_id TEXT NOT NULL,
    author_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_resolved BOOLEAN DEFAULT 0,
    resolved_by TEXT,
    resolved_at DATETIME,
    
    -- Comment type for workflow
    comment_type TEXT CHECK (comment_type IN ('general', 'question', 'suggestion', 'concern', 'approval')) DEFAULT 'general',
    
    FOREIGN KEY (analysis_id) REFERENCES digitization_analyses(id) ON DELETE CASCADE,
    FOREIGN KEY (score_id) REFERENCES digitization_axis_scores(id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES digitization_analysis_versions(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES digitization_comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comments_analysis ON digitization_comments(analysis_id);
CREATE INDEX IF NOT EXISTS idx_comments_score ON digitization_comments(score_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON digitization_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_resolved ON digitization_comments(is_resolved);

-- ============================================
-- Assessment Workflow States
-- Tracks approval workflow for enterprise governance
-- ============================================
CREATE TABLE IF NOT EXISTS digitization_workflow_states (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL,
    
    -- Workflow state
    workflow_status TEXT CHECK (workflow_status IN (
        'draft',
        'pending_review',
        'in_review',
        'changes_requested',
        'approved',
        'published'
    )) DEFAULT 'draft',
    
    -- Reviewers
    reviewer_id TEXT,
    reviewer_name TEXT,
    
    -- Timeline
    submitted_at DATETIME,
    review_started_at DATETIME,
    completed_at DATETIME,
    
    -- Comments/Notes
    review_notes TEXT,
    
    -- Version reference
    version_id TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (analysis_id) REFERENCES digitization_analyses(id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES digitization_analysis_versions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_analysis ON digitization_workflow_states(analysis_id);
CREATE INDEX IF NOT EXISTS idx_workflow_status ON digitization_workflow_states(workflow_status);
CREATE INDEX IF NOT EXISTS idx_workflow_reviewer ON digitization_workflow_states(reviewer_id);

-- ============================================
-- AI Recommendations Log
-- Stores AI-generated recommendations for analyses
-- ============================================
CREATE TABLE IF NOT EXISTS digitization_ai_recommendations (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL,
    
    -- Recommendation details
    axis_id TEXT,
    area_id TEXT,
    recommendation_type TEXT CHECK (recommendation_type IN (
        'initiative',
        'quick_win',
        'strategic',
        'training',
        'process_change',
        'technology'
    )),
    
    title TEXT NOT NULL,
    description TEXT,
    rationale TEXT, -- Why this recommendation
    
    -- Impact estimation
    estimated_effort TEXT CHECK (estimated_effort IN ('low', 'medium', 'high')),
    estimated_impact TEXT CHECK (estimated_impact IN ('low', 'medium', 'high')),
    priority_score INTEGER, -- 1-100
    
    -- Status tracking
    status TEXT CHECK (status IN ('suggested', 'accepted', 'rejected', 'implemented')) DEFAULT 'suggested',
    accepted_by TEXT,
    accepted_at DATETIME,
    
    -- Linked initiative (if created)
    initiative_id TEXT,
    
    -- AI metadata
    ai_model TEXT,
    ai_confidence REAL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (analysis_id) REFERENCES digitization_analyses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recommendations_analysis ON digitization_ai_recommendations(analysis_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON digitization_ai_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON digitization_ai_recommendations(priority_score DESC);

-- ============================================
-- Update existing tables with new columns
-- ============================================

-- Add workflow_status to analyses
-- Note: SQLite doesn't support ALTER TABLE ADD COLUMN with constraints,
-- so we check if column exists first

-- This is handled in the application layer for SQLite compatibility


















