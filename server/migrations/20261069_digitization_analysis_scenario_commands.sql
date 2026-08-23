-- ECO-W05/W06: optimistic, idempotent scenario authoring and activation.

CREATE TABLE IF NOT EXISTS finance_digitization_analysis_scenario_command_receipts (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  analysis_id TEXT NOT NULL REFERENCES digitization_analyses(id) ON DELETE RESTRICT,
  scenario_id TEXT NOT NULL REFERENCES analysis_financial_scenarios(id) ON DELETE RESTRICT,
  command_kind TEXT NOT NULL CHECK (command_kind IN ('UPSERT','ACTIVATE')),
  idempotency_key TEXT NOT NULL,
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  expected_version INTEGER NOT NULL CHECK (expected_version >= 1),
  resulting_version INTEGER NOT NULL CHECK (resulting_version > expected_version),
  response_json JSONB NOT NULL,
  commanded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, analysis_id, idempotency_key)
);

CREATE OR REPLACE FUNCTION finance_digitization_analysis_scenario_command_receipt_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'digitization analysis scenario command receipts are append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE TRIGGER trg_finance_digitization_analysis_scenario_command_receipt_immutable
  BEFORE UPDATE OR DELETE ON finance_digitization_analysis_scenario_command_receipts
  FOR EACH ROW EXECUTE FUNCTION finance_digitization_analysis_scenario_command_receipt_immutable();
