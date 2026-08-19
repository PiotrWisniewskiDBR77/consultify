-- FIN-MVP-RECONCILIATION-001 — pin both sides of every new reconciliation.
--
-- Historical rows deliberately remain NULL/quarantined: there is no honest
-- way to infer which immutable Results Actual snapshot or Finance working
-- revision produced an old pair of scalar values.  The application requires
-- the complete envelope for every new command after this migration.

ALTER TABLE rvn_roi_finance_reconciliations
  ADD COLUMN IF NOT EXISTS results_actual_snapshot_id UUID NULL,
  ADD COLUMN IF NOT EXISTS results_actual_sequence_number INTEGER NULL,
  ADD COLUMN IF NOT EXISTS results_actual_metric TEXT NULL,
  ADD COLUMN IF NOT EXISTS finance_artifact_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS finance_business_version_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS finance_working_revision_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS finance_content_semantic_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS finance_tracked_metric TEXT NULL,
  ADD COLUMN IF NOT EXISTS finance_pinned_value NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS source_identity_digest TEXT NULL;

ALTER TABLE rvn_roi_finance_reconciliations
  DROP CONSTRAINT IF EXISTS rvn_fin_reconciliation_source_envelope_check;
ALTER TABLE rvn_roi_finance_reconciliations
  ADD CONSTRAINT rvn_fin_reconciliation_source_envelope_check CHECK (
    (results_actual_snapshot_id IS NULL
      AND results_actual_sequence_number IS NULL
      AND results_actual_metric IS NULL
      AND finance_artifact_id IS NULL
      AND finance_business_version_id IS NULL
      AND finance_working_revision_id IS NULL
      AND finance_content_semantic_hash IS NULL
      AND finance_tracked_metric IS NULL
      AND finance_pinned_value IS NULL
      AND source_identity_digest IS NULL)
    OR
    (results_actual_snapshot_id IS NOT NULL
      AND results_actual_sequence_number IS NOT NULL
      AND results_actual_metric IN ('npv','simpleRoi','totalCosts','totalFinancialBenefits')
      AND finance_artifact_id IS NOT NULL
      AND finance_business_version_id IS NOT NULL
      AND finance_working_revision_id IS NOT NULL
      AND finance_content_semantic_hash IS NOT NULL
      AND finance_tracked_metric IN ('npv','simpleRoi','totalCosts','totalFinancialBenefits')
      AND finance_tracked_metric = results_actual_metric
      AND finance_pinned_value IS NOT NULL
      AND finance_pinned_value IS NOT DISTINCT FROM finance_value
      AND source_identity_digest IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_rvn_fin_reconciliation_source_digest
  ON rvn_roi_finance_reconciliations (organization_id, source_identity_digest)
  WHERE source_identity_digest IS NOT NULL;

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
     OR NEW.opened_at IS DISTINCT FROM OLD.opened_at
     OR NEW.results_actual_snapshot_id IS DISTINCT FROM OLD.results_actual_snapshot_id
     OR NEW.results_actual_sequence_number IS DISTINCT FROM OLD.results_actual_sequence_number
     OR NEW.results_actual_metric IS DISTINCT FROM OLD.results_actual_metric
     OR NEW.finance_artifact_id IS DISTINCT FROM OLD.finance_artifact_id
     OR NEW.finance_business_version_id IS DISTINCT FROM OLD.finance_business_version_id
     OR NEW.finance_working_revision_id IS DISTINCT FROM OLD.finance_working_revision_id
     OR NEW.finance_content_semantic_hash IS DISTINCT FROM OLD.finance_content_semantic_hash
     OR NEW.finance_tracked_metric IS DISTINCT FROM OLD.finance_tracked_metric
     OR NEW.finance_pinned_value IS DISTINCT FROM OLD.finance_pinned_value
     OR NEW.source_identity_digest IS DISTINCT FROM OLD.source_identity_digest THEN
    RAISE EXCEPTION 'Finance reconciliation proposal/dispute facts and pinned sources are immutable';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_rvn_fin_reconciliation_immutable_proposal_fields
  ON rvn_roi_finance_reconciliations;
CREATE TRIGGER trg_rvn_fin_reconciliation_immutable_proposal_fields
  BEFORE UPDATE ON rvn_roi_finance_reconciliations
  FOR EACH ROW EXECUTE FUNCTION rvn_fin_reconciliation_immutable_proposal_fields();
