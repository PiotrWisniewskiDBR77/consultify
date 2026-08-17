-- B1: a request intent is durable before a mounted legacy handler may run.
CREATE TABLE IF NOT EXISTS legacy_cutover_signal_intents (
  intent_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  domain TEXT NOT NULL,
  writer_id TEXT,
  organization_id TEXT,
  user_id TEXT,
  request_id TEXT,
  idempotency_key TEXT,
  signal_fingerprint TEXT NOT NULL,
  method TEXT NOT NULL,
  route_path TEXT NOT NULL,
  access_kind TEXT NOT NULL,
  successor_path TEXT,
  legacy_table TEXT,
  legacy_id TEXT,
  identity_status TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REGISTERED'
    CHECK (status IN ('REGISTERED','COMPLETING','COMPLETED','ABORTED_UNKNOWN')),
  terminal_status INTEGER,
  terminal_result TEXT,
  completion_source TEXT,
  fencing_version INTEGER NOT NULL DEFAULT 0,
  lease_owner TEXT,
  lease_token TEXT,
  lease_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  ,CONSTRAINT legacy_cutover_intent_terminal_shape CHECK (
    (status IN ('REGISTERED','COMPLETING') AND terminal_result IS NULL AND completed_at IS NULL)
    OR
    (status IN ('COMPLETED','ABORTED_UNKNOWN') AND terminal_result IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_legacy_cutover_signal_intent_request
  ON legacy_cutover_signal_intents(domain, COALESCE(organization_id,''), request_id)
  WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_legacy_cutover_signal_intent_repair
  ON legacy_cutover_signal_intents(status, created_at)
  WHERE status IN ('REGISTERED','COMPLETING');

CREATE OR REPLACE FUNCTION enforce_legacy_cutover_intent_state()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('COMPLETED','ABORTED_UNKNOWN') THEN
    RAISE EXCEPTION 'LEGACY_CUTOVER_INTENT_TERMINAL_IMMUTABLE';
  END IF;
  IF OLD.status = 'REGISTERED' AND NEW.status NOT IN ('REGISTERED','COMPLETING','COMPLETED','ABORTED_UNKNOWN') THEN
    RAISE EXCEPTION 'LEGACY_CUTOVER_INTENT_INVALID_TRANSITION';
  END IF;
  IF OLD.status = 'COMPLETING' AND NEW.status NOT IN ('COMPLETING','COMPLETED','ABORTED_UNKNOWN') THEN
    RAISE EXCEPTION 'LEGACY_CUTOVER_INTENT_INVALID_TRANSITION';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_legacy_cutover_intent_state ON legacy_cutover_signal_intents;
CREATE TRIGGER trg_legacy_cutover_intent_state
BEFORE UPDATE ON legacy_cutover_signal_intents
FOR EACH ROW EXECUTE FUNCTION enforce_legacy_cutover_intent_state();
