CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE financial_statement_lines
  ADD COLUMN IF NOT EXISTS line_name_en TEXT,
  ADD COLUMN IF NOT EXISTS aggregation_level INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS required_level TEXT DEFAULT 'optional'
    CHECK (required_level IN ('required', 'optional', 'computed')),
  ADD COLUMN IF NOT EXISTS sign_convention TEXT DEFAULT 'positive_normal'
    CHECK (sign_convention IN ('positive_normal', 'negative_normal', 'display_absolute')),
  ADD COLUMN IF NOT EXISTS data_type TEXT DEFAULT 'monetary'
    CHECK (data_type IN ('monetary', 'ratio', 'text', 'flag')),
  ADD COLUMN IF NOT EXISTS is_total BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_subtotal BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_computed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS formula_json TEXT,
  ADD COLUMN IF NOT EXISTS deaggregation_ready BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS taxonomy_version TEXT DEFAULT 'finance-v1',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

UPDATE financial_statement_lines
SET
  line_name_en = COALESCE(line_name_en, line_name),
  aggregation_level = COALESCE(aggregation_level, 1),
  required_level = CASE
    WHEN id IN (
      'fsl-pl-revenue', 'fsl-pl-cogs', 'fsl-pl-gross', 'fsl-pl-opex', 'fsl-pl-ebitda',
      'fsl-pl-depreciation', 'fsl-pl-ebit', 'fsl-pl-interest', 'fsl-pl-tax', 'fsl-pl-net',
      'fsl-bs-cash', 'fsl-bs-ar', 'fsl-bs-inventory', 'fsl-bs-current-assets', 'fsl-bs-fixed',
      'fsl-bs-total-assets', 'fsl-bs-ap', 'fsl-bs-current-liabilities', 'fsl-bs-long-term-debt',
      'fsl-bs-total-liabilities', 'fsl-bs-equity',
      'fsl-cf-operating', 'fsl-cf-investing', 'fsl-cf-financing', 'fsl-cf-net-change-cash'
    ) THEN 'required'
    WHEN id IN ('fsl-bs-total-liabilities-equity') THEN 'computed'
    ELSE COALESCE(required_level, 'optional')
  END,
  sign_convention = CASE
    WHEN id IN (
      'fsl-pl-cogs', 'fsl-pl-opex', 'fsl-pl-depreciation', 'fsl-pl-interest', 'fsl-pl-tax',
      'fsl-bs-ap', 'fsl-bs-current-liabilities', 'fsl-bs-long-term-debt', 'fsl-bs-total-liabilities',
      'fsl-cf-capex'
    ) THEN 'display_absolute'
    ELSE COALESCE(sign_convention, 'positive_normal')
  END,
  is_total = CASE
    WHEN id IN ('fsl-pl-net', 'fsl-bs-total-assets', 'fsl-bs-total-liabilities-equity', 'fsl-cf-net-change-cash')
    THEN TRUE
    ELSE COALESCE(is_total, FALSE)
  END,
  is_subtotal = CASE
    WHEN id IN (
      'fsl-pl-gross', 'fsl-pl-ebitda', 'fsl-pl-ebit',
      'fsl-bs-current-assets', 'fsl-bs-current-liabilities', 'fsl-bs-total-liabilities', 'fsl-bs-equity'
    )
    THEN TRUE
    ELSE COALESCE(is_subtotal, FALSE)
  END,
  is_computed = CASE
    WHEN id IN (
      'fsl-pl-gross', 'fsl-pl-ebitda', 'fsl-pl-ebit', 'fsl-pl-net',
      'fsl-bs-current-assets', 'fsl-bs-total-assets', 'fsl-bs-current-liabilities',
      'fsl-bs-total-liabilities', 'fsl-bs-equity', 'fsl-bs-total-liabilities-equity',
      'fsl-cf-fcf', 'fsl-cf-net-change-cash'
    )
    THEN TRUE
    ELSE COALESCE(is_computed, FALSE)
  END,
  deaggregation_ready = CASE
    WHEN id IN ('fsl-pl-revenue', 'fsl-pl-cogs', 'fsl-pl-opex', 'fsl-bs-ar', 'fsl-bs-fixed', 'fsl-bs-ap', 'fsl-cf-capex')
    THEN TRUE
    ELSE COALESCE(deaggregation_ready, FALSE)
  END,
  taxonomy_version = 'finance-v1',
  is_active = TRUE;

