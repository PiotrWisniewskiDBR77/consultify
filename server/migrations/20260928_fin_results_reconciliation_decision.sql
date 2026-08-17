-- DEC-FIN-RESULTS-RECONCILIATION-001 (approved restricted scope).
-- Additive late-upgrade safe policy stamp for Finance proposals/disputes.
-- Results Actual stores remain governed by the existing append-only triggers.

ALTER TABLE rvn_roi_finance_reconciliations
  ADD COLUMN IF NOT EXISTS reconciliation_kind TEXT NOT NULL DEFAULT 'dispute',
  ADD COLUMN IF NOT EXISTS materiality_threshold_pct NUMERIC NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS decision_policy_version TEXT NOT NULL DEFAULT 'DEC-FIN-RESULTS-RECONCILIATION-001/v1',
  ADD COLUMN IF NOT EXISTS decision_policy_digest TEXT NOT NULL DEFAULT 'sha256:a0b04a2bcd42d9fa8a2680f0dd35008f4226bc92db5ecc63756732d7a8854e6d',
  ADD COLUMN IF NOT EXISTS terminal_decision_id UUID NULL,
  ADD COLUMN IF NOT EXISTS terminal_decision_version INTEGER NULL,
  ADD COLUMN IF NOT EXISTS terminal_decision_status TEXT NULL,
  ADD COLUMN IF NOT EXISTS request_fingerprint TEXT NULL,
  ADD COLUMN IF NOT EXISTS request_actor_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'rvn_roi_finance_reconciliations'::regclass
       AND conname = 'rvn_roi_finance_reconciliations_kind_check'
  ) THEN
    ALTER TABLE rvn_roi_finance_reconciliations
      ADD CONSTRAINT rvn_roi_finance_reconciliations_kind_check
      CHECK (reconciliation_kind IN ('proposal', 'dispute'));
  END IF;
END $$;

ALTER TABLE rvn_roi_finance_reconciliations
  DROP CONSTRAINT IF EXISTS rvn_roi_finance_reconciliations_policy_check;
ALTER TABLE rvn_roi_finance_reconciliations
  ADD CONSTRAINT rvn_roi_finance_reconciliations_policy_check CHECK (
    materiality_threshold_pct = 5
    AND decision_policy_version = 'DEC-FIN-RESULTS-RECONCILIATION-001/v1'
    AND decision_policy_digest = 'sha256:a0b04a2bcd42d9fa8a2680f0dd35008f4226bc92db5ecc63756732d7a8854e6d'
    AND abs(finance_value - roi_value) > CASE WHEN abs(roi_value) = 0 THEN 0 ELSE abs(roi_value) * .05 END
  );
