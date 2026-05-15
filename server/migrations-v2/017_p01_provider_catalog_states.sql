-- Ported from: 20260411_p01_provider_catalog_states.sql
-- P01 Integration: Runtime provider catalog state
-- Adds per-provider lifecycle state tracking (§2.3.3A canonical grammar)

CREATE TABLE IF NOT EXISTS v8_provider_catalog_states (
  state_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  provider_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL DEFAULT 'connected'
    CHECK (lifecycle_state IN ('draft', 'connected', 'degraded', 'requires_action', 'recovered', 'blocked')),
  previous_state TEXT,
  reason TEXT,
  incident_description TEXT,
  expected_recovery_at TIMESTAMPTZ,
  transitioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transitioned_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_provider_catalog_states_org
  ON v8_provider_catalog_states (organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_provider_catalog_states_state
  ON v8_provider_catalog_states (lifecycle_state);
