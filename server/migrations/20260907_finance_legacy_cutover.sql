-- FIN-MVP-CUTOVER-001
-- Durable observation of legacy Finance traffic. This migration does not
-- delete, rewrite, or backfill financial data; rollback is an application
-- switch which temporarily re-enables the protected legacy writer.

CREATE TABLE IF NOT EXISTS finance_legacy_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL,
    request_id TEXT,
    user_id TEXT,
    method TEXT NOT NULL,
    route_path TEXT NOT NULL,
    access_kind TEXT NOT NULL CHECK (access_kind IN (
      'legacy_read',
      'legacy_uncovered_writer',
      'legacy_writer_blocked',
      'rollback_writer'
    )),
    successor_path TEXT,
    legacy_table TEXT,
    legacy_id TEXT,
    canonical_artifact_id UUID,
    canonical_business_version_id UUID,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_legacy_usage_org_observed
  ON finance_legacy_usage_events(organization_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_legacy_usage_kind_observed
  ON finance_legacy_usage_events(access_kind, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_legacy_usage_identity
  ON finance_legacy_usage_events(organization_id, legacy_table, legacy_id, observed_at DESC);

