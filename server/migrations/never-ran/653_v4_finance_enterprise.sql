-- V4-FINC-01..07: Finance Enterprise module
-- Model versioning/scenarios, multi-dim planning, rolling forecast,
-- ERP connectors, valuation audit, AI assumptions, ROI link.

-- ============================================================
-- 1) V4-FINC-01: Model versioning + scenario engine
-- ============================================================

CREATE TABLE IF NOT EXISTS financial_model_versions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  parent_version_id TEXT,
  scenario_label TEXT NOT NULL DEFAULT 'base',
  assumptions_snapshot TEXT DEFAULT '{}',
  events_snapshot TEXT DEFAULT '[]',
  outputs_snapshot TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  merged_at TIMESTAMP,
  merged_by TEXT
);

ALTER TABLE financial_model_versions ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE financial_model_versions ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;
ALTER TABLE financial_model_versions ADD COLUMN IF NOT EXISTS parent_version_id TEXT;
ALTER TABLE financial_model_versions ADD COLUMN IF NOT EXISTS scenario_label TEXT DEFAULT 'base';
ALTER TABLE financial_model_versions ADD COLUMN IF NOT EXISTS assumptions_snapshot TEXT DEFAULT '{}';
ALTER TABLE financial_model_versions ADD COLUMN IF NOT EXISTS events_snapshot TEXT DEFAULT '[]';
ALTER TABLE financial_model_versions ADD COLUMN IF NOT EXISTS outputs_snapshot TEXT DEFAULT '{}';
ALTER TABLE financial_model_versions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE financial_model_versions ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE financial_model_versions ADD COLUMN IF NOT EXISTS merged_at TIMESTAMP;
ALTER TABLE financial_model_versions ADD COLUMN IF NOT EXISTS merged_by TEXT;

CREATE INDEX IF NOT EXISTS idx_fmv_model ON financial_model_versions(organization_id, model_id);
CREATE INDEX IF NOT EXISTS idx_fmv_parent ON financial_model_versions(parent_version_id);

CREATE TABLE IF NOT EXISTS financial_model_version_diffs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  from_version_id TEXT NOT NULL,
  to_version_id TEXT NOT NULL,
  diff_data TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fmvd_versions
  ON financial_model_version_diffs(from_version_id, to_version_id);

-- ============================================================
-- 2) V4-FINC-02: Multi-dimensional planning
-- ============================================================

CREATE TABLE IF NOT EXISTS financial_dimensions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  dimension_name TEXT NOT NULL,
  dimension_type TEXT NOT NULL DEFAULT 'custom',
  hierarchy TEXT DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fdim_org ON financial_dimensions(organization_id);

CREATE TABLE IF NOT EXISTS financial_allocations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  source_dimension_id TEXT,
  target_dimension_id TEXT,
  allocation_method TEXT NOT NULL DEFAULT 'proportional',
  allocation_rules TEXT NOT NULL DEFAULT '{}',
  amount REAL,
  period TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_falloc_model ON financial_allocations(organization_id, model_id);

CREATE TABLE IF NOT EXISTS financial_consolidations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source_model_ids TEXT NOT NULL DEFAULT '[]',
  consolidation_rules TEXT NOT NULL DEFAULT '{}',
  result_snapshot TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fcons_org ON financial_consolidations(organization_id);

-- ============================================================
-- 3) V4-FINC-03: Rolling forecast
-- ============================================================

CREATE TABLE IF NOT EXISTS financial_budget_versions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  budget_type TEXT NOT NULL DEFAULT 'annual',
  fiscal_year INTEGER NOT NULL,
  version_label TEXT NOT NULL DEFAULT 'v1',
  planned_data TEXT NOT NULL DEFAULT '{}',
  actual_data TEXT DEFAULT '{}',
  variance_data TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  approval_gate TEXT DEFAULT 'none',
  approved_by TEXT,
  approved_at TIMESTAMP,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fbv_model ON financial_budget_versions(organization_id, model_id);
CREATE INDEX IF NOT EXISTS idx_fbv_year ON financial_budget_versions(organization_id, fiscal_year);

CREATE TABLE IF NOT EXISTS financial_forecast_cycles (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  cycle_name TEXT NOT NULL,
  cycle_type TEXT NOT NULL DEFAULT 'monthly',
  forecast_horizon_months INTEGER DEFAULT 12,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ffc_model ON financial_forecast_cycles(organization_id, model_id);

CREATE TABLE IF NOT EXISTS financial_variance_alerts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  budget_version_id TEXT NOT NULL,
  line_item TEXT NOT NULL,
  period TEXT NOT NULL,
  planned_amount REAL NOT NULL,
  actual_amount REAL NOT NULL,
  variance_pct REAL NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fva_budget ON financial_variance_alerts(organization_id, budget_version_id);

-- ============================================================
-- 4) V4-FINC-04: Excel/ERP connectors
-- ============================================================

CREATE TABLE IF NOT EXISTS financial_connectors (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  connector_type TEXT NOT NULL DEFAULT 'excel',
  name TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  sync_direction TEXT NOT NULL DEFAULT 'import',
  last_sync_at TIMESTAMP,
  last_sync_status TEXT DEFAULT 'never',
  provenance_log TEXT DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fconn_org ON financial_connectors(organization_id);

CREATE TABLE IF NOT EXISTS financial_sync_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  connector_id TEXT NOT NULL,
  sync_type TEXT NOT NULL DEFAULT 'import',
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_errors INTEGER DEFAULT 0,
  error_details TEXT DEFAULT '[]',
  reconciliation_status TEXT DEFAULT 'pending',
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fslog_connector ON financial_sync_log(organization_id, connector_id);

-- ============================================================
-- 5) V4-FINC-05: Valuation audit trail
-- ============================================================

CREATE TABLE IF NOT EXISTS financial_valuation_snapshots (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  valuation_method TEXT NOT NULL DEFAULT 'dcf',
  assumptions_hash TEXT NOT NULL,
  inputs TEXT NOT NULL DEFAULT '{}',
  outputs TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fvs_model ON financial_valuation_snapshots(organization_id, model_id);

CREATE TABLE IF NOT EXISTS financial_valuation_audit (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  change_detail TEXT DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fvaud_snapshot ON financial_valuation_audit(organization_id, snapshot_id);

-- ============================================================
-- 6) V4-FINC-06: AI assumptions with citations
-- ============================================================

CREATE TABLE IF NOT EXISTS financial_ai_assumptions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  assumption_key TEXT NOT NULL,
  assumption_value TEXT NOT NULL,
  confidence REAL DEFAULT 0.7,
  source_citations TEXT DEFAULT '[]',
  ai_model_used TEXT,
  eval_score REAL,
  status TEXT NOT NULL DEFAULT 'proposed',
  accepted_by TEXT,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_faia_model ON financial_ai_assumptions(organization_id, model_id);

-- ============================================================
-- 7) V4-FINC-07: Finance → ROI link
-- ============================================================

CREATE TABLE IF NOT EXISTS financial_roi_links (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  initiative_id TEXT,
  benefit_id TEXT,
  assumption_ids TEXT DEFAULT '[]',
  realized_value REAL,
  realized_evidence TEXT DEFAULT '[]',
  link_status TEXT NOT NULL DEFAULT 'projected',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_froilink_model ON financial_roi_links(organization_id, model_id);
CREATE INDEX IF NOT EXISTS idx_froilink_initiative ON financial_roi_links(initiative_id);
