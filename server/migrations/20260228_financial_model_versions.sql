-- ============================================
-- Migration: financial_model_versions
-- Version history for financial models (T054)
-- Each approve creates a version record
-- ============================================

-- Baseline Postgres migrations skip the legacy SQLite-first financial modeling migration (<500).
-- Keep this migration self-contained for fresh Postgres databases.
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

CREATE TABLE IF NOT EXISTS financial_model_outputs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  model_id TEXT NOT NULL REFERENCES financial_models(id) ON DELETE CASCADE,
  period_date DATE NOT NULL,
  period_label TEXT,
  statement_type TEXT NOT NULL CHECK (statement_type IN ('P&L', 'BS', 'CF')),
  line_code TEXT NOT NULL,
  line_name TEXT NOT NULL,
  value REAL DEFAULT 0,
  scenario TEXT DEFAULT 'base',
  computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fmo_model ON financial_model_outputs(model_id);
CREATE INDEX IF NOT EXISTS idx_fmo_period ON financial_model_outputs(period_date);
CREATE INDEX IF NOT EXISTS idx_fmo_stmt ON financial_model_outputs(statement_type);

CREATE TABLE IF NOT EXISTS financial_model_versions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  model_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot_data TEXT NOT NULL,
  approved_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (model_id) REFERENCES financial_models(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fmver_model ON financial_model_versions(model_id);
CREATE INDEX IF NOT EXISTS idx_fmver_version ON financial_model_versions(model_id, version);

-- Add source_statement_id to financial_models for traceability (B11)
ALTER TABLE financial_models ADD COLUMN IF NOT EXISTS source_statement_id TEXT;

-- Add estimated flag for computed CF lines (B9)
ALTER TABLE financial_model_outputs ADD COLUMN IF NOT EXISTS is_estimated BOOLEAN DEFAULT FALSE;
