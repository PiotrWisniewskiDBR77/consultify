BEGIN;

-- This migration owns new identities. An unledgered partial/hostile shape is
-- never adopted or overwritten; canonical repeats are handled by the ledger.
DO $$
BEGIN
  IF to_regclass('public.finance_valuation_registration_command_receipts') IS NOT NULL
     OR to_regprocedure('public.finance_valuation_registration_receipt_immutable()') IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_finance_valuation_registration_receipt_immutable'
          AND NOT tgisinternal
     )
     OR EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_valuations_id_org')
  THEN
    RAISE EXCEPTION '20261043 hostile or partial schema identity already exists';
  END IF;
END;
$$;

ALTER TABLE valuations
  ADD CONSTRAINT uq_valuations_id_org UNIQUE (id, organization_id);

CREATE TABLE finance_valuation_registration_command_receipts (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) > 0),
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  legacy_valuation_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  business_version_id TEXT NOT NULL,
  working_revision_id TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, idempotency_key),
  CONSTRAINT fk_finance_valuation_registration_legacy_org
    FOREIGN KEY (legacy_valuation_id, organization_id) REFERENCES valuations(id, organization_id),
  CONSTRAINT fk_finance_valuation_registration_artifact_org
    FOREIGN KEY (artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id),
  CONSTRAINT fk_finance_valuation_registration_version_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),
  CONSTRAINT fk_finance_valuation_registration_revision_org
    FOREIGN KEY (working_revision_id, organization_id)
    REFERENCES finance_working_revisions (working_revision_id, organization_id)
);

CREATE FUNCTION finance_valuation_registration_receipt_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER trg_finance_valuation_registration_receipt_immutable
  BEFORE UPDATE OR DELETE ON finance_valuation_registration_command_receipts
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_registration_receipt_immutable();

COMMIT;
