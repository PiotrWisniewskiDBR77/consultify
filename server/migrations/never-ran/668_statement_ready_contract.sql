-- ============================================
-- Migration 668 — Statement Ready Contract
-- Harden statement readiness, run history, aliases, and value versioning
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE financial_statements
  ADD COLUMN IF NOT EXISTS readiness_status TEXT DEFAULT 'pending'
    CHECK (readiness_status IN ('pending', 'recoverable', 'ready', 'rejected')),
  ADD COLUMN IF NOT EXISTS readiness_score REAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_summary TEXT,
  ADD COLUMN IF NOT EXISTS quality_reason_codes TEXT,
  ADD COLUMN IF NOT EXISTS document_class TEXT DEFAULT 'unknown'
    CHECK (document_class IN ('unknown', 'native_pdf', 'scan_pdf', 'spreadsheet', 'csv', 'mixed_report')),
  ADD COLUMN IF NOT EXISTS extraction_strategy TEXT,
  ADD COLUMN IF NOT EXISTS template_family TEXT,
  ADD COLUMN IF NOT EXISTS values_version INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_fs_readiness_status ON financial_statements(readiness_status);
CREATE INDEX IF NOT EXISTS idx_fs_document_class ON financial_statements(document_class);

ALTER TABLE financial_statement_values
  ADD COLUMN IF NOT EXISTS is_non_financial BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS quality_label TEXT,
  ADD COLUMN IF NOT EXISTS classification_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_fsv_non_financial ON financial_statement_values(statement_id, is_non_financial);

CREATE TABLE IF NOT EXISTS financial_statement_quality_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  stage TEXT NOT NULL
    CHECK (stage IN ('upload', 'detect', 'extract', 'map', 'validate', 'repair', 'readiness', 'confirm', 'benchmark')),
  result_status TEXT NOT NULL
    CHECK (result_status IN ('pass', 'warning', 'fail', 'info')),
  readiness_status TEXT
    CHECK (readiness_status IN ('pending', 'recoverable', 'ready', 'rejected')),
  strategy TEXT,
  summary TEXT,
  reason_codes TEXT,
  payload_json TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (statement_id) REFERENCES financial_statements(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fsqr_statement_stage ON financial_statement_quality_runs(statement_id, stage, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fsqr_org_stage ON financial_statement_quality_runs(organization_id, stage, created_at DESC);

CREATE TABLE IF NOT EXISTS financial_statement_value_versions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_id TEXT NOT NULL,
  version_no INTEGER NOT NULL,
  source_stage TEXT NOT NULL,
  values_json TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(statement_id, version_no),
  FOREIGN KEY (statement_id) REFERENCES financial_statements(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fsvv_statement ON financial_statement_value_versions(statement_id, version_no DESC);

CREATE TABLE IF NOT EXISTS financial_statement_line_aliases (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL DEFAULT '',
  statement_line_id TEXT NOT NULL,
  statement_type TEXT NOT NULL CHECK (statement_type IN ('P&L', 'BS', 'CF')),
  alias_text TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  template_family TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'learned'
    CHECK (source IN ('seed', 'learned', 'manual')),
  usage_count INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, statement_line_id, normalized_alias, template_family),
  FOREIGN KEY (statement_line_id) REFERENCES financial_statement_lines(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fsla_lookup ON financial_statement_line_aliases(statement_type, normalized_alias, template_family);

CREATE TABLE IF NOT EXISTS financial_statement_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL DEFAULT '',
  template_family TEXT NOT NULL,
  template_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  matcher_terms TEXT,
  document_class TEXT NOT NULL DEFAULT 'unknown'
    CHECK (document_class IN ('unknown', 'native_pdf', 'scan_pdf', 'spreadsheet', 'csv', 'mixed_report')),
  extraction_strategy TEXT,
  is_system BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_fst_template_lookup ON financial_statement_templates(template_family, template_key);
