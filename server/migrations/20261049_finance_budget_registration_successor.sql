-- FIN-MVP-CUTOVER / ECO-W33
-- One replay-safe registration command for the authoritative Budget aggregate.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
       SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='budgets'
          AND column_name IN ('source_tool_session_id','registration_request_sha256')
     )
     OR to_regclass('public.finance_budget_registration_receipts') IS NOT NULL
     OR to_regprocedure('public.finance_budget_registration_receipt_immutable()') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_budgets_id_org')
     OR EXISTS (
       SELECT 1 FROM pg_trigger
        WHERE tgname='trg_finance_budget_registration_receipt_immutable'
          AND NOT tgisinternal
     ) THEN
    RAISE EXCEPTION 'ECO-W33 owned migration identity already exists';
  END IF;
END $$;

ALTER TABLE budgets
  ADD COLUMN source_tool_session_id TEXT,
  ADD COLUMN registration_request_sha256 TEXT,
  ADD CONSTRAINT uq_budgets_id_org UNIQUE (id,organization_id),
  ADD CONSTRAINT fk_budgets_source_tool_session
    FOREIGN KEY (source_tool_session_id) REFERENCES tool_sessions(id),
  ADD CONSTRAINT ck_budgets_registration_sha
    CHECK (registration_request_sha256 IS NULL OR registration_request_sha256 ~ '^[0-9a-f]{64}$');

CREATE TABLE finance_budget_registration_receipts (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  idempotency_key TEXT NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  budget_id TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('manual','tool_session')),
  source_tool_session_id TEXT REFERENCES tool_sessions(id),
  response_json JSONB NOT NULL CHECK (jsonb_typeof(response_json)='object'),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,idempotency_key),
  UNIQUE (organization_id,budget_id),
  CONSTRAINT fk_finance_budget_registration_budget_org
    FOREIGN KEY (budget_id,organization_id) REFERENCES budgets(id,organization_id),
  CONSTRAINT ck_finance_budget_registration_source
    CHECK ((source_kind='manual' AND source_tool_session_id IS NULL)
        OR (source_kind='tool_session' AND source_tool_session_id IS NOT NULL))
);

CREATE FUNCTION finance_budget_registration_receipt_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'finance budget registration receipt is immutable';
END $$;

CREATE TRIGGER trg_finance_budget_registration_receipt_immutable
BEFORE UPDATE OR DELETE ON finance_budget_registration_receipts
FOR EACH ROW EXECUTE FUNCTION finance_budget_registration_receipt_immutable();

COMMIT;
