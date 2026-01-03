-- Migration: Management Reports Enterprise Features
-- Purpose: Add versioning, approval workflow, comments, and audit logging
-- Date: 2024-12-28
-- PMO Standards: ISO 21500:2021, PMBOK 7, PRINCE2 Highlight Reports

-- =====================================================
-- Table 1: Report Versions
-- Stores historical versions of reports for audit trail
-- =====================================================
CREATE TABLE IF NOT EXISTS management_report_versions (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    version_label TEXT,                   -- "1.0", "1.1", "2.0"
    content JSON NOT NULL,
    ai_narrative TEXT,
    ai_warnings JSON,
    change_summary TEXT,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES management_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- =====================================================
-- Table 2: Report Approvals
-- Multi-level approval workflow tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS management_report_approvals (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    version_id TEXT,
    approval_level INTEGER DEFAULT 1,     -- 1=PM, 2=PMO Lead, 3=Sponsor
    required_role TEXT NOT NULL,          -- MANAGER, PMO_LEAD, SPONSOR
    assigned_to TEXT,                     -- Specific user if assigned
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED')),
    decision_comment TEXT,
    decided_at DATETIME,
    decided_by TEXT,
    sla_due_at DATETIME,
    reminder_sent_at DATETIME,
    escalated_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES management_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES management_report_versions(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL
);

-- =====================================================
-- Table 3: Report Comments
-- Section-based comments with threading and mentions
-- =====================================================
CREATE TABLE IF NOT EXISTS management_report_comments (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    version_id TEXT,
    section_id TEXT,                      -- 'executiveSummary', 'kpis', 'risks', etc.
    parent_comment_id TEXT,               -- For reply threads
    content TEXT NOT NULL,
    mentions JSON,                        -- ["user_id_1", "user_id_2"]
    is_resolved BOOLEAN DEFAULT 0,
    resolved_by TEXT,
    resolved_at DATETIME,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES management_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES management_report_versions(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_comment_id) REFERENCES management_report_comments(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- =====================================================
-- Table 4: Report Audit Log
-- Immutable audit trail for all report actions
-- =====================================================
CREATE TABLE IF NOT EXISTS management_report_audit_log (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    version_id TEXT,
    action TEXT NOT NULL,                 -- CREATED, UPDATED, SUBMITTED, APPROVED, REJECTED, FINALIZED, SHARED, VIEWED, EXPORTED
    actor_id TEXT NOT NULL,
    actor_name TEXT,
    actor_email TEXT,
    details JSON,                         -- Action-specific details
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES management_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES management_report_versions(id) ON DELETE SET NULL
);

-- =====================================================
-- Alter management_reports for new enterprise fields
-- Using separate ALTER statements for SQLite compatibility
-- =====================================================

-- Version tracking
ALTER TABLE management_reports ADD COLUMN current_version INTEGER DEFAULT 1;

-- Approval workflow
ALTER TABLE management_reports ADD COLUMN approval_status TEXT DEFAULT 'NONE';
-- CHECK constraint added via trigger for SQLite

ALTER TABLE management_reports ADD COLUMN requires_approval BOOLEAN DEFAULT 0;
ALTER TABLE management_reports ADD COLUMN approval_config JSON;

-- Lock/Finalize mechanism
ALTER TABLE management_reports ADD COLUMN locked_at DATETIME;
ALTER TABLE management_reports ADD COLUMN locked_by TEXT;
ALTER TABLE management_reports ADD COLUMN finalized_at DATETIME;
ALTER TABLE management_reports ADD COLUMN finalized_by TEXT;
ALTER TABLE management_reports ADD COLUMN integrity_hash TEXT;

-- Period comparison reference
ALTER TABLE management_reports ADD COLUMN previous_report_id TEXT;

-- =====================================================
-- Indexes for Report Versions
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_mrv_report ON management_report_versions(report_id);
CREATE INDEX IF NOT EXISTS idx_mrv_version ON management_report_versions(report_id, version_number);
CREATE INDEX IF NOT EXISTS idx_mrv_created ON management_report_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mrv_created_by ON management_report_versions(created_by);

-- =====================================================
-- Indexes for Report Approvals
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_mra_report ON management_report_approvals(report_id);
CREATE INDEX IF NOT EXISTS idx_mra_status ON management_report_approvals(status);
CREATE INDEX IF NOT EXISTS idx_mra_assigned ON management_report_approvals(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_mra_level ON management_report_approvals(report_id, approval_level);
CREATE INDEX IF NOT EXISTS idx_mra_sla ON management_report_approvals(sla_due_at);
CREATE INDEX IF NOT EXISTS idx_mra_pending ON management_report_approvals(status, sla_due_at) 
    WHERE status = 'PENDING';

-- =====================================================
-- Indexes for Report Comments
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_mrc_report ON management_report_comments(report_id);
CREATE INDEX IF NOT EXISTS idx_mrc_section ON management_report_comments(report_id, section_id);
CREATE INDEX IF NOT EXISTS idx_mrc_parent ON management_report_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_mrc_unresolved ON management_report_comments(report_id, is_resolved) 
    WHERE is_resolved = 0;
CREATE INDEX IF NOT EXISTS idx_mrc_created_by ON management_report_comments(created_by);

-- =====================================================
-- Indexes for Report Audit Log
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_mral_report ON management_report_audit_log(report_id);
CREATE INDEX IF NOT EXISTS idx_mral_action ON management_report_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_mral_actor ON management_report_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_mral_created ON management_report_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mral_report_action ON management_report_audit_log(report_id, action, created_at DESC);

-- =====================================================
-- Triggers for timestamp management
-- =====================================================

-- Trigger: Update comments updated_at
CREATE TRIGGER IF NOT EXISTS trg_mrc_updated
    AFTER UPDATE ON management_report_comments
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
        UPDATE management_report_comments 
        SET updated_at = CURRENT_TIMESTAMP 
        WHERE id = NEW.id;
    END;

-- =====================================================
-- Add view tracking to recipients table
-- =====================================================
ALTER TABLE management_report_recipients ADD COLUMN viewed_at DATETIME;
ALTER TABLE management_report_recipients ADD COLUMN view_count INTEGER DEFAULT 0;
ALTER TABLE management_report_recipients ADD COLUMN last_viewed_at DATETIME;

-- =====================================================
-- Approval workflow configuration presets
-- =====================================================
CREATE TABLE IF NOT EXISTS management_report_approval_presets (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    report_type TEXT,                     -- NULL = applies to all types
    levels JSON NOT NULL,                 -- [{"level": 1, "role": "MANAGER", "required": true, "sla_hours": 48}]
    is_default BOOLEAN DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_mrap_org ON management_report_approval_presets(organization_id);
CREATE INDEX IF NOT EXISTS idx_mrap_type ON management_report_approval_presets(organization_id, report_type);

-- Trigger: Update approval presets updated_at
CREATE TRIGGER IF NOT EXISTS trg_mrap_updated
    AFTER UPDATE ON management_report_approval_presets
    FOR EACH ROW
    BEGIN
        UPDATE management_report_approval_presets 
        SET updated_at = CURRENT_TIMESTAMP 
        WHERE id = NEW.id;
    END;









