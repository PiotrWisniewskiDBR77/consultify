-- FIN-MVP-CUTOVER / ECO-W41
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.finance_budget_initiative_unlink_receipts') IS NOT NULL
     OR to_regprocedure('public.finance_budget_initiative_unlink_receipt_immutable()') IS NOT NULL THEN
    RAISE EXCEPTION 'ECO-W41 owned migration identity already exists';
  END IF;
END $$;

CREATE TABLE finance_budget_initiative_unlink_receipts (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  budget_id TEXT NOT NULL,
  initiative_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  expected_budget_version INTEGER NOT NULL CHECK (expected_budget_version >= 1),
  applied_budget_version INTEGER NOT NULL CHECK (applied_budget_version=expected_budget_version+1),
  removed_link_snapshot_json JSONB NOT NULL CHECK (jsonb_typeof(removed_link_snapshot_json)='object'),
  response_json JSONB NOT NULL CHECK (jsonb_typeof(response_json)='object'),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,budget_id,idempotency_key),
  FOREIGN KEY (budget_id,organization_id) REFERENCES budgets(id,organization_id),
  FOREIGN KEY (initiative_id,organization_id) REFERENCES initiatives(id,organization_id)
);

CREATE FUNCTION finance_budget_initiative_unlink_receipt_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'finance budget initiative unlink receipt is immutable'; END $$;
CREATE TRIGGER trg_finance_budget_initiative_unlink_receipt_immutable
BEFORE UPDATE OR DELETE ON finance_budget_initiative_unlink_receipts
FOR EACH ROW EXECUTE FUNCTION finance_budget_initiative_unlink_receipt_immutable();

COMMIT;
