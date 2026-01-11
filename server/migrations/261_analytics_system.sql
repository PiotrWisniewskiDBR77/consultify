-- FLOW-ANALYTICS-001: Analytics & Dashboards
-- Migration: 261_analytics_system.sql

-- ==========================================
-- ANALYTICS SNAPSHOTS (Daily aggregation)
-- ==========================================

CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    snapshot_date DATE NOT NULL,
    
    -- Projects metrics
    projects_total INTEGER DEFAULT 0,
    projects_active INTEGER DEFAULT 0,
    projects_completed INTEGER DEFAULT 0,
    projects_archived INTEGER DEFAULT 0,
    projects_on_track INTEGER DEFAULT 0,
    projects_at_risk INTEGER DEFAULT 0,
    projects_critical INTEGER DEFAULT 0,
    
    -- Initiatives metrics
    initiatives_total INTEGER DEFAULT 0,
    initiatives_draft INTEGER DEFAULT 0,
    initiatives_planning INTEGER DEFAULT 0,
    initiatives_review INTEGER DEFAULT 0,
    initiatives_approved INTEGER DEFAULT 0,
    initiatives_executing INTEGER DEFAULT 0,
    initiatives_done INTEGER DEFAULT 0,
    initiatives_blocked INTEGER DEFAULT 0,
    initiatives_cancelled INTEGER DEFAULT 0,
    
    -- Tasks metrics
    tasks_total INTEGER DEFAULT 0,
    tasks_todo INTEGER DEFAULT 0,
    tasks_in_progress INTEGER DEFAULT 0,
    tasks_done INTEGER DEFAULT 0,
    tasks_overdue INTEGER DEFAULT 0,
    tasks_created_today INTEGER DEFAULT 0,
    tasks_completed_today INTEGER DEFAULT 0,
    task_completion_rate REAL,
    avg_task_duration_days REAL,
    
    -- Decisions metrics
    decisions_total INTEGER DEFAULT 0,
    decisions_pending INTEGER DEFAULT 0,
    decisions_made_today INTEGER DEFAULT 0,
    decisions_escalated INTEGER DEFAULT 0,
    decisions_overdue INTEGER DEFAULT 0,
    avg_decision_time_hours REAL,
    
    -- User metrics
    users_total INTEGER DEFAULT 0,
    users_active_today INTEGER DEFAULT 0,
    users_active_week INTEGER DEFAULT 0,
    users_active_month INTEGER DEFAULT 0,
    
    -- AI metrics
    ai_tokens_used_today INTEGER DEFAULT 0,
    ai_tokens_used_month INTEGER DEFAULT 0,
    ai_requests_today INTEGER DEFAULT 0,
    ai_suggestions_count INTEGER DEFAULT 0,
    ai_suggestions_accepted INTEGER DEFAULT 0,
    ai_suggestion_acceptance_rate REAL,
    
    -- Assessment metrics
    assessments_total INTEGER DEFAULT 0,
    assessments_completed INTEGER DEFAULT 0,
    assessments_in_progress INTEGER DEFAULT 0,
    avg_assessment_score REAL,
    
    -- Tool usage
    tool_sessions_today INTEGER DEFAULT 0,
    reports_generated_today INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_org ON analytics_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_analytics_org_date ON analytics_snapshots(organization_id, snapshot_date);

-- ==========================================
-- DASHBOARD WIDGETS LIBRARY
-- ==========================================

CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- 'overview', 'projects', 'initiatives', 'tasks', 'decisions', 'team', 'ai', 'assessments'
    
    -- Widget configuration
    widget_type TEXT NOT NULL, -- 'stat_card', 'line_chart', 'bar_chart', 'pie_chart', 'donut', 'progress', 'list', 'table', 'heatmap'
    default_size TEXT DEFAULT 'medium', -- 'small', 'medium', 'large', 'full'
    default_config TEXT DEFAULT '{}', -- JSON: default settings
    
    -- Data
    data_source TEXT NOT NULL, -- API endpoint
    refresh_interval_seconds INTEGER DEFAULT 300, -- 5 minutes
    
    -- Permissions
    min_role TEXT DEFAULT 'user', -- 'user', 'admin', 'owner', 'superadmin'
    available_for_custom INTEGER DEFAULT 1, -- Can be added to custom dashboards
    
    -- Display
    icon TEXT,
    color TEXT,
    
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default widgets
INSERT OR IGNORE INTO dashboard_widgets (id, name, display_name, category, widget_type, data_source, min_role) VALUES
    -- Overview
    ('w-projects-count', 'projects_count', 'Total Projects', 'overview', 'stat_card', '/api/analytics/stats/projects', 'user'),
    ('w-initiatives-count', 'initiatives_count', 'Total Initiatives', 'overview', 'stat_card', '/api/analytics/stats/initiatives', 'user'),
    ('w-tasks-pending', 'tasks_pending', 'Pending Tasks', 'overview', 'stat_card', '/api/analytics/stats/tasks', 'user'),
    ('w-decisions-pending', 'decisions_pending', 'Pending Decisions', 'overview', 'stat_card', '/api/analytics/stats/decisions', 'user'),
    
    -- Charts
    ('w-project-status', 'project_status_chart', 'Project Status', 'projects', 'pie_chart', '/api/analytics/projects/status', 'user'),
    ('w-initiative-progress', 'initiative_progress_chart', 'Initiative Progress', 'initiatives', 'bar_chart', '/api/analytics/initiatives/progress', 'user'),
    ('w-task-velocity', 'task_velocity_chart', 'Task Velocity', 'tasks', 'line_chart', '/api/analytics/tasks/velocity', 'user'),
    ('w-team-activity', 'team_activity_chart', 'Team Activity', 'team', 'heatmap', '/api/analytics/team/activity', 'admin'),
    ('w-ai-usage', 'ai_usage_chart', 'AI Token Usage', 'ai', 'line_chart', '/api/analytics/ai/usage', 'admin'),
    
    -- Lists
    ('w-recent-tasks', 'recent_tasks', 'Recent Tasks', 'tasks', 'list', '/api/analytics/tasks/recent', 'user'),
    ('w-overdue-tasks', 'overdue_tasks', 'Overdue Tasks', 'tasks', 'list', '/api/analytics/tasks/overdue', 'user'),
    ('w-pending-decisions', 'pending_decisions_list', 'Pending Decisions', 'decisions', 'list', '/api/analytics/decisions/pending', 'user'),
    ('w-at-risk-projects', 'at_risk_projects', 'Projects at Risk', 'projects', 'list', '/api/analytics/projects/at-risk', 'admin');

