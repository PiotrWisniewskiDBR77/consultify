-- V8 Finance runtime (Wave 18): escalation resolution, ingestion indexes, terminal ingest states
-- Canonical tables: v8_unreconciled_delta_escalations, v8_finance_document_ingestions
-- (Spec names v8_delta_escalations / v8_finance_ingestions map to these.)

ALTER TABLE v8_unreconciled_delta_escalations ADD COLUMN resolved_at TEXT;
ALTER TABLE v8_unreconciled_delta_escalations ADD COLUMN resolved_by TEXT;
ALTER TABLE v8_unreconciled_delta_escalations ADD COLUMN resolution TEXT;

CREATE INDEX IF NOT EXISTS idx_v8_escalations_unresolved
  ON v8_unreconciled_delta_escalations(organization_id)
  WHERE resolved_at IS NULL;

-- Allow terminal ingestion states failed/rejected (SQLite: rebuild with widened CHECK)
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

INSERT INTO v8_finance_document_ingestions__w18 (
  ingestion_id, organization_id, document_ref, recognition_confidence,
  readiness_state, first_model_ref, created_at, updated_at
)
SELECT
  ingestion_id, organization_id, document_ref, recognition_confidence,
  readiness_state, first_model_ref, created_at, updated_at
FROM v8_finance_document_ingestions;

DROP TABLE v8_finance_document_ingestions;
ALTER TABLE v8_finance_document_ingestions__w18 RENAME TO v8_finance_document_ingestions;

CREATE INDEX IF NOT EXISTS idx_v8_fin_ingest_org
  ON v8_finance_document_ingestions(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_fin_ingest_state
  ON v8_finance_document_ingestions(readiness_state, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_fin_ingest_doc
  ON v8_finance_document_ingestions(document_ref, organization_id);

CREATE INDEX IF NOT EXISTS idx_v8_ingestions_state
  ON v8_finance_document_ingestions(organization_id, readiness_state);
