-- ============================================
-- Migration 571 — Bundle 15: T054
-- Financial Modeling of Initiatives
-- Integrated P&L + Balance Sheet + Cash Flow
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS financial_models (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  initiative_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  currency TEXT DEFAULT 'PLN',
  horizon_months INTEGER DEFAULT 60,
  start_date DATE NOT NULL,
  granularity TEXT DEFAULT 'monthly' CHECK (granularity IN ('monthly', 'quarterly', 'annual')),
  scenario TEXT DEFAULT 'base' CHECK (scenario IN ('base', 'optimistic', 'conservative')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'archived')),
  assumptions_json TEXT DEFAULT '{}',
  version INTEGER DEFAULT 1,
  approved_by TEXT,
  approved_at TIMESTAMP,
  approved_snapshot TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fm_org ON financial_models(organization_id);
CREATE INDEX IF NOT EXISTS idx_fm_project ON financial_models(project_id);
CREATE INDEX IF NOT EXISTS idx_fm_initiative ON financial_models(initiative_id);
CREATE INDEX IF NOT EXISTS idx_fm_status ON financial_models(status);

-- Economic events that drive the model
CREATE TABLE IF NOT EXISTS financial_model_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  model_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'revenue', 'cogs', 'opex',
    'capex_purchase', 'depreciation_run',
    'debt_drawdown', 'debt_repayment', 'interest_accrual',
    'tax_accrual', 'tax_payment',
    'wc_change', 'equity_injection', 'dividend'
  )),
  name TEXT NOT NULL,
  description TEXT,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'PLN',
  period_start DATE NOT NULL,
  period_end DATE,
  recurrence TEXT DEFAULT 'one_time' CHECK (recurrence IN ('one_time', 'monthly', 'quarterly', 'annual')),
  growth_rate REAL DEFAULT 0,
  cf_classification TEXT NOT NULL CHECK (cf_classification IN ('operating', 'investing', 'financing', 'none')),
  posting_rules TEXT NOT NULL DEFAULT '{}',
  parameters TEXT DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (model_id) REFERENCES financial_models(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fme_model ON financial_model_events(model_id);
CREATE INDEX IF NOT EXISTS idx_fme_type ON financial_model_events(event_type);

-- Computed output snapshots per period
CREATE TABLE IF NOT EXISTS financial_model_outputs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  model_id TEXT NOT NULL,
  period_date DATE NOT NULL,
  period_label TEXT,
  statement_type TEXT NOT NULL CHECK (statement_type IN ('P&L', 'BS', 'CF')),
  line_code TEXT NOT NULL,
  line_name TEXT NOT NULL,
  value REAL DEFAULT 0,
  scenario TEXT DEFAULT 'base',
  computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (model_id) REFERENCES financial_models(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fmo_model ON financial_model_outputs(model_id);
CREATE INDEX IF NOT EXISTS idx_fmo_period ON financial_model_outputs(period_date);
CREATE INDEX IF NOT EXISTS idx_fmo_stmt ON financial_model_outputs(statement_type);

-- Validation results per period
CREATE TABLE IF NOT EXISTS financial_model_validations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  model_id TEXT NOT NULL,
  period_date DATE,
  check_code TEXT NOT NULL,
  check_name TEXT NOT NULL,
  status TEXT DEFAULT 'pass' CHECK (status IN ('pass', 'fail', 'warning')),
  expected_value REAL,
  actual_value REAL,
  difference REAL,
  message TEXT,
  details TEXT,
  computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (model_id) REFERENCES financial_models(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fmv_model ON financial_model_validations(model_id);
CREATE INDEX IF NOT EXISTS idx_fmv_status ON financial_model_validations(status);