-- ==========================================
-- CUSTOM DASHBOARDS
-- ==========================================

CREATE TABLE IF NOT EXISTS custom_dashboards (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT, -- NULL = organization-wide dashboard
    
    name TEXT NOT NULL,
    description TEXT,
    
    -- Layout configuration
    layout TEXT NOT NULL DEFAULT '[]', -- JSON: [{widgetId, x, y, w, h}]
    widgets TEXT NOT NULL DEFAULT '[]', -- JSON: [{widgetId, config}]
    
    -- Theme
    theme TEXT DEFAULT 'default',
    
    -- Sharing
    is_shared INTEGER DEFAULT 0,
    shared_with TEXT DEFAULT '[]', -- JSON: [userId] or [roleId]
    share_link_token TEXT,
    
    -- Settings
    is_default INTEGER DEFAULT 0, -- Default for this user/org
    auto_refresh INTEGER DEFAULT 1,
    refresh_interval_seconds INTEGER DEFAULT 300,
    
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dashboards_org ON custom_dashboards(organization_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_user ON custom_dashboards(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_default ON custom_dashboards(is_default);

-- ==========================================
-- SAVED REPORTS
-- ==========================================

CREATE TABLE IF NOT EXISTS saved_reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    name TEXT NOT NULL,
    description TEXT,
    report_type TEXT NOT NULL, -- 'project_status', 'team_performance', 'initiative_progress', 'task_analysis', 'decision_log', 'ai_usage', 'custom'
    
    -- Configuration
    filters TEXT DEFAULT '{}', -- JSON: {field: value}
    columns TEXT DEFAULT '[]', -- JSON: [columnId]
    grouping TEXT, -- JSON: {field, direction}
    sorting TEXT DEFAULT '[]', -- JSON: [{field, direction}]
    date_range TEXT, -- JSON: {from, to, preset}
    
    -- Visualization
    chart_type TEXT, -- 'table', 'bar', 'line', 'pie'
    chart_config TEXT, -- JSON
    
    -- Scheduling
    is_scheduled INTEGER DEFAULT 0,
    schedule_cron TEXT,
    schedule_timezone TEXT DEFAULT 'UTC',
    recipients TEXT DEFAULT '[]', -- JSON: [email]
    recipient_user_ids TEXT DEFAULT '[]', -- JSON: [userId]
    include_csv INTEGER DEFAULT 0,
    include_pdf INTEGER DEFAULT 0,
    last_run_at TIMESTAMP,
    last_sent_at TIMESTAMP,
    next_run_at TIMESTAMP,
    
    -- Access
    is_shared INTEGER DEFAULT 0,
    shared_with TEXT DEFAULT '[]',
    
    run_count INTEGER DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_org ON saved_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON saved_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_scheduled ON saved_reports(is_scheduled);
CREATE INDEX IF NOT EXISTS idx_reports_next_run ON saved_reports(next_run_at);

-- ==========================================
-- REPORT RUNS HISTORY
-- ==========================================

CREATE TABLE IF NOT EXISTS report_runs (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    
    -- Run details
    run_type TEXT NOT NULL, -- 'manual', 'scheduled', 'api'
    run_by TEXT, -- User ID or 'system'
    
    -- Results
    status TEXT NOT NULL, -- 'running', 'completed', 'failed'
    row_count INTEGER,
    file_url TEXT, -- If exported
    file_format TEXT,
    
    -- Performance
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    
    -- Errors
    error_message TEXT,
    
    FOREIGN KEY (report_id) REFERENCES saved_reports(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_report_runs_report ON report_runs(report_id);
CREATE INDEX IF NOT EXISTS idx_report_runs_started ON report_runs(started_at);
