CREATE TABLE IF NOT EXISTS operational_alert_repair_intents (
  intent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_terminal_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  outcome TEXT NOT NULL,
  observed_value NUMERIC NOT NULL DEFAULT 1,
  input_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','COMPLETED','FAILED','DEAD_LETTER')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(organization_id,source_type,source_terminal_id,outcome)
);
CREATE INDEX IF NOT EXISTS idx_operational_alert_repair_claim ON operational_alert_repair_intents(status,available_at,lease_expires_at);

CREATE TABLE IF NOT EXISTS operational_alert_repair_receipts (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL UNIQUE REFERENCES operational_alert_repair_intents(intent_id),
  organization_id TEXT NOT NULL,
  signal_id UUID NOT NULL,
  repaired_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_operational_alert_repair_receipts_immutable ON operational_alert_repair_receipts;
CREATE TRIGGER trg_operational_alert_repair_receipts_immutable BEFORE UPDATE OR DELETE ON operational_alert_repair_receipts
FOR EACH ROW EXECUTE FUNCTION deny_operational_alert_immutable_mutation();
