-- 038: Health Panel — probe result cache
-- Backing store for the internal "dowody działania" (proof-of-life) Health panel.
-- Each row is the LAST result of a single probe for a single organization.
-- Probes are round-trips against our OWN API/DB (in-process, no external network).
-- See server/src/routes/admin/health-panel.routes.ts for the probe registry.

CREATE TABLE IF NOT EXISTS health_probe_results (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  probe_id        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'unknown', -- 'pass' | 'fail' | 'unknown'
  duration_ms     INTEGER,
  error_message   TEXT,
  detail_json     TEXT,                             -- optional structured detail (JSON string)
  ran_by_user_id  TEXT,
  ran_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- One cached "last result" per (org, probe). The runner UPSERTs on this key.
CREATE UNIQUE INDEX IF NOT EXISTS uq_health_probe_org_probe
  ON health_probe_results(organization_id, probe_id);

CREATE INDEX IF NOT EXISTS idx_health_probe_org_ran_at
  ON health_probe_results(organization_id, ran_at DESC);
