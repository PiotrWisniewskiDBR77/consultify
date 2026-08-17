-- OPS-OBS-001 — durable, restart-readable operational alert incident ledger.

CREATE TABLE IF NOT EXISTS operational_alert_incidents (
  incident_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN (
    'WRITE_FAILURE_RATE',
    'OUTBOX_OLDEST_AGE',
    'DB_SATURATION',
    'REPEATED_AUTH_DENIALS'
  )),
  runbook_id TEXT NOT NULL DEFAULT 'OPS-OBS-001' CHECK (runbook_id = 'OPS-OBS-001'),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'RECOVERED', 'ACKNOWLEDGED')),
  detected_at TIMESTAMPTZ NOT NULL,
  recovered_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  correlation_id TEXT,
  detected_value DOUBLE PRECISION NOT NULL,
  latest_value DOUBLE PRECISION NOT NULL,
  threshold DOUBLE PRECISION NOT NULL,
  last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evaluator_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK ((status = 'ACTIVE' AND recovered_at IS NULL AND acknowledged_at IS NULL)
      OR (status = 'RECOVERED' AND recovered_at IS NOT NULL AND acknowledged_at IS NULL)
      OR (status = 'ACKNOWLEDGED' AND recovered_at IS NOT NULL AND acknowledged_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_operational_alert_one_open_incident
  ON operational_alert_incidents(kind)
  WHERE status IN ('ACTIVE', 'RECOVERED');

CREATE INDEX IF NOT EXISTS idx_operational_alert_incidents_kind_detected
  ON operational_alert_incidents(kind, detected_at DESC);

CREATE TABLE IF NOT EXISTS operational_alert_incident_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES operational_alert_incidents(incident_id),
  kind TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('DETECTED', 'RECOVERED', 'ACKNOWLEDGED')),
  value DOUBLE PRECISION NOT NULL,
  threshold DOUBLE PRECISION NOT NULL,
  correlation_id TEXT,
  evaluator_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operational_alert_events_incident_time
  ON operational_alert_incident_events(incident_id, occurred_at, event_id);

CREATE OR REPLACE FUNCTION deny_operational_alert_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'operational alert incident events are append-only' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_operational_alert_events_append_only
  ON operational_alert_incident_events;
CREATE TRIGGER trg_operational_alert_events_append_only
  BEFORE UPDATE OR DELETE ON operational_alert_incident_events
  FOR EACH ROW EXECUTE FUNCTION deny_operational_alert_event_mutation();
