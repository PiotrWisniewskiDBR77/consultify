-- FIN-MVP-CUTOVER / ECO-W29
-- Canonical negotiation-pack snapshot and immutable command receipt.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.finance_valuation_negotiation_packs') IS NOT NULL
     OR to_regclass('public.finance_valuation_negotiation_pack_receipts') IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgname = 'trg_finance_valuation_negotiation_pack_receipts_immutable'
         AND NOT tgisinternal
     ) THEN
    RAISE EXCEPTION 'ECO-W29 owned migration identity already exists';
  END IF;
END $$;

CREATE TABLE finance_valuation_negotiation_packs (
  organization_id TEXT NOT NULL,
  legacy_valuation_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  business_version_id TEXT NOT NULL,
  source_working_revision_id TEXT NOT NULL,
  source_working_revision_version INTEGER NOT NULL CHECK (source_working_revision_version >= 1),
  source_result_sha256 TEXT NOT NULL CHECK (source_result_sha256 ~ '^[0-9a-f]{64}$'),
  pack_json JSONB NOT NULL CHECK (jsonb_typeof(pack_json) = 'object'),
  generated_by TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, business_version_id),
  UNIQUE (organization_id, legacy_valuation_id),
  FOREIGN KEY (legacy_valuation_id, organization_id) REFERENCES valuations(id, organization_id),
  FOREIGN KEY (artifact_id, organization_id) REFERENCES finance_artifacts(artifact_id, organization_id),
  FOREIGN KEY (business_version_id, organization_id) REFERENCES finance_business_versions(business_version_id, organization_id),
  FOREIGN KEY (source_working_revision_id, organization_id) REFERENCES finance_working_revisions(working_revision_id, organization_id)
);

CREATE TABLE finance_valuation_negotiation_pack_receipts (
  organization_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  legacy_valuation_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  business_version_id TEXT NOT NULL,
  working_revision_id TEXT NOT NULL,
  working_revision_version INTEGER NOT NULL CHECK (working_revision_version >= 1),
  source_result_sha256 TEXT NOT NULL CHECK (source_result_sha256 ~ '^[0-9a-f]{64}$'),
  response_json JSONB NOT NULL CHECK (jsonb_typeof(response_json) = 'object'),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, idempotency_key),
  FOREIGN KEY (legacy_valuation_id, organization_id) REFERENCES valuations(id, organization_id),
  FOREIGN KEY (artifact_id, organization_id) REFERENCES finance_artifacts(artifact_id, organization_id),
  FOREIGN KEY (business_version_id, organization_id) REFERENCES finance_business_versions(business_version_id, organization_id),
  FOREIGN KEY (working_revision_id, organization_id) REFERENCES finance_working_revisions(working_revision_id, organization_id),
  FOREIGN KEY (organization_id, business_version_id) REFERENCES finance_valuation_negotiation_packs(organization_id, business_version_id)
);

CREATE TRIGGER trg_finance_valuation_negotiation_pack_receipts_immutable
  BEFORE UPDATE OR DELETE ON finance_valuation_negotiation_pack_receipts
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_command_ledger_immutable();

COMMIT;
