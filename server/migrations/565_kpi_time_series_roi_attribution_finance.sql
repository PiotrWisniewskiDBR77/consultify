-- Migration 564: KPI time series, ROI tracking, attribution, financial mapping
-- Bundle 12: T046 (ROI Tracking) + T047 (KPI Mapping) + T048 (Attribution) + T049 (Financial Mapping)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure base KPI table exists (older DBs may not have 061_initiative_lifecycle applied)
CREATE TABLE IF NOT EXISTS initiative_kpis (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  initiative_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  target_value REAL,
  unit TEXT,
  measurement_frequency TEXT DEFAULT 'MONTHLY',
  alert_threshold REAL,
  alert_direction TEXT DEFAULT 'BELOW',
  is_primary INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE
);

-- FRESH-DB PARITY (2026-07-14): 2026-06-08_qa_schema_drift_catchup.sql adds
-- `is_on_target` only when initiative_kpis already exists (it sorts before this
-- file). Re-add it here idempotently so a fresh replay ends with the same
-- schema as staging/prod. No-op wherever the column already exists.
ALTER TABLE initiative_kpis ADD COLUMN IF NOT EXISTS is_on_target INTEGER DEFAULT 0;
-- Also re-add the KPI lineage columns from 20260624_kpi_kind_lineage.sql (same
-- fresh-replay ordering issue; no-op wherever they already exist).
ALTER TABLE initiative_kpis ADD COLUMN IF NOT EXISTS kpi_kind TEXT;
ALTER TABLE initiative_kpis ADD COLUMN IF NOT EXISTS leads_kpi_id TEXT;

-- ============================================
-- T047: KPI TIME SERIES VALUES
-- ============================================

