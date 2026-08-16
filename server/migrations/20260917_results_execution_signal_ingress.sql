-- RES-FLOW-ADAPTER-001: restart-safe Execution -> Results ingress.
-- This stores the immutable source observation envelope only. Mapping it to
-- KPI/ROI visibility remains an explicit Results-owner decision.

ALTER TABLE execution_results_signal_outbox
  DROP CONSTRAINT IF EXISTS execution_results_signal_outbox_delivery_status_check;
ALTER TABLE execution_results_signal_outbox
  ADD CONSTRAINT execution_results_signal_outbox_delivery_status_check
  CHECK (delivery_status IN ('PENDING','PROCESSING','DELIVERED','FAILED'));
ALTER TABLE execution_results_signal_outbox
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

CREATE TABLE IF NOT EXISTS rvn_execution_signal_receipts (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  source_signal_id UUID NOT NULL REFERENCES execution_results_signal_outbox(signal_id),
  source_execution_link_id UUID NOT NULL REFERENCES execution_case_links(link_id),
  source_initiative_id TEXT NOT NULL,
  source_case_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  payload_version INTEGER NOT NULL,
  observation_payload JSONB NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source_signal_id)
);

CREATE INDEX IF NOT EXISTS idx_rvn_execution_signal_receipts_org_time
  ON rvn_execution_signal_receipts(organization_id, observed_at DESC);

CREATE OR REPLACE FUNCTION protect_rvn_execution_signal_receipt()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'rvn_execution_signal_receipts are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rvn_execution_signal_receipts_immutable
  ON rvn_execution_signal_receipts;
CREATE TRIGGER trg_rvn_execution_signal_receipts_immutable
  BEFORE UPDATE OR DELETE ON rvn_execution_signal_receipts
  FOR EACH ROW EXECUTE FUNCTION protect_rvn_execution_signal_receipt();

