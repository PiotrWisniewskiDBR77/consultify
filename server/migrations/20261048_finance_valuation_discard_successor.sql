-- FIN-MVP-CUTOVER / ECO-W32
-- Replaces irreversible legacy DELETE with an auditable canonical discard.

BEGIN;

DO $$
DECLARE
  status_def TEXT;
BEGIN
  IF to_regclass('public.finance_valuation_discard_receipts') IS NOT NULL
     OR to_regprocedure('public.finance_valuation_discard_receipt_immutable()') IS NOT NULL
     OR to_regprocedure('public.finance_valuation_archived_immutable()') IS NOT NULL THEN
    RAISE EXCEPTION 'ECO-W32 owned migration identity already exists';
  END IF;
  SELECT pg_get_constraintdef(oid) INTO status_def
    FROM pg_constraint
   WHERE conrelid='public.valuations'::regclass AND conname='valuations_status_check';
  IF status_def IS NULL OR status_def NOT LIKE '%DRAFT%' OR status_def NOT LIKE '%REVIEW%'
     OR status_def NOT LIKE '%APPROVED%' OR status_def LIKE '%ARCHIVED%' THEN
    RAISE EXCEPTION 'ECO-W32 valuations status contract is incompatible: %', status_def;
  END IF;
END $$;

ALTER TABLE valuations DROP CONSTRAINT valuations_status_check;
ALTER TABLE valuations ADD CONSTRAINT valuations_status_check
  CHECK (status IN ('DRAFT','REVIEW','APPROVED','ARCHIVED'));

CREATE TABLE finance_valuation_discard_receipts (
  organization_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  legacy_valuation_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  business_version_id TEXT NOT NULL,
  working_revision_id TEXT NOT NULL,
  working_revision_version INTEGER NOT NULL CHECK (working_revision_version >= 1),
  prior_status TEXT NOT NULL CHECK (prior_status IN ('DRAFT','REVIEW')),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  response_json JSONB NOT NULL CHECK (jsonb_typeof(response_json)='object'),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,idempotency_key),
  UNIQUE (organization_id,legacy_valuation_id),
  FOREIGN KEY (legacy_valuation_id,organization_id) REFERENCES valuations(id,organization_id),
  FOREIGN KEY (artifact_id,organization_id) REFERENCES finance_artifacts(artifact_id,organization_id),
  FOREIGN KEY (business_version_id,organization_id) REFERENCES finance_business_versions(business_version_id,organization_id),
  FOREIGN KEY (working_revision_id,organization_id) REFERENCES finance_working_revisions(working_revision_id,organization_id)
);

CREATE FUNCTION finance_valuation_discard_receipt_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'finance valuation discard receipt is immutable';
END $$;

CREATE TRIGGER trg_finance_valuation_discard_receipt_immutable
BEFORE UPDATE OR DELETE ON finance_valuation_discard_receipts
FOR EACH ROW EXECUTE FUNCTION finance_valuation_discard_receipt_immutable();

CREATE FUNCTION finance_valuation_archived_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='ARCHIVED' THEN
    RAISE EXCEPTION 'archived valuation is immutable';
  END IF;
  IF TG_OP='DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_finance_valuation_archived_immutable
BEFORE UPDATE OR DELETE ON valuations
FOR EACH ROW EXECUTE FUNCTION finance_valuation_archived_immutable();

COMMIT;
