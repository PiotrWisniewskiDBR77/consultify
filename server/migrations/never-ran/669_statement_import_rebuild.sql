-- ============================================
-- Migration 669 — Statement Import Rebuild
-- Durable ingest runs, source artifacts, candidate rows, and repair sessions
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS financial_statement_ingest_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
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
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (statement_id) REFERENCES financial_statements(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fsir_statement_started
  ON financial_statement_ingest_runs(statement_id, started_at DESC);

CREATE TABLE IF NOT EXISTS financial_statement_source_artifacts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_id TEXT NOT NULL,
  ingest_run_id TEXT,
  artifact_type TEXT NOT NULL,
  stage TEXT NOT NULL,
  version_no INTEGER NOT NULL DEFAULT 1,
  content_text TEXT,
  content_json TEXT,
  metadata_json TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (statement_id) REFERENCES financial_statements(id) ON DELETE CASCADE,
  FOREIGN KEY (ingest_run_id) REFERENCES financial_statement_ingest_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fssa_statement_stage
  ON financial_statement_source_artifacts(statement_id, stage, created_at DESC);

CREATE TABLE IF NOT EXISTS financial_statement_extracted_sections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_id TEXT NOT NULL,
  ingest_run_id TEXT,
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (statement_id) REFERENCES financial_statements(id) ON DELETE CASCADE,
  FOREIGN KEY (ingest_run_id) REFERENCES financial_statement_ingest_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fses_statement_section
  ON financial_statement_extracted_sections(statement_id, section_key, created_at DESC);

CREATE TABLE IF NOT EXISTS financial_statement_candidate_rows (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_id TEXT NOT NULL,
  ingest_run_id TEXT,
  section_id TEXT,
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (statement_id) REFERENCES financial_statements(id) ON DELETE CASCADE,
  FOREIGN KEY (ingest_run_id) REFERENCES financial_statement_ingest_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES financial_statement_extracted_sections(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fscr_statement_row
  ON financial_statement_candidate_rows(statement_id, source_row, created_at DESC);

CREATE TABLE IF NOT EXISTS financial_statement_mapping_candidates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_id TEXT NOT NULL,
  ingest_run_id TEXT,
  candidate_row_id TEXT,
  canonical_line_id TEXT,
  score REAL DEFAULT 0,
  match_reason TEXT,
  is_selected BOOLEAN DEFAULT FALSE,
  selected_by TEXT DEFAULT 'system',
  metadata_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (statement_id) REFERENCES financial_statements(id) ON DELETE CASCADE,
  FOREIGN KEY (ingest_run_id) REFERENCES financial_statement_ingest_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_row_id) REFERENCES financial_statement_candidate_rows(id) ON DELETE CASCADE,
  FOREIGN KEY (canonical_line_id) REFERENCES financial_statement_lines(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fsmc_statement_selected
  ON financial_statement_mapping_candidates(statement_id, is_selected, created_at DESC);

CREATE TABLE IF NOT EXISTS financial_statement_repair_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  ingest_run_id TEXT,
  repair_status TEXT NOT NULL DEFAULT 'open'
    CHECK (repair_status IN ('open', 'applied', 'dismissed')),
  summary TEXT,
  payload_json TEXT,
  started_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (statement_id) REFERENCES financial_statements(id) ON DELETE CASCADE,
  FOREIGN KEY (ingest_run_id) REFERENCES financial_statement_ingest_runs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fsrs_statement_status
  ON financial_statement_repair_sessions(statement_id, repair_status, created_at DESC);
