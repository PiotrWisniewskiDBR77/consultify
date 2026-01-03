-- Migration: Management Reports Module
-- Purpose: Tables for storing management reports (Team Meeting & Steering Committee)
-- Date: 2024-12-28
-- PMO Standards: ISO 21500:2021, PMBOK 7, PRINCE2 Highlight Reports

-- =====================================================
-- Table: management_reports
-- Main table for storing generated management reports
-- =====================================================
CREATE TABLE IF NOT EXISTS management_reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,  -- NULL = portfolio report (all projects)
    report_type TEXT NOT NULL CHECK (report_type IN ('TEAM_MEETING', 'STEERING_COMMITTEE')),
    scope TEXT NOT NULL DEFAULT 'PROJECT' CHECK (scope IN ('PROJECT', 'PORTFOLIO')),
    title TEXT NOT NULL,
    period_start DATE,
    period_end DATE,
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINAL', 'ARCHIVED')),
    generated_by TEXT NOT NULL,
    
    -- Report content (JSON)
    content JSON,
    
    -- AI-generated narrative
    ai_narrative TEXT,
    ai_warnings JSON,  -- Transparency: AI never hides bad news
    
    -- Export paths
    pdf_path TEXT,
    pptx_path TEXT,
    
    -- Sharing
    share_token TEXT UNIQUE,
    share_expires_at DATETIME,
    
    -- PMO Standards audit trail
    pmo_domain TEXT DEFAULT 'PERFORMANCE_MONITORING',
    iso21500_mapping TEXT DEFAULT 'Project Performance Measurement (Clause 4.4.22)',
    pmbok_mapping TEXT DEFAULT 'Measurement Performance Domain',
    prince2_mapping TEXT DEFAULT 'Highlight Report / Progress Theme',
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- =====================================================
-- Indexes for management_reports
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_mr_organization ON management_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_mr_project ON management_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_mr_type ON management_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_mr_scope ON management_reports(scope);
CREATE INDEX IF NOT EXISTS idx_mr_status ON management_reports(status);
CREATE INDEX IF NOT EXISTS idx_mr_created ON management_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mr_share_token ON management_reports(share_token);
CREATE INDEX IF NOT EXISTS idx_mr_org_type_date ON management_reports(organization_id, report_type, created_at DESC);

-- =====================================================
-- Table: management_report_sections
-- Customizable sections per report
-- =====================================================
CREATE TABLE IF NOT EXISTS management_report_sections (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    section_type TEXT NOT NULL,
    section_order INTEGER DEFAULT 0,
    title TEXT,
    content JSON,
    is_included BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES management_reports(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mrs_report ON management_report_sections(report_id);
CREATE INDEX IF NOT EXISTS idx_mrs_type ON management_report_sections(section_type);

-- =====================================================
-- Table: management_report_recipients
-- Track who receives reports
-- =====================================================
CREATE TABLE IF NOT EXISTS management_report_recipients (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    user_id TEXT,
    email TEXT,
    sent_at DATETIME,
    opened_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES management_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_mrr_report ON management_report_recipients(report_id);
CREATE INDEX IF NOT EXISTS idx_mrr_user ON management_report_recipients(user_id);

-- =====================================================
-- Table: management_report_schedules
-- Scheduled recurring reports
-- =====================================================
CREATE TABLE IF NOT EXISTS management_report_schedules (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    report_type TEXT NOT NULL CHECK (report_type IN ('TEAM_MEETING', 'STEERING_COMMITTEE')),
    scope TEXT NOT NULL DEFAULT 'PROJECT' CHECK (scope IN ('PROJECT', 'PORTFOLIO')),
    frequency TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY')),
    day_of_week INTEGER,  -- 0=Sunday, 1=Monday, etc.
    day_of_month INTEGER, -- 1-31
    time_of_day TEXT DEFAULT '09:00',  -- HH:MM format
    timezone TEXT DEFAULT 'Europe/Warsaw',
    is_active BOOLEAN DEFAULT 1,
    last_generated_at DATETIME,
    next_scheduled_at DATETIME,
    recipients JSON,  -- Array of user_ids or emails
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_mrs_org ON management_report_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_mrs_next ON management_report_schedules(next_scheduled_at);
CREATE INDEX IF NOT EXISTS idx_mrs_active ON management_report_schedules(is_active);

-- =====================================================
-- Trigger: Update updated_at timestamp
-- =====================================================
CREATE TRIGGER IF NOT EXISTS trg_management_reports_updated
    AFTER UPDATE ON management_reports
    FOR EACH ROW
    BEGIN
        UPDATE management_reports SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS trg_management_report_schedules_updated
    AFTER UPDATE ON management_report_schedules
    FOR EACH ROW
    BEGIN
        UPDATE management_report_schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;