CREATE TABLE IF NOT EXISTS kpi_time_series (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  kpi_id TEXT NOT NULL,
  initiative_id TEXT,
  organization_id TEXT NOT NULL,
  value REAL NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE,
  source TEXT DEFAULT 'manual',
  notes TEXT,
  recorded_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (kpi_id) REFERENCES initiative_kpis(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kpi_ts_kpi ON kpi_time_series(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_ts_org ON kpi_time_series(organization_id);
CREATE INDEX IF NOT EXISTS idx_kpi_ts_period ON kpi_time_series(period_start);
CREATE INDEX IF NOT EXISTS idx_kpi_ts_initiative ON kpi_time_series(initiative_id);

-- ============================================
-- T047: INITIATIVE <-> KPI MAPPING (many-to-many with weights)
-- ============================================

CREATE TABLE IF NOT EXISTS initiative_kpi_mappings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  initiative_id TEXT NOT NULL,
  kpi_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  impact_weight REAL DEFAULT 1.0,
  impact_direction TEXT DEFAULT 'increase' CHECK (impact_direction IN ('increase', 'decrease')),
  expected_delta REAL,
  expected_delta_unit TEXT,
  lag_days INTEGER DEFAULT 0,
  confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(initiative_id, kpi_id),
  FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
  FOREIGN KEY (kpi_id) REFERENCES initiative_kpis(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ikm_initiative ON initiative_kpi_mappings(initiative_id);
CREATE INDEX IF NOT EXISTS idx_ikm_kpi ON initiative_kpi_mappings(kpi_id);

-- ============================================
-- T046: ROI ASSUMPTIONS & TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS roi_assumptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  initiative_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  capex REAL DEFAULT 0,
  opex_annual REAL DEFAULT 0,
  expected_roi_percent REAL,
  expected_npv REAL,
  expected_payback_months INTEGER,
  horizon_months INTEGER DEFAULT 36,
  baseline_revenue REAL,
  baseline_cost REAL,
  expected_revenue_delta REAL,
  expected_cost_delta REAL,
  effect_start_date DATE,
  assumptions_text TEXT,
  assumptions_owner TEXT,
  confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  last_updated_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_roi_assumptions_initiative ON roi_assumptions(initiative_id);
CREATE INDEX IF NOT EXISTS idx_roi_assumptions_org ON roi_assumptions(organization_id);

CREATE TABLE IF NOT EXISTS roi_realized_values (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  initiative_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  period_month DATE NOT NULL,
  realized_revenue_delta REAL,
  realized_cost_delta REAL,
  realized_savings REAL,
  source TEXT DEFAULT 'manual',
  variance_notes TEXT,
  recorded_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_roi_realized_initiative ON roi_realized_values(initiative_id);
CREATE INDEX IF NOT EXISTS idx_roi_realized_period ON roi_realized_values(period_month);

-- ============================================
-- T048: KPI ATTRIBUTION SNAPSHOTS
-- ============================================

CREATE TABLE IF NOT EXISTS kpi_attribution_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  kpi_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  kpi_delta REAL,
  contributions TEXT NOT NULL,
  unexplained_remainder REAL,
  unexplained_percent REAL,
  overall_confidence TEXT DEFAULT 'low' CHECK (overall_confidence IN ('low', 'medium', 'high')),
  confidence_reasons TEXT,
  assumptions TEXT,
  algorithm_version TEXT DEFAULT 'v1_heuristic',
  computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  computed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_attr_kpi ON kpi_attribution_snapshots(kpi_id);
CREATE INDEX IF NOT EXISTS idx_attr_org ON kpi_attribution_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_attr_period ON kpi_attribution_snapshots(period_start, period_end);

-- ============================================
-- T049: FINANCIAL STATEMENT LINES & KPI MAPPING
-- ============================================

CREATE TABLE IF NOT EXISTS financial_statement_lines (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT,
  statement_type TEXT NOT NULL CHECK (statement_type IN ('P&L', 'BS', 'CF')),
  line_code TEXT NOT NULL,
  line_name TEXT NOT NULL,
  line_name_pl TEXT,
  parent_line_id TEXT,
  sort_order INTEGER DEFAULT 0,
  is_system BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fsl_type ON financial_statement_lines(statement_type);
CREATE INDEX IF NOT EXISTS idx_fsl_org ON financial_statement_lines(organization_id);

-- Seed canonical statement lines
INSERT INTO financial_statement_lines (id, statement_type, line_code, line_name, line_name_pl, sort_order, is_system) VALUES
  ('fsl-pl-revenue', 'P&L', 'REVENUE', 'Revenue', 'Przychody', 10, TRUE),
  ('fsl-pl-cogs', 'P&L', 'COGS', 'Cost of Goods Sold', 'Koszt sprzedanych towarów', 20, TRUE),
  ('fsl-pl-gross', 'P&L', 'GROSS_MARGIN', 'Gross Margin', 'Marża brutto', 30, TRUE),
  ('fsl-pl-opex', 'P&L', 'OPEX', 'Operating Expenses (SG&A)', 'Koszty operacyjne (SG&A)', 40, TRUE),
  ('fsl-pl-ebitda', 'P&L', 'EBITDA', 'EBITDA', 'EBITDA', 50, TRUE),
  ('fsl-pl-ebit', 'P&L', 'EBIT', 'EBIT / Operating Profit', 'EBIT / Zysk operacyjny', 60, TRUE),
  ('fsl-pl-net', 'P&L', 'NET_INCOME', 'Net Income', 'Zysk netto', 70, TRUE),
  ('fsl-bs-inventory', 'BS', 'INVENTORY', 'Inventory', 'Zapasy', 10, TRUE),
  ('fsl-bs-ar', 'BS', 'AR', 'Accounts Receivable', 'Należności', 20, TRUE),
  ('fsl-bs-ap', 'BS', 'AP', 'Accounts Payable', 'Zobowiązania', 30, TRUE),
  ('fsl-bs-wc', 'BS', 'WORKING_CAPITAL', 'Working Capital', 'Kapitał obrotowy', 40, TRUE),
  ('fsl-bs-fixed', 'BS', 'FIXED_ASSETS', 'Fixed Assets', 'Aktywa trwałe', 50, TRUE),
  ('fsl-cf-operating', 'CF', 'CFO', 'Operating Cash Flow', 'Przepływy operacyjne', 10, TRUE),
  ('fsl-cf-capex', 'CF', 'CAPEX', 'Capital Expenditures', 'Nakłady inwestycyjne', 20, TRUE),
  ('fsl-cf-fcf', 'CF', 'FCF', 'Free Cash Flow', 'Wolne przepływy pieniężne', 30, TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS kpi_financial_mappings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  kpi_id TEXT NOT NULL,
  statement_line_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('positive', 'negative', 'neutral')),
  relationship_type TEXT DEFAULT 'linear' CHECK (relationship_type IN ('linear', 'percentage', 'step', 'custom')),
  multiplier REAL DEFAULT 1.0,
  formula_params TEXT,
  confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  assumptions_text TEXT,
  assumptions_owner TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(kpi_id, statement_line_id, organization_id),
  FOREIGN KEY (kpi_id) REFERENCES initiative_kpis(id) ON DELETE CASCADE,
  FOREIGN KEY (statement_line_id) REFERENCES financial_statement_lines(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kfm_kpi ON kpi_financial_mappings(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kfm_line ON kpi_financial_mappings(statement_line_id);
CREATE INDEX IF NOT EXISTS idx_kfm_org ON kpi_financial_mappings(organization_id);
