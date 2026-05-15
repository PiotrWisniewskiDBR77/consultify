-- ============================================
-- Migration: financial_model_versions
-- Version history for financial models (T054)
-- Each approve creates a version record
-- ============================================

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
