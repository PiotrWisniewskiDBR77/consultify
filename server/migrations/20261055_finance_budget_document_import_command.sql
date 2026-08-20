-- FIN-MVP-CUTOVER / ECO-W39
-- Atomic, provenance-bound import of document values into canonical Budget lines.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.finance_budget_document_import_receipts') IS NOT NULL
     OR to_regprocedure('public.finance_budget_document_import_receipt_immutable()') IS NOT NULL THEN
    RAISE EXCEPTION 'ECO-W39 owned migration identity already exists';
  END IF;
END $$;

CREATE TABLE finance_budget_document_import_receipts (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  budget_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  source_file_sha256 TEXT NOT NULL CHECK (source_file_sha256 ~ '^[0-9a-f]{64}$'),
  extracted_text_sha256 TEXT NOT NULL CHECK (extracted_text_sha256 ~ '^[0-9a-f]{64}$'),
  source_file_name TEXT NOT NULL CHECK (length(btrim(source_file_name)) BETWEEN 1 AND 255),
  source_mime_type TEXT NOT NULL CHECK (length(btrim(source_mime_type)) BETWEEN 1 AND 200),
  source_file_size INTEGER NOT NULL CHECK (source_file_size BETWEEN 1 AND 52428800),
  expected_budget_version INTEGER NOT NULL CHECK (expected_budget_version >= 1),
  applied_budget_version INTEGER NOT NULL CHECK (applied_budget_version = expected_budget_version + 1),
  notation_profile_json JSONB NOT NULL CHECK (jsonb_typeof(notation_profile_json)='object'),
  response_json JSONB NOT NULL CHECK (jsonb_typeof(response_json)='object'),
  imported_by TEXT NOT NULL REFERENCES users(id),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,budget_id,idempotency_key),
  CONSTRAINT fk_finance_budget_document_import_budget_org
    FOREIGN KEY (budget_id,organization_id) REFERENCES budgets(id,organization_id)
);

CREATE FUNCTION finance_budget_document_import_receipt_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'finance budget document import receipt is immutable'; END $$;

CREATE TRIGGER trg_finance_budget_document_import_receipt_immutable
BEFORE UPDATE OR DELETE ON finance_budget_document_import_receipts
FOR EACH ROW EXECUTE FUNCTION finance_budget_document_import_receipt_immutable();

COMMIT;
