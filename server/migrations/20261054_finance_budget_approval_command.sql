-- FIN-MVP-CUTOVER / ECO-W37
-- Maker-checker, versioned and replay-safe Budget approval command.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.finance_budget_approval_command_receipts') IS NOT NULL
     OR to_regprocedure('public.finance_budget_approval_receipt_immutable()') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN
       ('uq_budget_snapshots_id_budget','uq_budget_snapshots_budget_version'))
     OR EXISTS (
       SELECT 1 FROM pg_trigger
        WHERE tgname='trg_finance_budget_approval_receipt_immutable'
          AND NOT tgisinternal
     ) THEN
    RAISE EXCEPTION 'ECO-W37 owned migration identity already exists';
  END IF;
END $$;

ALTER TABLE budget_snapshots
  ADD CONSTRAINT uq_budget_snapshots_id_budget UNIQUE (id,budget_id),
  ADD CONSTRAINT uq_budget_snapshots_budget_version UNIQUE (budget_id,version);

CREATE TABLE finance_budget_approval_command_receipts (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  budget_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  snapshot_sha256 TEXT NOT NULL CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  expected_budget_version INTEGER NOT NULL CHECK (expected_budget_version >= 1),
  approved_budget_version INTEGER NOT NULL CHECK (approved_budget_version >= 2),
  response_json JSONB NOT NULL CHECK (jsonb_typeof(response_json)='object'),
  approved_by TEXT NOT NULL REFERENCES users(id),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,budget_id,idempotency_key),
  UNIQUE (organization_id,budget_id),
  CONSTRAINT fk_finance_budget_approval_budget_org
    FOREIGN KEY (budget_id,organization_id) REFERENCES budgets(id,organization_id),
  CONSTRAINT fk_finance_budget_approval_snapshot_budget
    FOREIGN KEY (snapshot_id,budget_id) REFERENCES budget_snapshots(id,budget_id),
  CONSTRAINT ck_finance_budget_approval_versions
    CHECK (approved_budget_version = expected_budget_version + 1)
);

CREATE FUNCTION finance_budget_approval_receipt_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'finance budget approval receipt is immutable';
END $$;

CREATE TRIGGER trg_finance_budget_approval_receipt_immutable
BEFORE UPDATE OR DELETE ON finance_budget_approval_command_receipts
FOR EACH ROW EXECUTE FUNCTION finance_budget_approval_receipt_immutable();

COMMIT;
