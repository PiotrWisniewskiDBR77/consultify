-- Status Reports System
-- PMO Standards Compliance:
-- - ISO 21500:2021 - Progress Reporting (Clause 4.5.3)
-- - PMI PMBOK 7th Edition - Status Report / Dashboard
-- - PRINCE2 - Highlight Report
--
-- PMO Domain: PERFORMANCE_MONITORING

-- Status Reports - Generated progress reports
CREATE TABLE IF NOT EXISTS status_reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    initiative_id TEXT NOT NULL,
    project_id TEXT,
    
    -- Report Period
    period_type TEXT NOT NULL DEFAULT 'WEEKLY', -- WEEKLY, MONTHLY, QUARTERLY
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    period_label TEXT, -- e.g., "Week 52, 2024"
    
    -- Overall Status (RAG)
    overall_status TEXT NOT NULL DEFAULT 'GREEN', -- GREEN, AMBER, RED
    overall_trend TEXT DEFAULT 'STABLE', -- IMPROVING, STABLE, DECLINING
    
    -- Section Statuses (JSON)
    sections_json TEXT, -- {schedule: {status, content, highlights, issues}, budget: {...}, ...}
    
    -- Narrative Content
    executive_summary TEXT,
    accomplishments TEXT, -- JSON array
    next_steps TEXT, -- JSON array
    escalations TEXT, -- JSON array
    risks_and_issues TEXT,
    recommendations TEXT,
    
    -- Metrics at report time
    progress_percent INTEGER DEFAULT 0,
    budget_consumed_percent INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_total INTEGER DEFAULT 0,
    open_risks INTEGER DEFAULT 0,
    open_issues INTEGER DEFAULT 0,
    pending_decisions INTEGER DEFAULT 0,
    
    -- Generation metadata
    generation_method TEXT DEFAULT 'MANUAL', -- MANUAL, AUTO, AI_ASSISTED
    ai_model_used TEXT,
    
    -- Workflow
    status TEXT DEFAULT 'DRAFT', -- DRAFT, PENDING_REVIEW, APPROVED, PUBLISHED, ARCHIVED
    reviewed_by TEXT,
    reviewed_at TEXT,
    approved_by TEXT,
    approved_at TEXT,
    published_at TEXT,
    
    -- Timestamps
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Report Sections - Individual sections for detailed tracking
CREATE TABLE IF NOT EXISTS report_section_history (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    section_name TEXT NOT NULL, -- SCHEDULE, BUDGET, SCOPE, QUALITY, RISKS, RESOURCES
    status TEXT NOT NULL, -- GREEN, AMBER, RED
    previous_status TEXT,
    content TEXT,
    highlights TEXT, -- JSON array
    issues TEXT, -- JSON array
    action_items TEXT, -- JSON array
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES status_reports(id) ON DELETE CASCADE
);

-- Report Distributions - Track who received the report
CREATE TABLE IF NOT EXISTS report_distributions (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    recipient_id TEXT,
    recipient_email TEXT,
    recipient_type TEXT DEFAULT 'STAKEHOLDER', -- STAKEHOLDER, SPONSOR, TEAM, EXTERNAL
    distribution_method TEXT DEFAULT 'EMAIL', -- EMAIL, LINK, PDF
    sent_at TEXT,
    opened_at TEXT,
    link_token TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES status_reports(id) ON DELETE CASCADE
);

-- Report Templates - Customizable templates
CREATE TABLE IF NOT EXISTS report_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    template_type TEXT DEFAULT 'WEEKLY', -- WEEKLY, MONTHLY, QUARTERLY, EXECUTIVE
    sections_config TEXT, -- JSON: which sections to include and their order
    branding_config TEXT, -- JSON: colors, logo, fonts
    is_default INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Report Comments - Feedback on reports
CREATE TABLE IF NOT EXISTS report_comments (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    section_name TEXT, -- optional, for section-specific comments
    author_id TEXT NOT NULL,
    content TEXT NOT NULL,
    is_internal INTEGER DEFAULT 0, -- internal comments not shared with external stakeholders
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES status_reports(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_status_reports_initiative ON status_reports(initiative_id);
CREATE INDEX IF NOT EXISTS idx_status_reports_org ON status_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_status_reports_period ON status_reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_status_reports_status ON status_reports(status);
CREATE INDEX IF NOT EXISTS idx_report_distributions_report ON report_distributions(report_id);
CREATE INDEX IF NOT EXISTS idx_report_section_history_report ON report_section_history(report_id);








