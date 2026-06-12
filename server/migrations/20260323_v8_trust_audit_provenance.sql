-- V8 Trust Audit — Provenance ledger wiring, degraded-state resolution, health dashboard
-- Wave 6: Decisions D24, D25, D26

ALTER TABLE v8_degraded_conditions ADD COLUMN IF NOT EXISTS resolved_at TEXT;
ALTER TABLE v8_degraded_conditions ADD COLUMN IF NOT EXISTS resolved_by TEXT;
ALTER TABLE v8_degraded_conditions ADD COLUMN IF NOT EXISTS resolution_note TEXT;

CREATE INDEX IF NOT EXISTS idx_v8_degraded_active
  ON v8_degraded_conditions(organization_id) WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_v8_health_latest
  ON v8_health_signals(organization_id, signal_type, timestamp);
