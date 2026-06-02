-- FLOW-BENEFITS-001: Benefits Tracking & KPIs
-- Migration: 262_benefits_tracking.sql

-- ==========================================
-- KPI DEFINITIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS kpi_definitions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- KPI details
    name TEXT NOT NULL,
    code TEXT, -- Short code like "CYC-TIME"
    description TEXT,
    category TEXT NOT NULL, -- 'financial', 'operational', 'quality', 'customer', 'employee', 'strategic', 'custom'
    
    -- Measurement
    unit TEXT NOT NULL, -- '$', '%', 'days', 'hours', 'count', 'score', 'ratio'
    unit_display TEXT, -- Display format like "$ million", "days"
    direction TEXT NOT NULL, -- 'higher_better', 'lower_better', 'target'
    precision INTEGER DEFAULT 2, -- Decimal places
    
    -- Default targets
    default_target REAL,
    default_baseline REAL,
    warning_threshold_percentage REAL DEFAULT 20, -- % away from target
    critical_threshold_percentage REAL DEFAULT 40,
    
    -- Data collection
    is_manual BOOLEAN DEFAULT TRUE,
    data_source_type TEXT, -- 'manual', 'api', 'integration', 'calculated'
    data_source_config TEXT, -- JSON: API endpoint or formula
    collection_frequency TEXT DEFAULT 'monthly', -- 'daily', 'weekly', 'monthly', 'quarterly'
    
    -- Visualization
    chart_type TEXT DEFAULT 'line', -- 'line', 'bar', 'gauge'
    color TEXT,
    
    is_global BOOLEAN DEFAULT FALSE, -- Available to all orgs
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kpi_org ON kpi_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_kpi_category ON kpi_definitions(category);

