CREATE TABLE IF NOT EXISTS financial_statement_packs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  entity_name TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_label TEXT,
  currency TEXT DEFAULT 'PLN',
  scaling TEXT DEFAULT 'units' CHECK (scaling IN ('units', 'thousands', 'millions', 'billions')),
  pack_status TEXT DEFAULT 'draft' CHECK (pack_status IN ('draft', 'partial', 'ready', 'confirmed', 'needs_review', 'archived')),
  pack_readiness_status TEXT DEFAULT 'pending' CHECK (pack_readiness_status IN ('pending', 'recoverable', 'ready', 'rejected')),
  pack_readiness_score REAL DEFAULT 0,
  pack_quality_summary TEXT,
  pack_quality_reason_codes TEXT,
  source_statement_count INTEGER DEFAULT 0,
  missing_statement_types TEXT,
  metadata_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fsp_org ON financial_statement_packs(organization_id);
CREATE INDEX IF NOT EXISTS idx_fsp_period ON financial_statement_packs(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_fsp_status ON financial_statement_packs(pack_status, pack_readiness_status);

CREATE TABLE IF NOT EXISTS financial_statement_lines (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS financial_statements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_name TEXT,
  statement_type TEXT NOT NULL CHECK (statement_type IN ('P&L', 'BS', 'CF')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_label TEXT,
  currency TEXT DEFAULT 'PLN',
  scaling TEXT DEFAULT 'units' CHECK (scaling IN ('units', 'thousands', 'millions', 'billions')),
  source_file_name TEXT,
  source_file_path TEXT,
  source_import_id TEXT,
  parse_method TEXT CHECK (parse_method IN ('text_extraction', 'ocr', 'manual', 'excel_import', 'csv_import')),
  overall_confidence REAL DEFAULT 0,
  validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'pass', 'warnings', 'needs_review', 'failed')),
  validation_messages TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'imported', 'mapped', 'confirmed', 'archived')),
  notes TEXT,
  created_by TEXT,
  confirmed_by TEXT,
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fs_org ON financial_statements(organization_id);
CREATE INDEX IF NOT EXISTS idx_fs_type ON financial_statements(statement_type);
CREATE INDEX IF NOT EXISTS idx_fs_period ON financial_statements(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_fs_status ON financial_statements(status);

CREATE TABLE IF NOT EXISTS financial_statement_values (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_id TEXT NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
  canonical_line_id TEXT REFERENCES financial_statement_lines(id),
  original_label TEXT,
  value REAL,
  confidence REAL DEFAULT 0,
  source_page INTEGER,
  source_row INTEGER,
  is_manually_corrected BOOLEAN DEFAULT FALSE,
  corrected_by TEXT,
  corrected_at TIMESTAMP,
  mapping_status TEXT DEFAULT 'auto' CHECK (mapping_status IN ('auto', 'suggested', 'manual', 'unmapped')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fsv_statement ON financial_statement_values(statement_id);
CREATE INDEX IF NOT EXISTS idx_fsv_line ON financial_statement_values(canonical_line_id);

CREATE TABLE IF NOT EXISTS financial_statement_ingest_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_id TEXT NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  run_status TEXT NOT NULL DEFAULT 'running'
    CHECK (run_status IN ('running', 'completed', 'failed', 'cancelled')),
  current_stage TEXT NOT NULL DEFAULT 'upload',
  source_file_name TEXT,
  source_file_path TEXT,
  parse_method TEXT,
  document_class TEXT,
  extraction_strategy TEXT,
  template_family TEXT,
  raw_text_length INTEGER DEFAULT 0,
  latest_reason_codes TEXT,
  summary_json TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  created_by TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fsir_statement_started
  ON financial_statement_ingest_runs(statement_id, started_at DESC);

CREATE TABLE IF NOT EXISTS financial_statement_extracted_sections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_id TEXT NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
  ingest_run_id TEXT REFERENCES financial_statement_ingest_runs(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  section_label TEXT,
  statement_type TEXT,
  source_page_start INTEGER,
  source_page_end INTEGER,
  line_start INTEGER,
  line_end INTEGER,
  confidence REAL DEFAULT 0,
  text_excerpt TEXT,
  metadata_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fses_statement_section
  ON financial_statement_extracted_sections(statement_id, section_key, created_at DESC);

CREATE TABLE IF NOT EXISTS financial_statement_candidate_rows (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_id TEXT NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
  ingest_run_id TEXT REFERENCES financial_statement_ingest_runs(id) ON DELETE CASCADE,
  section_id TEXT REFERENCES financial_statement_extracted_sections(id) ON DELETE SET NULL,
  row_key TEXT,
  row_label TEXT NOT NULL,
  normalized_label TEXT,
  source_row INTEGER,
  source_page INTEGER,
  selected_period_label TEXT,
  raw_value TEXT,
  normalized_value NUMERIC,
  currency TEXT,
  scaling TEXT,
  confidence REAL DEFAULT 0,
  classification_reason TEXT,
  metadata_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fscr_statement_row
  ON financial_statement_candidate_rows(statement_id, source_row, created_at DESC);

CREATE TABLE IF NOT EXISTS financial_statement_mapping_candidates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_id TEXT NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
  ingest_run_id TEXT REFERENCES financial_statement_ingest_runs(id) ON DELETE CASCADE,
  candidate_row_id TEXT REFERENCES financial_statement_candidate_rows(id) ON DELETE CASCADE,
  canonical_line_id TEXT REFERENCES financial_statement_lines(id) ON DELETE SET NULL,
  score REAL DEFAULT 0,
  match_reason TEXT,
  is_selected BOOLEAN DEFAULT FALSE,
  selected_by TEXT DEFAULT 'system',
  metadata_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fsmc_statement_selected
  ON financial_statement_mapping_candidates(statement_id, is_selected, created_at DESC);

ALTER TABLE financial_statements
  ADD COLUMN IF NOT EXISTS statement_pack_id TEXT REFERENCES financial_statement_packs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fs_pack_id ON financial_statements(statement_pack_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fs_pack_active_type
  ON financial_statements(statement_pack_id, statement_type)
  WHERE statement_pack_id IS NOT NULL AND COALESCE(status, 'draft') <> 'archived';

ALTER TABLE financial_models
  ADD COLUMN IF NOT EXISTS source_statement_pack_id TEXT REFERENCES financial_statement_packs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fm_source_pack ON financial_models(source_statement_pack_id);

CREATE TABLE IF NOT EXISTS financial_analyses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','REVIEW','APPROVED')),
  analysis_type TEXT DEFAULT 'comprehensive',
  periods JSONB DEFAULT '[]',
  statement_data JSONB DEFAULT '{}',
  currency TEXT DEFAULT 'PLN',
  approved_by TEXT,
  approved_at TIMESTAMP,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_analyses_org ON financial_analyses(organization_id);
CREATE INDEX IF NOT EXISTS idx_financial_analyses_status ON financial_analyses(status);

ALTER TABLE financial_analyses
  ADD COLUMN IF NOT EXISTS source_statement_pack_id TEXT REFERENCES financial_statement_packs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fa_source_pack ON financial_analyses(source_statement_pack_id);
