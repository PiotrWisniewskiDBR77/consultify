-- Tenant-scoped durable operational alert signals and explicitly enabled delivery.
CREATE TABLE IF NOT EXISTS operational_alert_signals (
  signal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('WRITE_FAILURE_RATE','OUTBOX_OLDEST_AGE','DB_SATURATION','REPEATED_AUTH_DENIALS')),
  outcome TEXT NOT NULL CHECK (outcome IN ('SUCCESS','FAILURE','SAMPLE','DENIAL')),
  observed_value NUMERIC NOT NULL DEFAULT 1,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload_version INTEGER NOT NULL DEFAULT 1 CHECK (payload_version = 1),
  idempotency_key TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_operational_alert_signals_window
  ON operational_alert_signals (organization_id, kind, occurred_at DESC);

CREATE TABLE IF NOT EXISTS operational_alert_tenant_states (
  organization_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('INACTIVE','ACTIVE','RECOVERED','ACKNOWLEDGED')),
  detected_at TIMESTAMPTZ,
  recovered_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  latest_value NUMERIC NOT NULL DEFAULT 0,
  threshold NUMERIC NOT NULL,
  correlation_id TEXT NOT NULL,
  evaluator_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, kind)
);

CREATE TABLE IF NOT EXISTS operational_alert_delivery_outbox (
  delivery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  transition TEXT NOT NULL CHECK (transition IN ('DETECTED','RECOVERED')),
  state_version INTEGER NOT NULL,
  correlation_id TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','DELIVERED','FAILED','DEAD_LETTER')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, kind, transition, state_version)
);
CREATE INDEX IF NOT EXISTS idx_operational_alert_delivery_claim
  ON operational_alert_delivery_outbox (status, available_at, lease_expires_at);

CREATE TABLE IF NOT EXISTS operational_alert_delivery_receipts (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL UNIQUE REFERENCES operational_alert_delivery_outbox(delivery_id),
  organization_id TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_digest TEXT NOT NULL,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION deny_operational_alert_immutable_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'OPS_ALERT_APPEND_ONLY';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_operational_alert_signals_immutable ON operational_alert_signals;
CREATE TRIGGER trg_operational_alert_signals_immutable BEFORE UPDATE OR DELETE ON operational_alert_signals
FOR EACH ROW EXECUTE FUNCTION deny_operational_alert_immutable_mutation();
DROP TRIGGER IF EXISTS trg_operational_alert_receipts_immutable ON operational_alert_delivery_receipts;
CREATE TRIGGER trg_operational_alert_receipts_immutable BEFORE UPDATE OR DELETE ON operational_alert_delivery_receipts
FOR EACH ROW EXECUTE FUNCTION deny_operational_alert_immutable_mutation();
