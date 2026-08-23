-- FIN-MVP-CUTOVER / FS-W12
-- Replace irreversible statement-pack cascade deletion with an auditable,
-- idempotent archive command guarded by optimistic concurrency.
BEGIN;

ALTER TABLE financial_statement_packs
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1);
CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_statement_packs_id_org
  ON financial_statement_packs(id, organization_id);

CREATE TABLE finance_statement_pack_archive_command_receipts (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  pack_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  expected_version INTEGER NOT NULL CHECK (expected_version >= 1),
  archived_version INTEGER NOT NULL CHECK (archived_version = expected_version + 1),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  response_json JSONB NOT NULL CHECK (jsonb_typeof(response_json) = 'object'),
  archived_by TEXT NOT NULL REFERENCES users(id),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, pack_id, idempotency_key),
  UNIQUE (organization_id, pack_id),
  CONSTRAINT fk_finance_statement_pack_archive_org
    FOREIGN KEY (pack_id, organization_id)
    REFERENCES financial_statement_packs(id, organization_id)
);

CREATE FUNCTION finance_statement_pack_archive_receipt_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'finance statement pack archive receipt is immutable'; END $$;
CREATE TRIGGER trg_finance_statement_pack_archive_receipt_immutable
BEFORE UPDATE OR DELETE ON finance_statement_pack_archive_command_receipts
FOR EACH ROW EXECUTE FUNCTION finance_statement_pack_archive_receipt_immutable();

CREATE FUNCTION finance_statement_pack_archived_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.pack_status = 'archived' THEN
    RAISE EXCEPTION 'archived financial statement pack is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_finance_statement_pack_archived_immutable
BEFORE UPDATE OR DELETE ON financial_statement_packs
FOR EACH ROW EXECUTE FUNCTION finance_statement_pack_archived_immutable();

COMMIT;
