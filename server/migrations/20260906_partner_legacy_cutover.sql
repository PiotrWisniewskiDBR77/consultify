-- PRT-MVP-LEGACY-CUTOVER-001
-- Durable usage telemetry plus the smallest safe identity backfill needed for
-- the V8 referral owner. No payout policy or financial facts are changed.

CREATE TABLE IF NOT EXISTS partner_legacy_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT,
    user_id TEXT,
    partner_org_id UUID,
    method TEXT NOT NULL,
    route_path TEXT NOT NULL,
    access_kind TEXT NOT NULL CHECK (access_kind IN (
      'legacy_read',
      'legacy_uncovered_writer',
      'legacy_writer_blocked',
      'rollback_writer'
    )),
    successor_path TEXT,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_legacy_usage_observed
  ON partner_legacy_usage_events(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_legacy_usage_kind
  ON partner_legacy_usage_events(access_kind, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_legacy_usage_partner
  ON partner_legacy_usage_events(partner_org_id, observed_at DESC);

-- Backfill only absent identities. UUID-derived values are stable across
-- retries and remain unique without claiming a human-readable partner brand.
UPDATE partner_organizations
SET referral_code = COALESCE(referral_code, 'PARTNER-' || upper(substr(id::text, 1, 8))),
    referral_link_slug = COALESCE(referral_link_slug, 'partner-' || lower(id::text)),
    updated_at = now()
WHERE referral_code IS NULL OR referral_link_slug IS NULL;
