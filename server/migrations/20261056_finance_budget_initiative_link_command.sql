-- FIN-MVP-CUTOVER / ECO-W40
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.finance_budget_initiative_link_receipts') IS NOT NULL
     OR to_regprocedure('public.finance_budget_initiative_link_receipt_immutable()') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN
       ('fk_budget_initiative_links_budget_org','fk_budget_initiative_links_initiative_org'))
     OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='initiatives' AND column_name IN ('estimated_revenue_uplift','estimated_cost_savings','estimated_capex')) THEN
    RAISE EXCEPTION 'ECO-W40 owned migration identity already exists';
  END IF;
  IF EXISTS (
    SELECT 1 FROM budget_initiative_links l
    LEFT JOIN budgets b ON b.id=l.budget_id AND b.organization_id=l.organization_id
    LEFT JOIN initiatives i ON i.id=l.initiative_id AND i.organization_id=l.organization_id
    WHERE b.id IS NULL OR i.id IS NULL
  ) THEN
    RAISE EXCEPTION 'ECO-W40 hostile cross-tenant or orphan budget initiative link exists';
  END IF;
END $$;

ALTER TABLE initiatives
  ADD COLUMN estimated_revenue_uplift NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN estimated_cost_savings NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN estimated_capex NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE budget_initiative_links
  ADD CONSTRAINT fk_budget_initiative_links_budget_org
    FOREIGN KEY (budget_id,organization_id) REFERENCES budgets(id,organization_id),
  ADD CONSTRAINT fk_budget_initiative_links_initiative_org
    FOREIGN KEY (initiative_id,organization_id) REFERENCES initiatives(id,organization_id);

CREATE TABLE finance_budget_initiative_link_receipts (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  budget_id TEXT NOT NULL,
  initiative_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  expected_budget_version INTEGER NOT NULL CHECK (expected_budget_version >= 1),
  applied_budget_version INTEGER NOT NULL CHECK (applied_budget_version=expected_budget_version+1),
  snapshot_json JSONB NOT NULL CHECK (jsonb_typeof(snapshot_json)='object'),
  response_json JSONB NOT NULL CHECK (jsonb_typeof(response_json)='object'),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,budget_id,idempotency_key),
  FOREIGN KEY (budget_id,organization_id) REFERENCES budgets(id,organization_id),
  FOREIGN KEY (initiative_id,organization_id) REFERENCES initiatives(id,organization_id)
);

CREATE FUNCTION finance_budget_initiative_link_receipt_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'finance budget initiative link receipt is immutable'; END $$;
CREATE TRIGGER trg_finance_budget_initiative_link_receipt_immutable
BEFORE UPDATE OR DELETE ON finance_budget_initiative_link_receipts
FOR EACH ROW EXECUTE FUNCTION finance_budget_initiative_link_receipt_immutable();
COMMIT;