-- Seed default KPIs
INSERT INTO kpi_definitions (id, organization_id, name, category, unit, direction, is_global) VALUES
    ('kpi-cost-savings', '*', 'Cost Savings', 'financial', '$', 'higher_better', TRUE),
    ('kpi-revenue-growth', '*', 'Revenue Growth', 'financial', '%', 'higher_better', TRUE),
    ('kpi-cycle-time', '*', 'Cycle Time', 'operational', 'days', 'lower_better', TRUE),
    ('kpi-throughput', '*', 'Throughput', 'operational', 'count', 'higher_better', TRUE),
    ('kpi-defect-rate', '*', 'Defect Rate', 'quality', '%', 'lower_better', TRUE),
    ('kpi-first-pass-yield', '*', 'First Pass Yield', 'quality', '%', 'higher_better', TRUE),
    ('kpi-nps', '*', 'Net Promoter Score', 'customer', 'score', 'higher_better', TRUE),
    ('kpi-csat', '*', 'Customer Satisfaction', 'customer', '%', 'higher_better', TRUE),
    ('kpi-employee-engagement', '*', 'Employee Engagement', 'employee', 'score', 'higher_better', TRUE),
    ('kpi-turnover-rate', '*', 'Turnover Rate', 'employee', '%', 'lower_better', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- INITIATIVE BENEFITS
-- ==========================================

CREATE TABLE IF NOT EXISTS initiative_benefits (
    id TEXT PRIMARY KEY,
    initiative_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    
    -- Benefit definition
    name TEXT NOT NULL,
    description TEXT,
    benefit_type TEXT DEFAULT 'quantitative', -- 'quantitative', 'qualitative'
    kpi_id TEXT, -- Link to KPI definition
    category TEXT, -- Inherit from KPI or custom
    
    -- Values
    baseline_value REAL,
    baseline_date DATE,
    target_value REAL NOT NULL,
    target_date DATE,
    current_value REAL,
    "current_date" DATE,
    
    -- Progress
    progress_percentage REAL DEFAULT 0,
    status TEXT DEFAULT 'not_started', -- 'not_started', 'tracking', 'on_track', 'at_risk', 'achieved', 'exceeded', 'failed'
    
    -- Financial impact
    estimated_annual_value REAL,
    actual_annual_value REAL,
    currency TEXT DEFAULT 'USD',
    confidence_level TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
    
    -- Ownership
    owner_id TEXT,
    owner_name TEXT,
    
    -- Tracking
    measurement_frequency TEXT DEFAULT 'monthly',
    last_measured_at TIMESTAMP,
    next_measurement_due DATE,
    
    -- Notes
    notes TEXT,
    risks TEXT, -- JSON: potential risks to realization
    dependencies TEXT, -- JSON: dependencies on other initiatives
    
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
    FOREIGN KEY (kpi_id) REFERENCES kpi_definitions(id)
);

CREATE INDEX IF NOT EXISTS idx_benefits_initiative ON initiative_benefits(initiative_id);
CREATE INDEX IF NOT EXISTS idx_benefits_org ON initiative_benefits(organization_id);
CREATE INDEX IF NOT EXISTS idx_benefits_project ON initiative_benefits(project_id);
CREATE INDEX IF NOT EXISTS idx_benefits_status ON initiative_benefits(status);
CREATE INDEX IF NOT EXISTS idx_benefits_kpi ON initiative_benefits(kpi_id);

-- ==========================================
-- BENEFIT MEASUREMENTS
-- ==========================================

CREATE TABLE IF NOT EXISTS benefit_measurements (
    id TEXT PRIMARY KEY,
    benefit_id TEXT NOT NULL,
    
    -- Measurement
    measured_value REAL NOT NULL,
    measured_at DATE NOT NULL,
    measured_by TEXT,
    
    -- Context
    notes TEXT,
    evidence_type TEXT, -- 'report', 'screenshot', 'document', 'api'
    evidence_url TEXT,
    
    -- Comparison
    vs_baseline_change REAL,
    vs_baseline_percentage REAL,
    vs_target_progress REAL,
    
    -- Quality
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by TEXT,
    verified_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (benefit_id) REFERENCES initiative_benefits(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_measurements_benefit ON benefit_measurements(benefit_id);
CREATE INDEX IF NOT EXISTS idx_measurements_date ON benefit_measurements(measured_at);

-- ==========================================
-- BENEFITS REPORTS
-- ==========================================

CREATE TABLE IF NOT EXISTS benefits_reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Scope
    report_type TEXT NOT NULL, -- 'initiative', 'project', 'portfolio', 'organization'
    reference_type TEXT, -- 'initiative', 'project'
    reference_id TEXT,
    report_period_start DATE,
    report_period_end DATE,
    
    -- Summary metrics
    total_benefits_count INTEGER DEFAULT 0,
    achieved_count INTEGER DEFAULT 0,
    on_track_count INTEGER DEFAULT 0,
    at_risk_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    
    -- Financial summary
    total_estimated_value REAL DEFAULT 0,
    total_realized_value REAL DEFAULT 0,
    realization_rate REAL,
    roi_percentage REAL,
    payback_months INTEGER,
    
    -- Report content
    executive_summary TEXT,
    report_data TEXT, -- JSON: full analysis
    recommendations TEXT, -- JSON: AI or manual recommendations
    
    -- Status
    status TEXT DEFAULT 'draft', -- 'draft', 'published'
    
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    generated_by TEXT,
    published_at TIMESTAMP,
    published_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_benefits_reports_org ON benefits_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_benefits_reports_type ON benefits_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_benefits_reports_ref ON benefits_reports(reference_type, reference_id);

-- ==========================================
-- BENEFIT TARGETS (for organizations)
-- ==========================================

CREATE TABLE IF NOT EXISTS benefit_targets (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Period
    year INTEGER NOT NULL,
    quarter INTEGER, -- NULL for annual
    
    -- Targets
    target_roi REAL,
    target_cost_savings REAL,
    target_revenue_impact REAL,
    target_benefits_count INTEGER,
    
    -- Actuals (updated over time)
    actual_roi REAL,
    actual_cost_savings REAL,
    actual_revenue_impact REAL,
    actual_benefits_count INTEGER,
    
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, year, quarter)
);

CREATE INDEX IF NOT EXISTS idx_benefit_targets_org ON benefit_targets(organization_id);
