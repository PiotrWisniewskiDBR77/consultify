-- Economics Module: Analysis Financials & Scenarios
-- Migration: 068_economics_analysis_financials.sql
-- Purpose: Store financial analysis data per analysis (independent of initiatives)

-- ============================================
-- Analysis Financials (independent from initiative)
-- ============================================
CREATE TABLE IF NOT EXISTS analysis_financials (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL UNIQUE,
    initiative_id TEXT,
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

    -- Calculated Metrics (cached)
    npv REAL,
    irr REAL,
    payback_months REAL,
    roi_percent REAL,

    -- Metadata
    currency TEXT DEFAULT 'PLN',
    assumptions TEXT, -- JSON array
    cash_flow_projections TEXT, -- JSON array

    -- Audit
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_calculated_at DATETIME,

    FOREIGN KEY (analysis_id) REFERENCES digitization_analyses(id) ON DELETE CASCADE,
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_financials_analysis ON analysis_financials(analysis_id);
CREATE INDEX IF NOT EXISTS idx_analysis_financials_initiative ON analysis_financials(initiative_id);
CREATE INDEX IF NOT EXISTS idx_analysis_financials_org ON analysis_financials(organization_id);

-- ============================================
-- Analysis Financial Scenarios
-- ============================================
CREATE TABLE IF NOT EXISTS analysis_financial_scenarios (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL,
    organization_id INTEGER NOT NULL,

    scenario_type TEXT NOT NULL CHECK (scenario_type IN ('base', 'optimistic', 'conservative')),
    name TEXT,
    assumptions TEXT, -- JSON array
    financial_data TEXT NOT NULL, -- JSON snapshot of inputs
    metrics TEXT NOT NULL, -- JSON { npv, irr, roi, paybackPeriod, cashFlows }
    is_active BOOLEAN DEFAULT 0,

    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (analysis_id) REFERENCES digitization_analyses(id) ON DELETE CASCADE,
    UNIQUE(analysis_id, scenario_type)
);

CREATE INDEX IF NOT EXISTS idx_financial_scenarios_analysis ON analysis_financial_scenarios(analysis_id);
CREATE INDEX IF NOT EXISTS idx_financial_scenarios_active ON analysis_financial_scenarios(analysis_id, is_active);

-- ============================================
-- Benefit tracking enhancement
-- ============================================
ALTER TABLE benefit_tracking ADD COLUMN tracking_period TEXT;
