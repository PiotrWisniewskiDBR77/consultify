-- Migration: Management Report Templates
-- Purpose: Add custom report templates system for organizations
-- Date: 2024-12-28
-- PMO Standards: ISO 21500, PMBOK 7, PRINCE2 Configuration Management

-- =====================================================
-- Table: Custom Report Templates
-- Allows organizations to define their own report structures
-- =====================================================
CREATE TABLE IF NOT EXISTS management_report_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    report_type TEXT NOT NULL,                -- 'TEAM_MEETING' | 'STEERING_COMMITTEE'
    scope TEXT DEFAULT 'PORTFOLIO',           -- 'PROJECT' | 'PORTFOLIO'
    
    -- Template configuration
    sections JSON NOT NULL,                   -- Ordered list of sections with config
    default_period_days INTEGER DEFAULT 7,
    default_ai_enhancement BOOLEAN DEFAULT TRUE,
    default_approval_config JSON,
    
    -- Branding overrides
    custom_header_text TEXT,
    custom_footer_text TEXT,
    include_logo BOOLEAN DEFAULT TRUE,
    
    -- Export settings
    pdf_orientation TEXT DEFAULT 'portrait',  -- 'portrait' | 'landscape'
    pptx_theme TEXT DEFAULT 'professional',   -- 'professional' | 'modern' | 'minimal'
    
    -- Status
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- =====================================================
-- Table: Template Section Definitions
-- Pre-defined sections that can be used in templates
-- =====================================================
CREATE TABLE IF NOT EXISTS management_report_section_definitions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,                -- 'executiveSummary', 'kpis', etc.
    name TEXT NOT NULL,
    description TEXT,
    report_types JSON,                        -- ['TEAM_MEETING', 'STEERING_COMMITTEE']
    
    -- Section configuration
    default_config JSON,                      -- Default settings for this section
    required_data_sources JSON,               -- Data sources needed to populate
    
    -- Display settings
    display_order INTEGER DEFAULT 100,
    is_required_default BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_mrt_org ON management_report_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_mrt_type ON management_report_templates(organization_id, report_type);
CREATE INDEX IF NOT EXISTS idx_mrt_default ON management_report_templates(organization_id, is_default);
CREATE INDEX IF NOT EXISTS idx_mrt_active ON management_report_templates(organization_id, is_active);

-- =====================================================
-- Trigger for updated_at (PostgreSQL function-based trigger)
-- =====================================================
CREATE OR REPLACE FUNCTION update_management_report_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mrt_updated ON management_report_templates;
CREATE TRIGGER trg_mrt_updated
    BEFORE UPDATE ON management_report_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_management_report_templates_updated_at();

-- =====================================================
-- Seed default section definitions
-- =====================================================
INSERT INTO management_report_section_definitions (id, code, name, description, report_types, default_config, display_order, is_required_default) VALUES
-- Team Meeting sections
('sec_status_summary', 'statusSummary', 'Status Overview', 'High-level status metrics and RAG indicators', '["TEAM_MEETING", "STEERING_COMMITTEE"]', '{"showTrends": true}', 10, TRUE),
('sec_completed_work', 'completedWork', 'Completed Work', 'Tasks and deliverables completed during the period', '["TEAM_MEETING"]', '{"maxItems": 10}', 20, TRUE),
('sec_work_in_progress', 'workInProgress', 'Work in Progress', 'Current active tasks and their status', '["TEAM_MEETING"]', '{"showProgress": true}', 30, TRUE),
('sec_blockers', 'blockers', 'Blockers & Issues', 'Current impediments requiring attention', '["TEAM_MEETING"]', '{"showAge": true}', 40, TRUE),
('sec_pending_decisions', 'pendingDecisions', 'Pending Decisions', 'Decisions awaiting resolution', '["TEAM_MEETING", "STEERING_COMMITTEE"]', '{"showDeadlines": true}', 50, FALSE),
('sec_next_period', 'nextPeriodPlan', 'Next Period Plan', 'Planned work for the upcoming period', '["TEAM_MEETING"]', '{"periodDays": 7}', 60, TRUE),

-- Steering Committee sections
('sec_exec_summary', 'executiveSummary', 'Executive Summary', 'AI-generated executive overview', '["STEERING_COMMITTEE"]', '{"maxLength": 500}', 10, TRUE),
('sec_overall_status', 'overallStatus', 'RAG Status', 'Traffic light status across key dimensions', '["STEERING_COMMITTEE"]', '{"categories": ["SCHEDULE", "BUDGET", "SCOPE", "QUALITY", "RISK"]}', 20, TRUE),
('sec_kpis', 'kpis', 'Key Performance Indicators', 'Project KPIs with targets and actuals', '["STEERING_COMMITTEE"]', '{"showTrends": true, "showSparklines": true}', 30, TRUE),
('sec_risks_issues', 'risksAndIssues', 'Risks & Issues', 'Current risks and active issues', '["STEERING_COMMITTEE"]', '{"maxCritical": 5, "maxHigh": 10}', 40, TRUE),
('sec_decisions_required', 'decisionsRequired', 'Decisions Required', 'Decisions requiring board/sponsor input', '["STEERING_COMMITTEE"]', '{"showUrgency": true}', 50, TRUE),
('sec_forecast', 'forecast', 'Forecast & Milestones', 'Project forecast with milestone status', '["STEERING_COMMITTEE"]', '{"showConfidence": true, "showEVM": false}', 60, TRUE),
('sec_evm', 'evmMetrics', 'Earned Value Metrics', 'EVM performance indicators (SPI, CPI, etc.)', '["STEERING_COMMITTEE"]', '{"showCharts": true}', 70, FALSE),
('sec_period_comparison', 'periodComparison', 'Period Comparison', 'Changes since last report', '["TEAM_MEETING", "STEERING_COMMITTEE"]', '{"showTrends": true}', 80, FALSE),
('sec_ai_insights', 'aiInsights', 'AI Insights', 'AI-generated observations and recommendations', '["TEAM_MEETING", "STEERING_COMMITTEE"]', '{"maxInsights": 5}', 90, FALSE)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- Seed a default template for each type
-- =====================================================
INSERT INTO management_report_templates (
    id, organization_id, name, description, report_type, scope, 
    sections, default_period_days, is_default, created_by
) VALUES 
(
    'tpl_default_team',
    'system',
    'Standard Team Meeting Report',
    'Default template for weekly team synchronization reports',
    'TEAM_MEETING',
    'PROJECT',
    '[
        {"code": "statusSummary", "required": true, "config": {}},
        {"code": "completedWork", "required": true, "config": {}},
        {"code": "workInProgress", "required": true, "config": {}},
        {"code": "blockers", "required": true, "config": {}},
        {"code": "pendingDecisions", "required": false, "config": {}},
        {"code": "nextPeriodPlan", "required": true, "config": {}}
    ]',
    7,
    TRUE,
    'system'
),
(
    'tpl_default_steering',
    'system',
    'Standard Steering Committee Report',
    'Default template for executive steering committee briefings',
    'STEERING_COMMITTEE',
    'PROJECT',
    '[
        {"code": "executiveSummary", "required": true, "config": {}},
        {"code": "overallStatus", "required": true, "config": {}},
        {"code": "kpis", "required": true, "config": {}},
        {"code": "risksAndIssues", "required": true, "config": {}},
        {"code": "decisionsRequired", "required": true, "config": {}},
        {"code": "forecast", "required": true, "config": {}}
    ]',
    30,
    TRUE,
    'system'
)
ON CONFLICT (id) DO NOTHING;




















