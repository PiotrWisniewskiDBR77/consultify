-- EXE-FLOW-ADAPTER-001: bounded, versioned and restart-safe delivery.

ALTER TABLE closure_delivery_receipts
  ADD COLUMN IF NOT EXISTS payload_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;

ALTER TABLE closure_delivery_receipts
  DROP CONSTRAINT IF EXISTS closure_delivery_receipts_results_status_check;
ALTER TABLE closure_delivery_receipts
  ADD CONSTRAINT closure_delivery_receipts_results_status_check
  CHECK (results_status IN ('PENDING','DELIVERING','DELIVERED','FAILED','DEAD_LETTER'));

ALTER TABLE closure_delivery_receipts
  DROP CONSTRAINT IF EXISTS closure_delivery_receipts_finance_status_check;
ALTER TABLE closure_delivery_receipts
  ADD CONSTRAINT closure_delivery_receipts_finance_status_check
  CHECK (finance_status IN ('PENDING','DELIVERING','DELIVERED','FAILED','NEEDS_DECISION','DEAD_LETTER'));

ALTER TABLE execution_results_signal_outbox
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;
ALTER TABLE execution_results_signal_outbox
  DROP CONSTRAINT IF EXISTS execution_results_signal_outbox_delivery_status_check;
ALTER TABLE execution_results_signal_outbox
  ADD CONSTRAINT execution_results_signal_outbox_delivery_status_check
  CHECK (delivery_status IN ('PENDING','PROCESSING','DELIVERED','FAILED','DEAD_LETTER'));

ALTER TABLE ie_outbox_events
  ADD COLUMN IF NOT EXISTS payload_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS ie_outbox_delivery_receipts (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  source_event_id BIGINT NOT NULL REFERENCES ie_outbox_events(id),
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  aggregate_version INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload_version INTEGER NOT NULL,
  payload_json JSONB NOT NULL,
  correlation_id TEXT NOT NULL,
  causation_id TEXT NOT NULL,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source_event_id)
);

CREATE INDEX IF NOT EXISTS idx_ie_outbox_delivery_receipts_org_time
  ON ie_outbox_delivery_receipts (organization_id, consumed_at DESC);

CREATE OR REPLACE FUNCTION protect_ie_outbox_delivery_receipt()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ie_outbox_delivery_receipts are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ie_outbox_delivery_receipts_immutable
  ON ie_outbox_delivery_receipts;
CREATE TRIGGER trg_ie_outbox_delivery_receipts_immutable
  BEFORE UPDATE OR DELETE ON ie_outbox_delivery_receipts
  FOR EACH ROW EXECUTE FUNCTION protect_ie_outbox_delivery_receipt();
