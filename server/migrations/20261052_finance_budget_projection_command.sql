-- FIN-MVP-CUTOVER / ECO-W35
-- Tenant-bound, versioned and replay-safe Budget scenario projection command.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.finance_budget_projection_command_receipts') IS NOT NULL
     OR to_regprocedure('public.finance_budget_projection_command_receipt_immutable()') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_budget_scenarios_id_budget')
     OR EXISTS (
       SELECT 1 FROM pg_trigger
        WHERE tgname='trg_finance_budget_projection_command_receipt_immutable'
          AND NOT tgisinternal
     ) THEN
    RAISE EXCEPTION 'ECO-W35 owned migration identity already exists';
  END IF;
END $$;

ALTER TABLE budget_scenarios
  ADD CONSTRAINT uq_budget_scenarios_id_budget UNIQUE (id,budget_id);

CREATE TABLE finance_budget_projection_command_receipts (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  budget_id TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  projection_sha256 TEXT NOT NULL CHECK (projection_sha256 ~ '^[0-9a-f]{64}$'),
  expected_budget_version INTEGER NOT NULL CHECK (expected_budget_version >= 1),
  applied_budget_version INTEGER NOT NULL CHECK (applied_budget_version >= 2),
  response_json JSONB NOT NULL CHECK (jsonb_typeof(response_json)='object'),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,budget_id,idempotency_key),
  CONSTRAINT fk_finance_budget_projection_budget_org
    FOREIGN KEY (budget_id,organization_id) REFERENCES budgets(id,organization_id),
  CONSTRAINT fk_finance_budget_projection_scenario_budget
    FOREIGN KEY (scenario_id,budget_id) REFERENCES budget_scenarios(id,budget_id),
  CONSTRAINT ck_finance_budget_projection_versions
    CHECK (applied_budget_version = expected_budget_version + 1)
);

CREATE FUNCTION finance_budget_projection_command_receipt_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'finance budget projection command receipt is immutable';
END $$;

CREATE TRIGGER trg_finance_budget_projection_command_receipt_immutable
BEFORE UPDATE OR DELETE ON finance_budget_projection_command_receipts
FOR EACH ROW EXECUTE FUNCTION finance_budget_projection_command_receipt_immutable();

COMMIT;
