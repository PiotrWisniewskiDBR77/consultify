-- ECO-W13: exact, idempotent draft duplication with explicit source lineage.

-- Numeric migration 060 is absent from the PostgreSQL runner set, while the
-- mounted score routes and duplication command require this table.
CREATE TABLE IF NOT EXISTS digitization_axis_scores (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES digitization_analyses(id) ON DELETE CASCADE,
  axis_id TEXT NOT NULL,
  area_id TEXT NOT NULL,
  area_code TEXT,
  current_level INTEGER CHECK (current_level BETWEEN 0 AND 7),
  target_level INTEGER CHECK (target_level BETWEEN 0 AND 7),
  notes TEXT,
  evidence TEXT,
  justification TEXT,
  assessed_by TEXT,
  assessed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (analysis_id, axis_id, area_id)
);
CREATE INDEX IF NOT EXISTS idx_axis_scores_analysis ON digitization_axis_scores(analysis_id);
CREATE INDEX IF NOT EXISTS idx_axis_scores_axis ON digitization_axis_scores(axis_id);
CREATE INDEX IF NOT EXISTS idx_axis_scores_area ON digitization_axis_scores(area_id);

CREATE TABLE IF NOT EXISTS finance_digitization_analysis_duplicate_command_receipts (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  source_analysis_id TEXT NOT NULL REFERENCES digitization_analyses(id) ON DELETE RESTRICT,
  duplicate_analysis_id TEXT NOT NULL REFERENCES digitization_analyses(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  source_version INTEGER NOT NULL CHECK (source_version >= 1),
  response_json JSONB NOT NULL,
  commanded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, source_analysis_id, idempotency_key),
  UNIQUE (organization_id, duplicate_analysis_id)
);

CREATE OR REPLACE FUNCTION finance_digitization_analysis_duplicate_receipt_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'digitization analysis duplicate receipts are append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE TRIGGER trg_finance_digitization_analysis_duplicate_receipt_immutable
  BEFORE UPDATE OR DELETE ON finance_digitization_analysis_duplicate_command_receipts
  FOR EACH ROW EXECUTE FUNCTION finance_digitization_analysis_duplicate_receipt_immutable();