CREATE UNIQUE INDEX IF NOT EXISTS uq_rvn_fin_reconciliation_idempotency
  ON rvn_roi_finance_reconciliations (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION rvn_fin_reconciliation_immutable_proposal_fields()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.case_id IS DISTINCT FROM OLD.case_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.finance_link_id IS DISTINCT FROM OLD.finance_link_id
     OR NEW.roi_value IS DISTINCT FROM OLD.roi_value
     OR NEW.finance_value IS DISTINCT FROM OLD.finance_value
     OR NEW.reconciliation_kind IS DISTINCT FROM OLD.reconciliation_kind
     OR NEW.materiality_threshold_pct IS DISTINCT FROM OLD.materiality_threshold_pct
     OR NEW.decision_policy_version IS DISTINCT FROM OLD.decision_policy_version
     OR NEW.decision_policy_digest IS DISTINCT FROM OLD.decision_policy_digest
     OR NEW.opened_by IS DISTINCT FROM OLD.opened_by
     OR NEW.opened_at IS DISTINCT FROM OLD.opened_at THEN
    RAISE EXCEPTION 'Finance reconciliation proposal/dispute facts are immutable; resolve by versioned status decision only';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_rvn_fin_reconciliation_immutable_proposal_fields
  ON rvn_roi_finance_reconciliations;
CREATE TRIGGER trg_rvn_fin_reconciliation_immutable_proposal_fields
  BEFORE UPDATE ON rvn_roi_finance_reconciliations
  FOR EACH ROW EXECUTE FUNCTION rvn_fin_reconciliation_immutable_proposal_fields();

CREATE OR REPLACE FUNCTION rvn_fin_reconciliation_state_machine()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('resolved','accepted_divergence') THEN
    RAISE EXCEPTION 'Terminal Finance reconciliation cannot transition';
  END IF;
  IF NEW.status NOT IN ('investigating','resolved','accepted_divergence') THEN
    RAISE EXCEPTION 'Invalid Finance reconciliation state transition';
  END IF;
  IF NEW.status IN ('resolved','accepted_divergence') AND
     (NEW.terminal_decision_id IS NULL OR NEW.terminal_decision_version IS NULL OR NEW.terminal_decision_status <> NEW.status) THEN
    RAISE EXCEPTION 'Terminal Finance reconciliation requires its exact decision pointer';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_rvn_fin_reconciliation_state_machine ON rvn_roi_finance_reconciliations;
CREATE TRIGGER trg_rvn_fin_reconciliation_state_machine
  BEFORE UPDATE ON rvn_roi_finance_reconciliations
  FOR EACH ROW EXECUTE FUNCTION rvn_fin_reconciliation_state_machine();

-- Governed append-only ledger. Authorization is the latest event only;
-- application role/wildcard never substitutes for an explicit active grant.
CREATE TABLE IF NOT EXISTS rvn_finance_reconciliation_grant_events (
  grant_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL,
  capability TEXT NOT NULL DEFAULT 'results.roi.finance_reconciliation.resolve'
    CHECK (capability = 'results.roi.finance_reconciliation.resolve'),
  grant_version INTEGER NOT NULL CHECK (grant_version > 0),
  action TEXT NOT NULL CHECK (action IN ('granted','revoked')),
  acted_by TEXT NOT NULL,
  receipt_id UUID NOT NULL DEFAULT gen_random_uuid(),
  policy_version TEXT NOT NULL CHECK (policy_version = 'DEC-FIN-RESULTS-RECONCILIATION-001/v1'),
  policy_digest TEXT NOT NULL CHECK (policy_digest = 'sha256:a0b04a2bcd42d9fa8a2680f0dd35008f4226bc92db5ecc63756732d7a8854e6d'),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, capability, grant_version),
  UNIQUE (receipt_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rvn_fin_reconciliation_org
  ON rvn_roi_finance_reconciliations(reconciliation_id, organization_id);

CREATE TABLE IF NOT EXISTS rvn_finance_reconciliation_decisions (
  decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id UUID NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  decision_version INTEGER NOT NULL,
  decision_status TEXT NOT NULL CHECK (decision_status IN ('resolved','accepted_divergence')),
  resolution_notes TEXT NULL,
  decided_by TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decision_policy_version TEXT NOT NULL,
  decision_policy_digest TEXT NOT NULL,
  UNIQUE (reconciliation_id),
  UNIQUE (decision_id, reconciliation_id, organization_id, decision_version, decision_status, decision_policy_version, decision_policy_digest),
  FOREIGN KEY (reconciliation_id, organization_id)
    REFERENCES rvn_roi_finance_reconciliations(reconciliation_id, organization_id) ON DELETE RESTRICT
);

ALTER TABLE rvn_roi_finance_reconciliations
  DROP CONSTRAINT IF EXISTS rvn_roi_finance_reconciliations_terminal_decision_fk;
ALTER TABLE rvn_roi_finance_reconciliations
  ADD CONSTRAINT rvn_roi_finance_reconciliations_terminal_decision_fk
  FOREIGN KEY (terminal_decision_id, reconciliation_id, organization_id, terminal_decision_version,
               terminal_decision_status, decision_policy_version, decision_policy_digest)
  REFERENCES rvn_finance_reconciliation_decisions
    (decision_id, reconciliation_id, organization_id, decision_version,
     decision_status, decision_policy_version, decision_policy_digest)
  ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION rvn_fin_reconciliation_decision_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Finance reconciliation terminal decisions are append-only';
END $$;
DROP TRIGGER IF EXISTS trg_rvn_fin_reconciliation_decision_append_only
  ON rvn_finance_reconciliation_decisions;
CREATE TRIGGER trg_rvn_fin_reconciliation_decision_append_only
  BEFORE UPDATE OR DELETE ON rvn_finance_reconciliation_decisions
  FOR EACH ROW EXECUTE FUNCTION rvn_fin_reconciliation_decision_append_only();

DROP TRIGGER IF EXISTS trg_rvn_fin_reconciliation_grant_append_only
  ON rvn_finance_reconciliation_grant_events;
CREATE TRIGGER trg_rvn_fin_reconciliation_grant_append_only
  BEFORE UPDATE OR DELETE ON rvn_finance_reconciliation_grant_events
  FOR EACH ROW EXECUTE FUNCTION rvn_fin_reconciliation_decision_append_only();
