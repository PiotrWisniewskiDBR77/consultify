-- Migration: 509_report_builder_comments.sql
-- Report Builder Comments System - Fragment-level commenting with anchors
-- Date: 2026-02-04
--
-- Purpose:
-- - Enable comments on report sections (whole section or text fragment)
-- - Support comment threading
-- - Track resolution status for workflow gates
-- - AI-assisted comment processing

-- ==========================================
-- REPORT BUILDER COMMENTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS report_builder_comments (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    section_key TEXT,                           -- NULL = report-level, otherwise section-specific
    
    -- Text fragment anchor (for inline comments)
    anchor_type TEXT DEFAULT 'section',         -- 'section' | 'fragment'
    range_start INTEGER,                        -- Character offset start (for fragment)
    range_end INTEGER,                          -- Character offset end (for fragment)
    quote TEXT,                                 -- Quoted text for fallback matching
    content_hash TEXT,                          -- Hash of content at comment creation (for drift detection)
    
    -- User info
    user_id TEXT NOT NULL,
    user_name TEXT,
    user_avatar TEXT,
    
    -- Comment content
    comment_type TEXT DEFAULT 'FEEDBACK' CHECK(comment_type IN ('FEEDBACK', 'SUGGESTION', 'QUESTION', 'APPROVAL', 'REJECTION', 'CHANGE_REQUEST')),
    content TEXT NOT NULL,
    
    -- AI processing
    ai_response TEXT,
    ai_suggested_edits TEXT,                    -- JSON: array of suggested text changes
    ai_processed_at TEXT,
    
    -- Status tracking (critical for workflow gates)
    status TEXT DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', 'WONT_FIX')),
    resolved_by TEXT,
    resolved_at TEXT,
    resolution_notes TEXT,
    
    -- Threading
    parent_comment_id TEXT,
    thread_position INTEGER DEFAULT 0,
    
    -- Metadata
    priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'critical')),
    tags TEXT,                                  -- JSON array of tags
    
    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    -- Foreign keys
    FOREIGN KEY (report_id) REFERENCES report_builder_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (resolved_by) REFERENCES users(id),
    FOREIGN KEY (parent_comment_id) REFERENCES report_builder_comments(id) ON DELETE CASCADE
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_rb_comments_report ON report_builder_comments(report_id);
CREATE INDEX IF NOT EXISTS idx_rb_comments_section ON report_builder_comments(report_id, section_key);
CREATE INDEX IF NOT EXISTS idx_rb_comments_status ON report_builder_comments(status);
CREATE INDEX IF NOT EXISTS idx_rb_comments_user ON report_builder_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_rb_comments_thread ON report_builder_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_rb_comments_created ON report_builder_comments(created_at DESC);

-- Composite index for gate check (open comments count)
CREATE INDEX IF NOT EXISTS idx_rb_comments_open_check ON report_builder_comments(report_id, status) 
    WHERE status IN ('OPEN', 'IN_PROGRESS');

-- ==========================================
-- COMMENT ACTIVITY LOG (for audit trail)
-- ==========================================
CREATE TABLE IF NOT EXISTS report_builder_comment_activity (
    id TEXT PRIMARY KEY,
    comment_id TEXT NOT NULL,
    report_id TEXT NOT NULL,
    action_type TEXT NOT NULL,                  -- 'CREATED', 'STATUS_CHANGED', 'EDITED', 'AI_PROCESSED', 'DELETED'
    action_by TEXT NOT NULL,
    action_at TEXT DEFAULT (datetime('now')),
    old_value TEXT,                             -- JSON: previous state
    new_value TEXT,                             -- JSON: new state
    metadata TEXT,                              -- JSON: additional context
    
    FOREIGN KEY (comment_id) REFERENCES report_builder_comments(id) ON DELETE CASCADE,
    FOREIGN KEY (report_id) REFERENCES report_builder_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (action_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_rb_comment_activity_comment ON report_builder_comment_activity(comment_id);
CREATE INDEX IF NOT EXISTS idx_rb_comment_activity_report ON report_builder_comment_activity(report_id);
