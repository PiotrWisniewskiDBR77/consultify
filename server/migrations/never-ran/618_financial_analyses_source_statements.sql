-- Migration 618: link financial_analyses to financial_statements (T052 ↔ T050)
-- Adds source_statement_ids for SSOT traceability and rebuild capability.

ALTER TABLE financial_analyses
  ADD COLUMN IF NOT EXISTS source_statement_ids JSONB DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_financial_analyses_source_statements
  ON financial_analyses USING GIN (source_statement_ids);

