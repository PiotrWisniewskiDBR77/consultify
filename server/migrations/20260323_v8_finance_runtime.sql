-- V8 Finance runtime (Wave 18): escalation resolution, ingestion indexes, terminal ingest states
-- Canonical tables: v8_unreconciled_delta_escalations, v8_finance_document_ingestions
-- (Spec names v8_delta_escalations / v8_finance_ingestions map to these.)

ALTER TABLE v8_unreconciled_delta_escalations ADD COLUMN IF NOT EXISTS resolved_at TEXT;
ALTER TABLE v8_unreconciled_delta_escalations ADD COLUMN IF NOT EXISTS resolved_by TEXT;
ALTER TABLE v8_unreconciled_delta_escalations ADD COLUMN IF NOT EXISTS resolution TEXT;

CREATE INDEX IF NOT EXISTS idx_v8_escalations_unresolved
  ON v8_unreconciled_delta_escalations(organization_id)
  WHERE resolved_at IS NULL;

-- Allow terminal ingestion states failed/rejected (additive staging table for new rows)
-- DROP TABLE v8_finance_document_ingestions;   -- removed: destructive
-- ALTER TABLE v8_finance_document_ingestions__w18 RENAME TO v8_finance_document_ingestions;  -- removed: destructive

CREATE TABLE IF NOT EXISTS v8_finance_document_ingestions__w18 (
  ingestion_id            TEXT PRIMARY KEY,
  organization_id         TEXT NOT NULL,
  document_ref            TEXT NOT NULL,
  recognition_confidence  REAL CHECK (recognition_confidence IS NULL OR (recognition_confidence >= 0 AND recognition_confidence <= 1)),
  readiness_state         TEXT NOT NULL CHECK (readiness_state IN (
    'uploaded', 'recognized', 'confidence_assessed', 'ready', 'review_required',
    'failed', 'rejected'
  )),
  first_model_ref         TEXT,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v8_ingestions_state
  ON v8_finance_document_ingestions(organization_id, readiness_state);
