BEGIN;

CREATE TABLE finance_baseline_workspace_contexts (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  business_version_id TEXT PRIMARY KEY,
  source_statement_version_id TEXT NOT NULL,
  source_analysis_version_id TEXT NOT NULL,
  entity_id TEXT NOT NULL REFERENCES finance_stmt_entities(id),
  opening_balance_sheet_period_id TEXT NOT NULL REFERENCES finance_stmt_periods(period_id),
  forecast_period_ids JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  configured_by TEXT NOT NULL REFERENCES users(id),
  configured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_finance_baseline_workspace_context_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),
  CONSTRAINT fk_finance_baseline_workspace_context_statement_org
    FOREIGN KEY (source_statement_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),
  CONSTRAINT fk_finance_baseline_workspace_context_analysis_org
    FOREIGN KEY (source_analysis_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),
  CONSTRAINT uq_finance_baseline_workspace_context_bv_org
    UNIQUE (business_version_id, organization_id),
  CONSTRAINT chk_finance_baseline_workspace_context_periods
    CHECK (jsonb_typeof(forecast_period_ids) = 'array' AND jsonb_array_length(forecast_period_ids) > 0)
);

CREATE TABLE finance_baseline_context_command_receipts (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  business_version_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) > 0),
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  response_json JSONB NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, business_version_id, idempotency_key),
  CONSTRAINT fk_finance_baseline_context_receipt_context
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_baseline_workspace_contexts (business_version_id, organization_id)
);

CREATE FUNCTION finance_baseline_context_receipt_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER trg_finance_baseline_context_receipt_immutable
  BEFORE UPDATE OR DELETE ON finance_baseline_context_command_receipts
  FOR EACH ROW EXECUTE FUNCTION finance_baseline_context_receipt_immutable();

COMMIT;
