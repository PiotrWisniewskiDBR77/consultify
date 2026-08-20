-- FIN-MVP-CUTOVER / ECO-W38
-- Replace irreversible Budget deletion with an auditable DRAFT-only archive.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.finance_budget_discard_command_receipts') IS NOT NULL
     OR to_regprocedure('public.finance_budget_discard_receipt_immutable()') IS NOT NULL
     OR to_regprocedure('public.finance_budget_archived_immutable()') IS NOT NULL
     OR to_regprocedure('public.finance_archived_budget_child_immutable()') IS NOT NULL THEN
    RAISE EXCEPTION 'ECO-W38 owned migration identity already exists';
  END IF;
END $$;

CREATE TABLE finance_budget_discard_command_receipts (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  budget_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  expected_budget_version INTEGER NOT NULL CHECK (expected_budget_version >= 1),
  archived_budget_version INTEGER NOT NULL CHECK (archived_budget_version = expected_budget_version + 1),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  response_json JSONB NOT NULL CHECK (jsonb_typeof(response_json)='object'),
  archived_by TEXT NOT NULL REFERENCES users(id),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,budget_id,idempotency_key),
  UNIQUE (organization_id,budget_id),
  CONSTRAINT fk_finance_budget_discard_budget_org
    FOREIGN KEY (budget_id,organization_id) REFERENCES budgets(id,organization_id)
);

CREATE FUNCTION finance_budget_discard_receipt_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'finance budget discard receipt is immutable'; END $$;
CREATE TRIGGER trg_finance_budget_discard_receipt_immutable
BEFORE UPDATE OR DELETE ON finance_budget_discard_command_receipts
FOR EACH ROW EXECUTE FUNCTION finance_budget_discard_receipt_immutable();

CREATE FUNCTION finance_budget_archived_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='ARCHIVED' THEN RAISE EXCEPTION 'archived budget is immutable'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_finance_budget_archived_immutable
BEFORE UPDATE OR DELETE ON budgets
FOR EACH ROW EXECUTE FUNCTION finance_budget_archived_immutable();

CREATE FUNCTION finance_archived_budget_child_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP <> 'INSERT' AND EXISTS (
        SELECT 1 FROM budgets WHERE id=OLD.budget_id AND status='ARCHIVED'
      )) OR
     (TG_OP <> 'DELETE' AND EXISTS (
        SELECT 1 FROM budgets WHERE id=NEW.budget_id AND status='ARCHIVED'
      )) THEN
    RAISE EXCEPTION 'archived budget aggregate is immutable';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_finance_archived_budget_lines_immutable
BEFORE INSERT OR UPDATE OR DELETE ON budget_lines
FOR EACH ROW EXECUTE FUNCTION finance_archived_budget_child_immutable();
CREATE TRIGGER trg_finance_archived_budget_scenarios_immutable
BEFORE INSERT OR UPDATE OR DELETE ON budget_scenarios
FOR EACH ROW EXECUTE FUNCTION finance_archived_budget_child_immutable();
CREATE TRIGGER trg_finance_archived_budget_snapshots_immutable
BEFORE INSERT OR UPDATE OR DELETE ON budget_snapshots
FOR EACH ROW EXECUTE FUNCTION finance_archived_budget_child_immutable();
CREATE TRIGGER trg_finance_archived_budget_links_immutable
BEFORE INSERT OR UPDATE OR DELETE ON budget_initiative_links
FOR EACH ROW EXECUTE FUNCTION finance_archived_budget_child_immutable();

COMMIT;
