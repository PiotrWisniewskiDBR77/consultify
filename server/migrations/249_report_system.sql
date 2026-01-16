-- FLOW-REPORT-001: Report Generation System
-- Migration: 249_report_system.sql

-- ==========================================
-- REPORT TEMPLATES
-- ==========================================

CREATE TABLE IF NOT EXISTS report_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT, -- NULL for system templates
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'assessment', 'project', 'portfolio', 'initiative', 'custom'
    description TEXT,
    template_data TEXT NOT NULL, -- JSON with sections, styling
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_report_templates_org ON report_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_type ON report_templates(type);

-- Seed default templates
INSERT INTO report_templates (id, organization_id, name, type, description, template_data, is_default) VALUES
    ('tpl-assessment-default', NULL, 'Standard Assessment Report', 'assessment', 
     'Default template for assessment reports',
     '{"sections":["executive_summary","methodology","results_by_dimension","benchmarking","roadmap","appendix"],"styling":{"primaryColor":"#3B82F6","font":"Inter"}}',
     TRUE),
    
    ('tpl-project-default', NULL, 'Project Status Report', 'project',
     'Default template for project status reports', 
     '{"sections":["overview","progress","milestones","risks","next_steps"],"styling":{"primaryColor":"#3B82F6","font":"Inter"}}',
     TRUE),
    
    ('tpl-portfolio-default', NULL, 'Portfolio Overview Report', 'portfolio',
     'Default template for portfolio reports',
     '{"sections":["executive_summary","projects_overview","resource_allocation","timeline","recommendations"],"styling":{"primaryColor":"#3B82F6","font":"Inter"}}',
     TRUE)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- REPORT EXPORTS
-- ==========================================

CREATE TABLE IF NOT EXISTS report_exports (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    report_type TEXT NOT NULL, -- 'assessment', 'project', etc.
    format TEXT NOT NULL, -- 'pdf', 'pptx', 'docx', 'xlsx'
    file_path TEXT,
    file_size INTEGER,
    language TEXT DEFAULT 'en',
    exported_by TEXT NOT NULL,
    exported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    download_count INTEGER DEFAULT 0,
    last_download_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_report_exports_report ON report_exports(report_id);
CREATE INDEX IF NOT EXISTS idx_report_exports_format ON report_exports(format);

-- ==========================================
-- PUBLIC REPORT LINKS
-- ==========================================

CREATE TABLE IF NOT EXISTS report_public_links (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    report_type TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    
    -- Access control
    link_token TEXT NOT NULL UNIQUE,
    password_hash TEXT, -- Optional password protection
    expires_at TIMESTAMP,
    
    -- Branding
    show_company_logo BOOLEAN DEFAULT TRUE,
    show_consultinity_branding BOOLEAN DEFAULT TRUE,
    custom_message TEXT,
    
    -- Tracking
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMP,
    
    -- Audit
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_public_links_token ON report_public_links(link_token);
CREATE INDEX IF NOT EXISTS idx_public_links_report ON report_public_links(report_id);
CREATE INDEX IF NOT EXISTS idx_public_links_expires ON report_public_links(expires_at);

-- ==========================================
-- CUSTOM REPORTS
-- ==========================================

CREATE TABLE IF NOT EXISTS custom_reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Report definition
    report_type TEXT NOT NULL, -- 'query', 'dashboard', 'scheduled'
    query_definition TEXT, -- JSON with data source, filters, grouping
    template_id TEXT,
    
    -- Content (generated)
    content TEXT, -- JSON with generated report data
    generated_at TIMESTAMP,
    
    -- Scheduling
    schedule_cron TEXT, -- NULL for on-demand
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    
    -- Sharing
    shared_with TEXT, -- JSON array of user IDs
    is_public BOOLEAN DEFAULT FALSE,
    
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_custom_reports_org ON custom_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_reports_schedule ON custom_reports(next_run_at);
