BEGIN;

DO $$
BEGIN
  IF to_regclass('public.finance_statement_source_receipts') IS NOT NULL
     OR to_regclass('public.finance_statement_manual_mapping_decisions') IS NOT NULL
     OR to_regclass('public.finance_statement_confirmation_receipts') IS NOT NULL
     OR to_regprocedure('public.finance_statement_governance_immutable()') IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname IN (
         'uq_financial_statements_id_org',
         'uq_fin_stmt_ingest_id_statement_org',
         'uq_fin_stmt_candidate_id_statement',
         'uq_fin_stmt_pack_id_org'
       )
     )
  THEN
    RAISE EXCEPTION '20261044 hostile or partial schema identity already exists';
  END IF;
END;
$$;

ALTER TABLE financial_statements
  ADD CONSTRAINT uq_financial_statements_id_org UNIQUE (id, organization_id);
ALTER TABLE financial_statement_ingest_runs
  ADD CONSTRAINT uq_fin_stmt_ingest_id_statement_org UNIQUE (id, statement_id, organization_id);
ALTER TABLE financial_statement_candidate_rows
  ADD CONSTRAINT uq_fin_stmt_candidate_id_statement UNIQUE (id, statement_id);
ALTER TABLE financial_statement_packs
  ADD CONSTRAINT uq_fin_stmt_pack_id_org UNIQUE (id, organization_id);

CREATE TABLE finance_statement_source_receipts (
  receipt_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  statement_id TEXT NOT NULL,
  ingest_run_id TEXT,
  upload_id TEXT NOT NULL CHECK (length(trim(upload_id)) > 0),
  durable_object_id TEXT NOT NULL CHECK (length(trim(durable_object_id)) > 0),
  original_file_name TEXT NOT NULL CHECK (length(original_file_name) > 0),
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  mime_type TEXT NOT NULL CHECK (length(trim(mime_type)) > 0),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('UPLOAD','CONNECTOR','MANUAL_IMPORT')),
  importer_name TEXT NOT NULL CHECK (length(trim(importer_name)) > 0),
  importer_version TEXT NOT NULL CHECK (length(trim(importer_version)) > 0),
  entity_name TEXT NOT NULL CHECK (length(trim(entity_name)) > 0),
  periods_json JSONB NOT NULL CHECK (jsonb_typeof(periods_json)='array' AND jsonb_array_length(periods_json)>0),
  page_ranges_json JSONB NOT NULL CHECK (jsonb_typeof(page_ranges_json)='array'),
  imported_by TEXT NOT NULL REFERENCES users(id),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, upload_id, statement_id),
  UNIQUE (receipt_id, organization_id, statement_id),
  CONSTRAINT fk_fin_stmt_source_receipt_statement_org
    FOREIGN KEY (statement_id, organization_id)
    REFERENCES financial_statements(id, organization_id),
  CONSTRAINT fk_fin_stmt_source_receipt_ingest_owner
    FOREIGN KEY (ingest_run_id, statement_id, organization_id)
    REFERENCES financial_statement_ingest_runs(id, statement_id, organization_id)
);

CREATE INDEX idx_fin_stmt_source_receipt_object
  ON finance_statement_source_receipts(organization_id, durable_object_id);

CREATE TABLE finance_statement_manual_mapping_decisions (
  decision_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  statement_id TEXT NOT NULL,
  candidate_row_id TEXT NOT NULL,
  canonical_line_id TEXT REFERENCES financial_statement_lines(id),
  action TEXT NOT NULL CHECK (action IN ('ACCEPT','REJECT','EXCLUDE')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  model_score_snapshot NUMERIC,
  model_reason_snapshot TEXT,
  source_receipt_id TEXT NOT NULL,
  statement_values_version INTEGER NOT NULL CHECK (statement_values_version >= 0),
  idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) > 0),
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  decided_by TEXT NOT NULL REFERENCES users(id),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, idempotency_key),
  CONSTRAINT ck_fin_stmt_mapping_decision_target
    CHECK ((action='ACCEPT' AND canonical_line_id IS NOT NULL) OR
           (action IN ('REJECT','EXCLUDE') AND canonical_line_id IS NULL)),
  CONSTRAINT fk_fin_stmt_mapping_decision_statement_org
    FOREIGN KEY (statement_id, organization_id)
    REFERENCES financial_statements(id, organization_id),
  CONSTRAINT fk_fin_stmt_mapping_decision_candidate_statement
    FOREIGN KEY (candidate_row_id, statement_id)
    REFERENCES financial_statement_candidate_rows(id, statement_id),
  CONSTRAINT fk_fin_stmt_mapping_decision_receipt_org
    FOREIGN KEY (source_receipt_id, organization_id, statement_id)
    REFERENCES finance_statement_source_receipts(receipt_id, organization_id, statement_id)
);

CREATE INDEX idx_fin_stmt_mapping_decision_latest
  ON finance_statement_manual_mapping_decisions
  (organization_id, statement_id, candidate_row_id, decided_at DESC, decision_id DESC);

CREATE TABLE finance_statement_confirmation_receipts (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  statement_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) > 0),
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  source_receipt_id TEXT NOT NULL,
  statement_values_version INTEGER NOT NULL CHECK (statement_values_version >= 0),
  statement_pack_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  business_version_id TEXT NOT NULL,
  working_revision_id TEXT NOT NULL,
  response_json JSONB NOT NULL,
  confirmed_by TEXT NOT NULL REFERENCES users(id),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, idempotency_key),
  CONSTRAINT fk_fin_stmt_confirmation_statement_org
    FOREIGN KEY (statement_id, organization_id)
    REFERENCES financial_statements(id, organization_id),
  CONSTRAINT fk_fin_stmt_confirmation_pack_org
    FOREIGN KEY (statement_pack_id, organization_id)
    REFERENCES financial_statement_packs(id, organization_id),
  CONSTRAINT fk_fin_stmt_confirmation_artifact_org
    FOREIGN KEY (artifact_id, organization_id)
    REFERENCES finance_artifacts(artifact_id, organization_id),
  CONSTRAINT fk_fin_stmt_confirmation_version_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions(business_version_id, organization_id),
  CONSTRAINT fk_fin_stmt_confirmation_revision_org
    FOREIGN KEY (working_revision_id, organization_id)
    REFERENCES finance_working_revisions(working_revision_id, organization_id),
  CONSTRAINT fk_fin_stmt_confirmation_receipt_org
    FOREIGN KEY (source_receipt_id, organization_id, statement_id)
    REFERENCES finance_statement_source_receipts(receipt_id, organization_id, statement_id)
);

CREATE FUNCTION finance_statement_governance_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME USING ERRCODE='55000';
END;
$$;

CREATE TRIGGER trg_fin_stmt_source_receipt_immutable
  BEFORE UPDATE OR DELETE ON finance_statement_source_receipts
  FOR EACH ROW EXECUTE FUNCTION finance_statement_governance_immutable();
CREATE TRIGGER trg_fin_stmt_mapping_decision_immutable
  BEFORE UPDATE OR DELETE ON finance_statement_manual_mapping_decisions
  FOR EACH ROW EXECUTE FUNCTION finance_statement_governance_immutable();
CREATE TRIGGER trg_fin_stmt_confirmation_receipt_immutable
  BEFORE UPDATE OR DELETE ON finance_statement_confirmation_receipts
  FOR EACH ROW EXECUTE FUNCTION finance_statement_governance_immutable();

COMMIT;
