-- OPS-OBS-001 — forward-only recovery grace for incident ledgers that were
-- created before multi-replica restart protection was introduced.

ALTER TABLE operational_alert_incidents
  ADD COLUMN IF NOT EXISTS last_breached_at TIMESTAMPTZ;

UPDATE operational_alert_incidents
SET last_breached_at = COALESCE(last_breached_at, detected_at, last_evaluated_at, now())
WHERE last_breached_at IS NULL;

ALTER TABLE operational_alert_incidents
  ALTER COLUMN last_breached_at SET DEFAULT now(),
  ALTER COLUMN last_breached_at SET NOT NULL;
