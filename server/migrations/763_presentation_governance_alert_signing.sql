-- Sprint 9: presentation governance alert auto-fire worker + outbound HMAC signing
--
-- Two related changes:
--   1. Extend `presentation_governance_alert_subscriptions` with a per-row
--      `signing_secret` (hex, 32-byte) plus rotation/dispatch metadata so
--      subscribers can verify webhook origin via `X-Consultify-Signature`.
--   2. Extend `presentation_governance_alert_dispatches` with signature
--      bookkeeping columns so the audit row records WHETHER the outbound
--      POST was signed (algorithm + presence flag).
--   3. Add a small per-org `presentation_governance_alert_worker_state`
--      table that the periodic worker uses to (a) persist the previous
--      watchlist snapshot for diffing and (b) auto-pause a misbehaving org
--      after 5 consecutive failures.
--
-- All statements are idempotent. The migration is safe to re-run.

ALTER TABLE presentation_governance_alert_subscriptions
  ADD COLUMN IF NOT EXISTS signing_secret TEXT;
ALTER TABLE presentation_governance_alert_subscriptions
  ADD COLUMN IF NOT EXISTS signing_secret_rotated_at TIMESTAMP;
ALTER TABLE presentation_governance_alert_subscriptions
  ADD COLUMN IF NOT EXISTS last_dispatch_at TIMESTAMP;
ALTER TABLE presentation_governance_alert_subscriptions
  ADD COLUMN IF NOT EXISTS last_dispatch_status TEXT;

ALTER TABLE presentation_governance_alert_dispatches
  ADD COLUMN IF NOT EXISTS signature_algorithm TEXT;
ALTER TABLE presentation_governance_alert_dispatches
  ADD COLUMN IF NOT EXISTS signature_present BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS presentation_governance_alert_worker_state (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL UNIQUE,
  last_snapshot_json TEXT,
  last_run_at TIMESTAMP,
  last_run_summary TEXT,
  failures_in_a_row INTEGER NOT NULL DEFAULT 0,
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  paused_reason TEXT,
  paused_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pres_gov_alert_worker_state_paused
  ON presentation_governance_alert_worker_state(paused);
