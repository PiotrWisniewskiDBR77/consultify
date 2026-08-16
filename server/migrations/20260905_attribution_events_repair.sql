-- ADM-BVP-001: provide the immutable acquisition-attribution ledger expected by
-- AttributionService. Older baselines referenced this table without creating it.

CREATE TABLE IF NOT EXISTS attribution_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  campaign TEXT,
  partner_code TEXT,
  medium TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attribution_events_org_created
  ON attribution_events (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attribution_events_partner_created
  ON attribution_events (partner_code, created_at DESC)
  WHERE partner_code IS NOT NULL;
