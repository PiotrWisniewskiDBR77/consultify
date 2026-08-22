-- Fresh-install parity for legacy Economics. Numeric migration 068 is not in
-- the current PostgreSQL runner set, while mounted routes still require both
-- tables. Keep the schema aligned with the real handler SQL and UUID/TEXT orgs.

CREATE TABLE IF NOT EXISTS analysis_financials (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL UNIQUE REFERENCES digitization_analyses(id) ON DELETE CASCADE,
  initiative_id TEXT REFERENCES initiatives(id) ON DELETE SET NULL,
  organization_id TEXT NOT NULL,
  initial_investment DOUBLE PRECISION DEFAULT 0,
  implementation_cost DOUBLE PRECISION DEFAULT 0,
  annual_operating_cost DOUBLE PRECISION DEFAULT 0,
  training_cost DOUBLE PRECISION DEFAULT 0,
  contingency_percent DOUBLE PRECISION DEFAULT 15,
  annual_cost_savings DOUBLE PRECISION DEFAULT 0,
  annual_revenue_increase DOUBLE PRECISION DEFAULT 0,
  productivity_gains_percent DOUBLE PRECISION DEFAULT 0,
  risk_reduction_value DOUBLE PRECISION DEFAULT 0,
  implementation_months INTEGER DEFAULT 12,
  benefit_realization_months INTEGER DEFAULT 6,
  analysis_horizon_years INTEGER DEFAULT 5,
  discount_rate DOUBLE PRECISION DEFAULT 10,
  npv DOUBLE PRECISION,
  irr DOUBLE PRECISION,
  payback_months DOUBLE PRECISION,
  roi_percent DOUBLE PRECISION,
  currency TEXT DEFAULT 'PLN',
  assumptions TEXT,
  cash_flow_projections TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_calculated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_analysis_financials_analysis ON analysis_financials(analysis_id);
CREATE INDEX IF NOT EXISTS idx_analysis_financials_initiative ON analysis_financials(initiative_id);
CREATE INDEX IF NOT EXISTS idx_analysis_financials_org ON analysis_financials(organization_id);

CREATE TABLE IF NOT EXISTS analysis_financial_scenarios (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES digitization_analyses(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  scenario_type TEXT NOT NULL CHECK (scenario_type IN ('base','optimistic','conservative')),
  name TEXT,
  assumptions TEXT,
  financial_data TEXT NOT NULL,
  metrics TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (analysis_id, scenario_type)
);

CREATE INDEX IF NOT EXISTS idx_financial_scenarios_analysis
  ON analysis_financial_scenarios(analysis_id);
CREATE INDEX IF NOT EXISTS idx_financial_scenarios_active
  ON analysis_financial_scenarios(analysis_id, is_active);

ALTER TABLE benefit_tracking ADD COLUMN IF NOT EXISTS tracking_period TEXT;
