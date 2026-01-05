-- ============================================
-- Economics Module 2.0 - Initiative Integration
-- ============================================
-- This migration adds financial analysis and benefit tracking 
-- capabilities to link Economics with Initiatives module.
-- ============================================

-- Step 1: Add initiative linkage to digitization_analyses
ALTER TABLE digitization_analyses ADD COLUMN initiative_id TEXT REFERENCES initiatives(id);
ALTER TABLE digitization_analyses ADD COLUMN analysis_type TEXT DEFAULT 'maturity' 
    CHECK (analysis_type IN ('maturity', 'financial', 'combined'));

-- Step 2: Create Initiative Financials table for investment analysis
CREATE TABLE IF NOT EXISTS initiative_financials (
    id TEXT PRIMARY KEY,
    initiative_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
    analysis_id TEXT REFERENCES digitization_analyses(id) ON DELETE SET NULL,
    organization_id INTEGER NOT NULL,
    
    -- Cost Structure
    initial_investment REAL DEFAULT 0,
    implementation_cost REAL DEFAULT 0,
    annual_operating_cost REAL DEFAULT 0,
    training_cost REAL DEFAULT 0,
    contingency_percent REAL DEFAULT 15,
    
    -- Benefits Structure
    annual_cost_savings REAL DEFAULT 0,
    annual_revenue_increase REAL DEFAULT 0,
    productivity_gains_percent REAL DEFAULT 0,
    risk_reduction_value REAL DEFAULT 0,
    
    -- Time Parameters
    implementation_months INTEGER DEFAULT 12,
    benefit_realization_months INTEGER DEFAULT 6,
    analysis_horizon_years INTEGER DEFAULT 5,
    discount_rate REAL DEFAULT 10,
    
    -- Calculated Metrics (cached for performance)
    npv REAL,
    irr REAL,
    payback_months REAL,
    roi_percent REAL,
    tco_5year REAL,
    
    -- Sensitivity Analysis Results
    sensitivity_results TEXT, -- JSON: { scenarios: [...], tornado: {...} }
    
    -- Metadata
    currency TEXT DEFAULT 'PLN',
    assumptions TEXT, -- JSON array of assumption strings
    cash_flow_projections TEXT, -- JSON array of yearly cash flows
    
    -- Audit
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_calculated_at DATETIME
);

