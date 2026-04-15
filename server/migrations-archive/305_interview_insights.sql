-- INTERVIEW-INSIGHTS-001: AI-generated insights from interview sessions
-- Migration: 305_interview_insights.sql
-- Purpose:
--  - Create interview_insights table for AI-generated summaries
--  - Store analysis results from completed interview sessions

-- ==========================================
-- INTERVIEW INSIGHTS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS interview_insights (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    title TEXT NOT NULL,
    prompt_type TEXT NOT NULL DEFAULT 'summary',  -- 'summary', 'trends', 'problems', 'recommendations'
    source_session_ids TEXT,                       -- JSON array of session IDs analyzed
    filters TEXT,                                  -- JSON filters used (templateId, dateFrom, dateTo, respondentId)
    content TEXT,                                  -- AI-generated content (markdown)
    status TEXT DEFAULT 'generating',              -- 'generating', 'completed', 'failed'
    error_message TEXT,                            -- Error message if generation failed
    source_session_count INTEGER DEFAULT 0,        -- Number of sessions analyzed
    tokens_used INTEGER DEFAULT 0,                 -- AI tokens consumed
    generation_time_ms INTEGER,                    -- Time taken to generate
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_interview_insights_org 
    ON interview_insights(organization_id);
CREATE INDEX IF NOT EXISTS idx_interview_insights_status 
    ON interview_insights(status);
CREATE INDEX IF NOT EXISTS idx_interview_insights_created_by 
    ON interview_insights(created_by);
CREATE INDEX IF NOT EXISTS idx_interview_insights_prompt_type 
    ON interview_insights(prompt_type);
CREATE INDEX IF NOT EXISTS idx_interview_insights_created_at 
    ON interview_insights(created_at DESC);

-- ==========================================
-- PERMISSIONS FOR INSIGHTS
-- ==========================================

-- Note: PostgreSQL permissions table may not have 'name' and 'icon' columns
INSERT OR IGNORE INTO permissions (key, description, category) VALUES
    ('INTERVIEW_INSIGHTS_VIEW', 'View AI-generated interview insights', 'INTERVIEW'),
    ('INTERVIEW_INSIGHTS_CREATE', 'Generate new AI insights from interviews', 'INTERVIEW');

INSERT OR IGNORE INTO role_permissions (id, role, permission_key, description) VALUES
    ('rp_interview_insights_view_member', 'MEMBER', 'INTERVIEW_INSIGHTS_VIEW', 'View interview insights'),
    ('rp_interview_insights_view_pm', 'PROJECT_MANAGER', 'INTERVIEW_INSIGHTS_VIEW', 'View interview insights'),
    ('rp_interview_insights_create_pm', 'PROJECT_MANAGER', 'INTERVIEW_INSIGHTS_CREATE', 'Create interview insights'),
    ('rp_interview_insights_view_admin', 'ADMIN', 'INTERVIEW_INSIGHTS_VIEW', 'View interview insights'),
    ('rp_interview_insights_create_admin', 'ADMIN', 'INTERVIEW_INSIGHTS_CREATE', 'Create interview insights'),
    ('rp_interview_insights_view_super', 'SUPERADMIN', 'INTERVIEW_INSIGHTS_VIEW', 'View interview insights'),
    ('rp_interview_insights_create_super', 'SUPERADMIN', 'INTERVIEW_INSIGHTS_CREATE', 'Create interview insights');
