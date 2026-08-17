-- Working slot 20261003; integrator must reserve the final ordinal after FIN fan-in.
CREATE TABLE IF NOT EXISTS operational_alert_repair_intents (
  intent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  actor_id TEXT NOT NULL CHECK (btrim(actor_id) <> ''),
  correlation_id TEXT NOT NULL CHECK (btrim(correlation_id) <> ''),
  source_type TEXT NOT NULL CHECK (source_type IN ('rvn_platform_outbox','notification_outbox','case_workspace_event_outbox','http_auth_denial','test_terminal')),
  source_terminal_id TEXT NOT NULL CHECK (btrim(source_terminal_id) <> ''),
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind TEXT NOT NULL CHECK (kind IN ('WRITE_FAILURE_RATE','OUTBOX_OLDEST_AGE','DB_SATURATION','REPEATED_AUTH_DENIALS')),
  outcome TEXT NOT NULL CHECK (outcome IN ('SUCCESS','FAILURE','SAMPLE','DENIAL')),
  observed_value NUMERIC NOT NULL DEFAULT 1,
  input_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','COMPLETED','FAILED','DEAD_LETTER')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK(max_attempts BETWEEN 1 AND 20),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_owner TEXT,
  lease_token UUID,
  fencing_version INTEGER NOT NULL DEFAULT 0 CHECK(fencing_version >= 0),
  lease_expires_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(organization_id,source_type,source_terminal_id,outcome),
  UNIQUE(intent_id,organization_id),
  CHECK(attempt_count <= max_attempts),
  CHECK((status='PROCESSING' AND lease_owner IS NOT NULL AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
     OR (status<>'PROCESSING' AND lease_owner IS NULL AND lease_token IS NULL AND lease_expires_at IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_operational_alert_repair_claim ON operational_alert_repair_intents(status,available_at,lease_expires_at);

CREATE TABLE IF NOT EXISTS operational_alert_repair_cursors (
  source_type TEXT PRIMARY KEY CHECK (source_type IN ('rvn_platform_outbox','notification_outbox','case_workspace_event_outbox')),
  -- Start at installation time: repair is forward-looking and never silently walks
  -- the complete historical business ledger.
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  terminal_id TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO operational_alert_repair_cursors(source_type)
VALUES ('rvn_platform_outbox'),('notification_outbox'),('case_workspace_event_outbox')
ON CONFLICT DO NOTHING;
CREATE INDEX IF NOT EXISTS idx_rvn_platform_outbox_repair_scan ON rvn_platform_outbox(status,dispatched_at,outbox_id);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_repair_scan ON notification_outbox(status,updated_at,id);
CREATE INDEX IF NOT EXISTS idx_case_workspace_outbox_repair_scan ON case_workspace_event_outbox(delivered_at,delivery_attempt_count,created_at,event_id);

ALTER TABLE operational_alert_signals ADD CONSTRAINT uq_operational_alert_signal_org UNIQUE(signal_id,organization_id);
CREATE TABLE IF NOT EXISTS operational_alert_repair_receipts (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL,
  organization_id TEXT NOT NULL,
  signal_id UUID NOT NULL,
  fencing_version INTEGER NOT NULL CHECK(fencing_version > 0),
  repaired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(intent_id),
  FOREIGN KEY(intent_id,organization_id) REFERENCES operational_alert_repair_intents(intent_id,organization_id),
  FOREIGN KEY(signal_id,organization_id) REFERENCES operational_alert_signals(signal_id,organization_id)
);

CREATE TABLE IF NOT EXISTS operational_alert_repair_attempts (
  attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL,
  organization_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('CLAIMED','RECLAIMED','SUCCEEDED','FAILED','DEAD_LETTERED','FENCED','REDRIVEN')),
  worker_id TEXT NOT NULL CHECK(btrim(worker_id)<>''),
  operator_actor_id TEXT,
  lease_token UUID,
  fencing_version INTEGER NOT NULL CHECK(fencing_version >= 0),
  detail_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(intent_id,organization_id) REFERENCES operational_alert_repair_intents(intent_id,organization_id)
);
CREATE INDEX IF NOT EXISTS idx_operational_alert_repair_attempts_intent ON operational_alert_repair_attempts(intent_id,created_at);

DROP TRIGGER IF EXISTS trg_operational_alert_repair_receipts_immutable ON operational_alert_repair_receipts;
CREATE TRIGGER trg_operational_alert_repair_receipts_immutable BEFORE UPDATE OR DELETE ON operational_alert_repair_receipts
FOR EACH ROW EXECUTE FUNCTION deny_operational_alert_immutable_mutation();
DROP TRIGGER IF EXISTS trg_operational_alert_repair_attempts_immutable ON operational_alert_repair_attempts;
CREATE TRIGGER trg_operational_alert_repair_attempts_immutable BEFORE UPDATE OR DELETE ON operational_alert_repair_attempts
FOR EACH ROW EXECUTE FUNCTION deny_operational_alert_immutable_mutation();