INSERT INTO financial_statement_lines (
  id, statement_type, line_code, line_name, line_name_en, line_name_pl, sort_order, is_system,
  aggregation_level, required_level, sign_convention, is_total, is_subtotal, is_computed, formula_json,
  deaggregation_ready, taxonomy_version, is_active
) VALUES
  ('fsl-bs-total-liabilities-equity', 'BS', 'TOTAL_LIABILITIES_EQUITY', 'Total Liabilities and Equity', 'Total Liabilities and Equity', 'Pasywa razem', 120, TRUE, 1, 'computed', 'positive_normal', TRUE, FALSE, TRUE, '{"type":"sum","inputs":["TOTAL_LIABILITIES","TOTAL_EQUITY"]}', FALSE, 'finance-v1', TRUE),
  ('fsl-cf-net-change-cash', 'CF', 'NET_CHANGE_CASH', 'Net Change in Cash', 'Net Change in Cash', 'Zmiana stanu środków pieniężnych', 60, TRUE, 1, 'required', 'positive_normal', TRUE, FALSE, TRUE, '{"type":"sum","inputs":["OPERATING_CF","INVESTING_CF","FINANCING_CF"]}', FALSE, 'finance-v1', TRUE)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE financial_statement_values
  ADD COLUMN IF NOT EXISTS source_page INTEGER,
  ADD COLUMN IF NOT EXISTS value_origin TEXT DEFAULT 'source'
    CHECK (value_origin IN ('source', 'mapped', 'manual', 'computed', 'estimated')),
  ADD COLUMN IF NOT EXISTS mapping_confidence REAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_candidate_row_id TEXT REFERENCES financial_statement_candidate_rows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS selected_mapping_candidate_id TEXT REFERENCES financial_statement_mapping_candidates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS period_granularity TEXT DEFAULT 'annual',
  ADD COLUMN IF NOT EXISTS evidence_json TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_fsv_statement_origin ON financial_statement_values(statement_id, value_origin);
CREATE INDEX IF NOT EXISTS idx_fsv_candidate_row ON financial_statement_values(source_candidate_row_id);

CREATE TABLE IF NOT EXISTS financial_statement_value_evidence (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_value_id TEXT NOT NULL REFERENCES financial_statement_values(id) ON DELETE CASCADE,
  candidate_row_id TEXT REFERENCES financial_statement_candidate_rows(id) ON DELETE SET NULL,
  evidence_type TEXT NOT NULL DEFAULT 'direct'
    CHECK (evidence_type IN ('direct', 'aggregated', 'split', 'derived', 'manual_note')),
  weight REAL DEFAULT 1,
  contribution_value REAL,
  explanation TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fsve_value ON financial_statement_value_evidence(statement_value_id);

CREATE TABLE IF NOT EXISTS financial_statement_validations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_id TEXT REFERENCES financial_statements(id) ON DELETE CASCADE,
  statement_pack_id TEXT REFERENCES financial_statement_packs(id) ON DELETE CASCADE,
  validation_scope TEXT NOT NULL
    CHECK (validation_scope IN ('statement', 'pack')),
  check_code TEXT NOT NULL,
  check_name TEXT NOT NULL,
  severity TEXT NOT NULL
    CHECK (severity IN ('info', 'warning', 'error')),
  status TEXT NOT NULL
    CHECK (status IN ('pass', 'warning', 'fail')),
  expected_value REAL,
  actual_value REAL,
  difference REAL,
  tolerance REAL,
  message TEXT,
  details_json TEXT,
  computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fsvl_statement ON financial_statement_validations(statement_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_fsvl_pack ON financial_statement_validations(statement_pack_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS financial_statement_versions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_id TEXT NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  version_kind TEXT NOT NULL
    CHECK (version_kind IN ('mapped', 'validated', 'confirmed', 'repair')),
  readiness_status TEXT
    CHECK (readiness_status IN ('pending', 'recoverable', 'ready', 'rejected')),
  snapshot_json TEXT NOT NULL,
  change_summary TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(statement_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_fsversion_statement ON financial_statement_versions(statement_id, version_no DESC);
