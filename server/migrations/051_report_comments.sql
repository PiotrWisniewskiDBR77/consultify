-- Migration: Report Comments System
-- Version: 051
-- Description: Comment and feedback system for assessment reports

-- ============================================
-- REPORT COMMENTS TABLE
-- Stores comments on report sections for collaborative editing
-- ============================================
CREATE TABLE IF NOT EXISTS report_comments (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    section_id TEXT,                            -- e.g., 'executive_summary', 'axis_processes'
    section_type TEXT,                          -- SECTION type from bcgReportGenerator
    
    -- User info
    user_id TEXT NOT NULL,
    user_name TEXT,
    
    -- Comment content
    comment_type TEXT DEFAULT 'FEEDBACK' CHECK(comment_type IN ('FEEDBACK', 'SUGGESTION', 'QUESTION', 'APPROVAL', 'REJECTION')),
    content TEXT NOT NULL,
    
    -- AI response (when AI processes comment)
    ai_response TEXT,
    ai_suggested_edits TEXT,                    -- JSON array of suggested edits
    ai_processed_at TEXT,
    
    -- Status tracking
    status TEXT DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED')),
    resolved_by TEXT,
    resolved_at TEXT,
    resolution_notes TEXT,
    
    -- Threading (for replies)
    parent_comment_id TEXT,
    thread_position INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    -- Foreign keys
    FOREIGN KEY (report_id) REFERENCES assessment_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (resolved_by) REFERENCES users(id),
    FOREIGN KEY (parent_comment_id) REFERENCES report_comments(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_report_comments_report ON report_comments(report_id);
CREATE INDEX IF NOT EXISTS idx_report_comments_section ON report_comments(report_id, section_id);
CREATE INDEX IF NOT EXISTS idx_report_comments_user ON report_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_report_comments_status ON report_comments(status);
CREATE INDEX IF NOT EXISTS idx_report_comments_thread ON report_comments(parent_comment_id);

-- ============================================
-- REPORT EDIT HISTORY TABLE
-- Tracks all edits made to report sections
-- ============================================
CREATE TABLE IF NOT EXISTS report_edit_history (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    
    -- Edit info
    edit_type TEXT DEFAULT 'MANUAL' CHECK(edit_type IN ('MANUAL', 'AI_GENERATED', 'AI_REGENERATED', 'COMMENT_BASED')),
    editor_id TEXT NOT NULL,
    editor_name TEXT,
    
    -- Content
    previous_content TEXT,                      -- JSON of previous content
    new_content TEXT,                           -- JSON of new content
    change_summary TEXT,
    
    -- Related comment (if edit based on feedback)
    related_comment_id TEXT,
    
    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    
    -- Foreign keys
    FOREIGN KEY (report_id) REFERENCES assessment_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (editor_id) REFERENCES users(id),
    FOREIGN KEY (related_comment_id) REFERENCES report_comments(id) ON DELETE SET NULL
);

-- Index for history lookups
CREATE INDEX IF NOT EXISTS idx_report_edit_history_report ON report_edit_history(report_id);
CREATE INDEX IF NOT EXISTS idx_report_edit_history_section ON report_edit_history(report_id, section_id);

-- ============================================
-- REPORT APPROVALS TABLE
-- Tracks approval workflow for reports
-- ============================================
CREATE TABLE IF NOT EXISTS report_approvals (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    
    -- Approval info
    approver_id TEXT NOT NULL,
    approver_name TEXT,
    approver_role TEXT,                         -- e.g., 'REVIEWER', 'MANAGER', 'EXECUTIVE'
    
    -- Decision
    decision TEXT NOT NULL CHECK(decision IN ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED')),
    feedback TEXT,
    
    -- Timestamps
    requested_at TEXT,
    decided_at TEXT DEFAULT (datetime('now')),
    
    -- Foreign keys
    FOREIGN KEY (report_id) REFERENCES assessment_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_id) REFERENCES users(id)
);

-- Index for approval lookups
CREATE INDEX IF NOT EXISTS idx_report_approvals_report ON report_approvals(report_id);

-- ============================================
-- ADD COLUMNS TO ASSESSMENT_REPORTS IF NOT EXISTS
-- ============================================
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE
-- These should be run carefully in production

-- Add report_data column for full JSON report storage
-- ALTER TABLE assessment_reports ADD COLUMN report_data TEXT;

-- Add version tracking
-- ALTER TABLE assessment_reports ADD COLUMN version INTEGER DEFAULT 1;
-- ALTER TABLE assessment_reports ADD COLUMN parent_version_id TEXT;

-- Add approval status
-- ALTER TABLE assessment_reports ADD COLUMN approval_status TEXT DEFAULT 'PENDING';
-- ALTER TABLE assessment_reports ADD COLUMN approved_by TEXT;
-- ALTER TABLE assessment_reports ADD COLUMN approved_at TEXT;






