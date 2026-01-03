-- Migration: Project KPIs with targets and historical values
-- PMO Standards: ISO 21500, PMBOK 7, PRINCE2

-- Table for project-level KPIs
CREATE TABLE IF NOT EXISTS project_kpis (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'SCHEDULE', 'BUDGET', 'QUALITY', 'SCOPE', 'RISK', 'RESOURCES', 'CUSTOM'
    description TEXT,
    
    -- Target and current values
    target_value REAL,
    current_value REAL,
    baseline_value REAL,
    unit TEXT, -- '%', 'days', 'count', '$', 'hours', etc.
    
    -- Thresholds for RAG status
    green_threshold REAL,
    amber_threshold REAL,
    red_threshold REAL,
    threshold_direction TEXT DEFAULT 'HIGHER_IS_BETTER', -- 'HIGHER_IS_BETTER' or 'LOWER_IS_BETTER'
    
    -- Trend and historical data (JSON array of {date, value})
    historical_values TEXT, -- JSON array: [{"date": "2024-01-01", "value": 75}, ...]
    trend TEXT DEFAULT 'STABLE', -- 'IMPROVING', 'STABLE', 'DECLINING'
    
    -- Ownership
    owner_id TEXT,
    
    -- Display options
    display_order INTEGER DEFAULT 0,
    show_sparkline INTEGER DEFAULT 1,
    show_target INTEGER DEFAULT 1,
    
    -- Status
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'ARCHIVED', 'DRAFT'
    
    -- Timestamps
    last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Table for project budget tracking
CREATE TABLE IF NOT EXISTS project_budgets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    
    -- Budget amounts
    planned_budget REAL,
    actual_spend REAL DEFAULT 0,
    committed_spend REAL DEFAULT 0,
    forecast_at_completion REAL,
    
    -- Variance tracking
    variance_percent REAL DEFAULT 0,
    contingency_budget REAL DEFAULT 0,
    contingency_used REAL DEFAULT 0,
    
    -- Period tracking
    current_period_budget REAL,
    current_period_actual REAL,
    
    -- Currency
    currency TEXT DEFAULT 'USD',
    
    -- Budget categories breakdown (JSON)
    category_breakdown TEXT, -- JSON: {"labor": 50000, "materials": 20000, "contractors": 30000}
    
    -- Historical snapshots (JSON array)
    monthly_snapshots TEXT, -- JSON array: [{"month": "2024-01", "planned": 10000, "actual": 9500}, ...]
    
    -- Timestamps
    last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_project_kpis_project ON project_kpis(project_id);
CREATE INDEX IF NOT EXISTS idx_project_kpis_category ON project_kpis(category);
CREATE INDEX IF NOT EXISTS idx_project_kpis_status ON project_kpis(status);
CREATE INDEX IF NOT EXISTS idx_project_budgets_project ON project_budgets(project_id);

-- Insert sample KPIs for new projects (trigger or application logic)
-- These would be created when a project is set up for reporting

-- Common project KPIs template (optional - could be used to auto-populate)
CREATE TABLE IF NOT EXISTS kpi_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    default_unit TEXT,
    default_target REAL,
    green_threshold REAL,
    amber_threshold REAL,
    red_threshold REAL,
    threshold_direction TEXT DEFAULT 'HIGHER_IS_BETTER',
    is_standard INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert standard KPI templates
INSERT OR IGNORE INTO kpi_templates (id, name, category, description, default_unit, default_target, green_threshold, amber_threshold, red_threshold, threshold_direction) VALUES
    ('tpl-spi', 'Schedule Performance Index', 'SCHEDULE', 'Ratio of earned value to planned value', 'ratio', 1.0, 0.95, 0.85, 0.75, 'HIGHER_IS_BETTER'),
    ('tpl-cpi', 'Cost Performance Index', 'BUDGET', 'Ratio of earned value to actual cost', 'ratio', 1.0, 0.95, 0.85, 0.75, 'HIGHER_IS_BETTER'),
    ('tpl-task-completion', 'Task Completion Rate', 'SCHEDULE', 'Percentage of tasks completed on time', '%', 100, 90, 75, 60, 'HIGHER_IS_BETTER'),
    ('tpl-quality-defects', 'Defect Rate', 'QUALITY', 'Number of defects per deliverable', 'count', 0, 2, 5, 10, 'LOWER_IS_BETTER'),
    ('tpl-risk-exposure', 'Risk Exposure Score', 'RISK', 'Weighted sum of open risk impacts', 'score', 0, 15, 30, 50, 'LOWER_IS_BETTER'),
    ('tpl-team-utilization', 'Team Utilization', 'RESOURCES', 'Percentage of team capacity utilized', '%', 85, 75, 60, 50, 'HIGHER_IS_BETTER'),
    ('tpl-scope-change', 'Scope Change Index', 'SCOPE', 'Number of approved scope changes', 'count', 0, 3, 6, 10, 'LOWER_IS_BETTER'),
    ('tpl-milestone-hit', 'Milestone Hit Rate', 'SCHEDULE', 'Percentage of milestones achieved on time', '%', 100, 85, 70, 50, 'HIGHER_IS_BETTER');

-- Update trigger for last_updated_at
CREATE TRIGGER IF NOT EXISTS trg_project_kpis_updated 
    AFTER UPDATE ON project_kpis
BEGIN
    UPDATE project_kpis SET last_updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_project_budgets_updated 
    AFTER UPDATE ON project_budgets
BEGIN
    UPDATE project_budgets SET last_updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;






