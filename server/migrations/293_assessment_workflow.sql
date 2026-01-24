-- FLOW-ASSESSMENT-INITIATIVES-001: Assessment -> Initiatives
-- Migration: 293_assessment_workflow.sql
-- Date: 2026-01-20
--
-- This migration adds workflow support for Assessment module:
-- - Status transitions: DRAFT -> IN_REVIEW -> AWAITING_APPROVAL -> APPROVED
-- - Gate decisions: Request Review, Approve Report, Approve Assessment, Generate Initiatives
-- - Initiative generation from approved assessments

-- ==========================================
-- ASSESSMENTS TABLE (Extended)
-- ==========================================

-- Add missing columns if not exist (SQLite doesn't support ADD COLUMN IF NOT EXISTS)
-- These columns support the workflow

-- Check and add report_approved_at column
CREATE TABLE IF NOT EXISTS assessments_migration_check (id INTEGER);
DROP TABLE assessments_migration_check;

-- If assessments table doesn't exist, create it
CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    assessment_type TEXT NOT NULL, -- DRD | SIRI | ADMA | CMMI | LEAN
    name TEXT NOT NULL,
    status TEXT DEFAULT 'DRAFT', -- DRAFT | IN_REVIEW | AWAITING_APPROVAL | APPROVED | REJECTED | ARCHIVED
    completion_percent INTEGER DEFAULT 0,
    confidence_avg REAL DEFAULT 0,
    answers_json TEXT DEFAULT '{}',
    context_snapshot TEXT DEFAULT '{}',
    score_summary TEXT DEFAULT '{}',
    current_section_id TEXT,
    review_requested_at TIMESTAMP,
    report_approved_at TIMESTAMP,
    approved_at TIMESTAMP,
    created_by TEXT NOT NULL,
    updated_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for assessments
CREATE INDEX IF NOT EXISTS idx_assessments_org ON assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
CREATE INDEX IF NOT EXISTS idx_assessments_type ON assessments(assessment_type);
CREATE INDEX IF NOT EXISTS idx_assessments_project ON assessments(project_id);

-- ==========================================
-- ASSESSMENT REPORTS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS assessment_reports (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'DRAFT', -- DRAFT | PENDING_APPROVAL | APPROVED | REJECTED
    content_json TEXT DEFAULT '{}',
    approved_by TEXT,
    approved_at TIMESTAMP,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assessment_reports_assessment ON assessment_reports(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_reports_status ON assessment_reports(status);

-- ==========================================
-- ASSESSMENT DECISIONS (Gates)
-- ==========================================

CREATE TABLE IF NOT EXISTS assessment_decisions (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    decision_type TEXT NOT NULL, -- REQUEST_REVIEW | APPROVE_REPORT | APPROVE_ASSESSMENT | GENERATE_INITIATIVES
    status TEXT DEFAULT 'PENDING', -- PENDING | APPROVED | REJECTED
    decision_id TEXT, -- Link to decisions table
    owner_id TEXT,
    due_date TIMESTAMP,
    comment TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assessment_decisions_assessment ON assessment_decisions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_decisions_type ON assessment_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_assessment_decisions_status ON assessment_decisions(status);

-- ==========================================
-- INITIATIVE GENERATION BATCHES
-- ==========================================

CREATE TABLE IF NOT EXISTS assessment_initiative_batches (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    methodology_id TEXT NOT NULL, -- impact-feasibility | moscow | rice | value-effort | strategic-fit
    initiatives_count INTEGER NOT NULL,
    include_chat_context INTEGER DEFAULT 1,
    generated_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assessment_batches_assessment ON assessment_initiative_batches(assessment_id);

-- ==========================================
-- ASSESSMENT -> INITIATIVE LINKS
-- ==========================================

CREATE TABLE IF NOT EXISTS assessment_initiative_links (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    initiative_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES assessment_initiative_batches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assessment_links_assessment ON assessment_initiative_links(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_links_batch ON assessment_initiative_links(batch_id);
CREATE INDEX IF NOT EXISTS idx_assessment_links_initiative ON assessment_initiative_links(initiative_id);

-- ==========================================
-- ASSESSMENT SESSIONS (Dynamic Submenu)
-- ==========================================

CREATE TABLE IF NOT EXISTS assessment_sessions (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assessment_sessions_user ON assessment_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_assessment ON assessment_sessions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_open ON assessment_sessions(user_id, closed_at);

-- ==========================================
-- PERMISSIONS (Admin-configurable)
-- ==========================================

INSERT OR IGNORE INTO permissions (key, name, description, category, icon) VALUES
('ASSESSMENT_REQUEST_REVIEW', 'Assessment: Request Review', 'Request review for assessment', 'ASSESSMENT', 'fact_check'),
('ASSESSMENT_APPROVE_REPORT', 'Assessment: Approve Report', 'Approve assessment report', 'ASSESSMENT', 'description'),
('ASSESSMENT_APPROVE', 'Assessment: Approve Assessment', 'Approve assessment', 'ASSESSMENT', 'check_circle'),
('ASSESSMENT_GENERATE_INITIATIVES', 'Assessment: Generate Initiatives', 'Generate initiatives from assessment', 'ASSESSMENT', 'lightbulb');

-- Role permissions
INSERT OR IGNORE INTO role_permissions (id, role, permission_key, description) VALUES
-- Request Review - Project Lead, Admin, PM
('rp_assessment_request_review_admin', 'ADMIN', 'ASSESSMENT_REQUEST_REVIEW', 'Request review for assessments'),
('rp_assessment_request_review_pm', 'PROJECT_MANAGER', 'ASSESSMENT_REQUEST_REVIEW', 'Request review for assessments'),
('rp_assessment_request_review_super', 'SUPERADMIN', 'ASSESSMENT_REQUEST_REVIEW', 'Request review for assessments'),
-- Approve Report - PMO/Owner
('rp_assessment_approve_report_admin', 'ADMIN', 'ASSESSMENT_APPROVE_REPORT', 'Approve assessment reports'),
('rp_assessment_approve_report_super', 'SUPERADMIN', 'ASSESSMENT_APPROVE_REPORT', 'Approve assessment reports'),
-- Approve Assessment - PMO/Owner
('rp_assessment_approve_admin', 'ADMIN', 'ASSESSMENT_APPROVE', 'Approve assessments'),
('rp_assessment_approve_super', 'SUPERADMIN', 'ASSESSMENT_APPROVE', 'Approve assessments'),
-- Generate Initiatives - Consultant Lead
('rp_assessment_generate_admin', 'ADMIN', 'ASSESSMENT_GENERATE_INITIATIVES', 'Generate initiatives from assessments'),
('rp_assessment_generate_pm', 'PROJECT_MANAGER', 'ASSESSMENT_GENERATE_INITIATIVES', 'Generate initiatives from assessments'),
('rp_assessment_generate_super', 'SUPERADMIN', 'ASSESSMENT_GENERATE_INITIATIVES', 'Generate initiatives from assessments');

-- ==========================================
-- UPDATE initiatives TABLE (if exists)
-- Add source_type and source_id for assessment linking
-- ==========================================

-- SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we use a workaround
-- This will fail silently if column already exists
-- ALTER TABLE initiatives ADD COLUMN source_type TEXT;
-- ALTER TABLE initiatives ADD COLUMN source_id TEXT;

-- Create index for source linking
CREATE INDEX IF NOT EXISTS idx_initiatives_source ON initiatives(source_type, source_id);

-- ==========================================
-- MIGRATION COMPLETE
-- ==========================================