-- Step 3: Create Benefit Tracking table for post-implementation monitoring
CREATE TABLE IF NOT EXISTS benefit_tracking (
    id TEXT PRIMARY KEY,
    financial_id TEXT NOT NULL REFERENCES initiative_financials(id) ON DELETE CASCADE,
    initiative_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL,
    
    -- Tracking Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_type TEXT DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
    
    -- Planned Values (from financial model at period start)
    planned_cost_savings REAL DEFAULT 0,
    planned_revenue_increase REAL DEFAULT 0,
    planned_productivity_gains REAL DEFAULT 0,
    
    -- Actual Values
    actual_cost_savings REAL DEFAULT 0,
    actual_revenue_increase REAL DEFAULT 0,
    actual_productivity_gains REAL DEFAULT 0,
    
    -- Variance Calculations
    variance_cost_savings_percent REAL,
    variance_revenue_percent REAL,
    variance_productivity_percent REAL,
    overall_variance_percent REAL,
    
    -- Qualitative Data
    variance_notes TEXT,
    achievements TEXT, -- JSON array of achievement descriptions
    challenges TEXT, -- JSON array of challenge descriptions
    
    -- Evidence and Verification
    evidence_links TEXT, -- JSON array of evidence URLs/references
    verified_by TEXT,
    verified_at DATETIME,
    verification_status TEXT DEFAULT 'pending' 
        CHECK (verification_status IN ('pending', 'verified', 'disputed')),
    
    -- Audit
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Step 4: Create Quality Assessment table
CREATE TABLE IF NOT EXISTS initiative_quality_assessment (
    id TEXT PRIMARY KEY,
    initiative_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
    financial_id TEXT REFERENCES initiative_financials(id) ON DELETE SET NULL,
    organization_id INTEGER NOT NULL,
    
    -- Forecast Accuracy Metrics
    forecast_accuracy_score REAL, -- 0-100
    cost_variance_percent REAL,
    benefit_variance_percent REAL,
    timeline_variance_percent REAL,
    
    -- Methodology Quality Score
    methodology_score REAL, -- 0-100
    data_quality_score REAL, -- 0-100
    assumption_validity_score REAL, -- 0-100
    
    -- Documentation Completeness
    documentation_score REAL, -- 0-100
    evidence_completeness_percent REAL, -- 0-100
    
    -- Lessons Learned
    lessons_learned TEXT, -- JSON array of lesson objects
    improvement_recommendations TEXT, -- JSON array of recommendation objects
    best_practices_identified TEXT, -- JSON array
    
    -- Overall Rating
    overall_quality_rating TEXT 
        CHECK (overall_quality_rating IN ('excellent', 'good', 'acceptable', 'poor', 'not_assessed')),
    overall_quality_score REAL, -- 0-100 weighted average
    
    -- Assessment Metadata
    assessment_type TEXT DEFAULT 'post_implementation'
        CHECK (assessment_type IN ('interim', 'post_implementation', 'annual_review')),
    assessment_notes TEXT,
    
    -- Audit
    assessed_by TEXT,
    assessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Step 5: Create Financial Assumptions History table for audit trail
CREATE TABLE IF NOT EXISTS financial_assumptions_history (
    id TEXT PRIMARY KEY,
    financial_id TEXT NOT NULL REFERENCES initiative_financials(id) ON DELETE CASCADE,
    
    -- Snapshot of key values at time of change
    assumptions_snapshot TEXT NOT NULL, -- Full JSON of financial model state
    change_reason TEXT,
    change_type TEXT CHECK (change_type IN ('initial', 'update', 'recalculation', 'correction')),
    
    -- Audit
    changed_by TEXT NOT NULL,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Initiative Financials indexes
CREATE INDEX IF NOT EXISTS idx_financials_initiative ON initiative_financials(initiative_id);
CREATE INDEX IF NOT EXISTS idx_financials_analysis ON initiative_financials(analysis_id);
CREATE INDEX IF NOT EXISTS idx_financials_org ON initiative_financials(organization_id);
CREATE INDEX IF NOT EXISTS idx_financials_created ON initiative_financials(created_at);

-- Benefit Tracking indexes
CREATE INDEX IF NOT EXISTS idx_benefit_tracking_financial ON benefit_tracking(financial_id);
CREATE INDEX IF NOT EXISTS idx_benefit_tracking_initiative ON benefit_tracking(initiative_id);
CREATE INDEX IF NOT EXISTS idx_benefit_tracking_org ON benefit_tracking(organization_id);
CREATE INDEX IF NOT EXISTS idx_benefit_tracking_period ON benefit_tracking(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_benefit_tracking_status ON benefit_tracking(verification_status);

-- Quality Assessment indexes
CREATE INDEX IF NOT EXISTS idx_quality_initiative ON initiative_quality_assessment(initiative_id);
CREATE INDEX IF NOT EXISTS idx_quality_financial ON initiative_quality_assessment(financial_id);
CREATE INDEX IF NOT EXISTS idx_quality_org ON initiative_quality_assessment(organization_id);
CREATE INDEX IF NOT EXISTS idx_quality_rating ON initiative_quality_assessment(overall_quality_rating);

-- Assumptions History indexes
CREATE INDEX IF NOT EXISTS idx_assumptions_financial ON financial_assumptions_history(financial_id);
CREATE INDEX IF NOT EXISTS idx_assumptions_changed ON financial_assumptions_history(changed_at);

-- ============================================
-- Digitization Analyses enhancement indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_analyses_initiative ON digitization_analyses(initiative_id);
CREATE INDEX IF NOT EXISTS idx_analyses_type ON digitization_analyses(analysis_type);

-- ============================================
-- Views for Common Queries
-- ============================================

-- View: Initiative Financial Summary
CREATE VIEW IF NOT EXISTS v_initiative_financial_summary AS
SELECT 
    i.id AS initiative_id,
    i.name AS initiative_name,
    i.status AS initiative_status,
    f.id AS financial_id,
    f.initial_investment,
    f.implementation_cost,
    f.annual_operating_cost,
    f.training_cost,
    (f.initial_investment + f.implementation_cost + f.training_cost) AS total_investment,
    f.annual_cost_savings,
    f.annual_revenue_increase,
    (f.annual_cost_savings + f.annual_revenue_increase) AS total_annual_benefits,
    f.npv,
    f.irr,
    f.payback_months,
    f.roi_percent,
    f.analysis_horizon_years,
    f.discount_rate,
    f.currency,
    f.updated_at AS last_updated
FROM initiatives i
LEFT JOIN initiative_financials f ON i.id = f.initiative_id
WHERE f.id IS NOT NULL;

-- View: Benefit Tracking Summary by Initiative
CREATE VIEW IF NOT EXISTS v_benefit_tracking_summary AS
SELECT 
    bt.initiative_id,
    i.name AS initiative_name,
    COUNT(bt.id) AS tracking_periods,
    MIN(bt.period_start) AS first_period,
    MAX(bt.period_end) AS last_period,
    SUM(bt.planned_cost_savings) AS total_planned_savings,
    SUM(bt.actual_cost_savings) AS total_actual_savings,
    SUM(bt.planned_revenue_increase) AS total_planned_revenue,
    SUM(bt.actual_revenue_increase) AS total_actual_revenue,
    AVG(bt.overall_variance_percent) AS avg_variance_percent,
    SUM(CASE WHEN bt.verification_status = 'verified' THEN 1 ELSE 0 END) AS verified_periods,
    SUM(CASE WHEN bt.verification_status = 'pending' THEN 1 ELSE 0 END) AS pending_periods
FROM benefit_tracking bt
JOIN initiatives i ON bt.initiative_id = i.id
GROUP BY bt.initiative_id, i.name;

-- View: Quality Assessment Overview
CREATE VIEW IF NOT EXISTS v_quality_assessment_overview AS
SELECT 
    qa.initiative_id,
    i.name AS initiative_name,
    qa.forecast_accuracy_score,
    qa.methodology_score,
    qa.documentation_score,
    qa.overall_quality_score,
    qa.overall_quality_rating,
    qa.assessment_type,
    qa.assessed_at,
    qa.assessed_by
FROM initiative_quality_assessment qa
JOIN initiatives i ON qa.initiative_id = i.id
ORDER BY qa.assessed_at DESC;

-- ============================================
-- Trigger: Auto-update updated_at timestamp
-- ============================================

-- For SQLite, we'll handle this in application layer
-- But define the pattern for documentation:
-- 
-- CREATE TRIGGER IF NOT EXISTS trg_financials_updated 
-- AFTER UPDATE ON initiative_financials
-- BEGIN
--     UPDATE initiative_financials 
--     SET updated_at = CURRENT_TIMESTAMP 
--     WHERE id = NEW.id;
-- END;

-- ============================================
-- Migration Complete
-- ============================================
















