-- Sprint 13: presentation governance subscriber dashboard tokens
--
-- Read-only tokens for external HMAC alert subscribers ("clients of clients").
-- Each token is bound to exactly one `presentation_governance_alert_subscriptions`
-- row and authorizes the subscriber to read THEIR OWN delivery stats and
-- recent verifications via `GET /api/presentations/governance/subscriber/dashboard`.
--
-- Security invariants enforced at the schema layer:
--   * Token material is NEVER stored in plaintext — only the sha256 hex hash.
--   * `token_prefix` (first 8 chars of the raw token) exists for admin display
--     ONLY ("…the token starting with 1a2b3c4d…"). It is not authoritative.
--   * `expires_at` is mandatory; the service clamps issuance to 1..90 days.
--   * `revoked_at` + `revoked_reason` exist for the Sprint 14+ revocation
--     surface; the read endpoint already treats `revoked_at IS NOT NULL` as
--     401 unauthorized so the column is functional even before the admin UI
--     ships.
--   * `scope` is a JSONB envelope so future Sprints can add narrower scopes
--     (e.g. `{"read":true,"deliveries":false}`) without another migration.
--
-- Idempotent. Safe to re-apply.

CREATE TABLE IF NOT EXISTS presentation_governance_subscriber_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- subscription_id is TEXT to match presentation_governance_alert_subscriptions.id
  -- (TEXT on the live schema); a UUID column can't FK-reference a TEXT key.
  subscription_id TEXT NOT NULL REFERENCES presentation_governance_alert_subscriptions(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,         -- sha256 hex of the raw token
  token_prefix TEXT NOT NULL,              -- first 8 chars for display only
  issued_by TEXT,                          -- user id of admin who issued
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,         -- max 90 days, default 30 days
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  scope JSONB NOT NULL DEFAULT '{"read":true}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_subscriber_tokens_subscription_id
  ON presentation_governance_subscriber_tokens(subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscriber_tokens_token_hash
  ON presentation_governance_subscriber_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_subscriber_tokens_active
  ON presentation_governance_subscriber_tokens(subscription_id, expires_at)
  WHERE revoked_at IS NULL;
