-- Finance v3 — Gate C (WP-C01): WP-B07 observability — reason code taxonomy and correlation ids.
--
-- Source: docs/validation/finance-v3/generated/gate-b/WP-B07_observability_runbooks_ADR.md
-- sections 2.4, 3.2, 6.1, 7.
--
-- Additive only. Metrics/dashboards/alerts/runbooks (sections 4-6 of the ADR) are operational
-- artifacts (Prometheus metric names, Grafana panels, alert thresholds, runbook procedures) with
-- no schema to migrate — they are not represented in this migration set. This migration implements
-- only the two DB-level items the ADR explicitly proposes as additive schema for Gate C (section 7
-- "Addytywne propozycje schematu dla Gate C"):
--   1. finance_reason_codes — a namespaced taxonomy table, advisory (no FK) for
--      finance_exceptions.reason_code (owned by WP-B05, kept untouched), mandatory (FK) for
--      compute_jobs.reason_code / compute_job_runs.reason_code (owned by this ADR's own domain).
--   2. compute_jobs.replayed_from_job_id — replay audit column (runbook 6.1 step 4).
--
-- The artifact-level compute quarantine flag proposed in runbook 6.2 ("rozszerzyc mechanizm kill
-- switch... o wariant keyed po input_artifact_id") is explicitly left undesigned by the ADR itself
-- (no concrete DDL, storage mechanism unresolved — v8_feature_flags vs a new table) and is not
-- implemented here; same for org_concurrency_limit()/is_org_compute_killed(), which the B04
-- migration also left as forward references. Documented as an open item in the migration report.

BEGIN;

CREATE TABLE IF NOT EXISTS finance_reason_codes (
  code                TEXT PRIMARY KEY,          -- 'COMPUTE.ENGINE.CIRCULAR_UNRESOLVED'
  namespace           TEXT NOT NULL,              -- 'COMPUTE' | 'DATA' | ...
  category            TEXT NOT NULL,              -- 'ENGINE' | 'INFRA' | 'LEASE' | 'LIFECYCLE' | 'CAPACITY' | ...
  default_severity    TEXT NOT NULL
                        CHECK (default_severity IN ('INFO', 'WARNING', 'MATERIAL', 'CRITICAL_DATA', 'SECURITY')),
  default_retryable   BOOLEAN NOT NULL,
  default_alert       BOOLEAN NOT NULL,           -- whether the mere occurrence is an SRE incident
  owner_team          TEXT NOT NULL,              -- 'SRE' | 'Finance Controls' | 'Platform'
  description         TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed set (WP-B07 section 3.4) — illustrative starting taxonomy, refined at Gate C/E per the ADR.
INSERT INTO finance_reason_codes (code, namespace, category, default_severity, default_retryable, default_alert, owner_team, description) VALUES
  ('COMPUTE.INFRA.DB_CONNECTION_LOST',              'COMPUTE', 'INFRA',     'WARNING', true,  true,  'SRE',              'Lost connection to Postgres during compute'),
  ('COMPUTE.INFRA.OOM',                              'COMPUTE', 'INFRA',     'WARNING', true,  true,  'SRE',              'Worker process ran out of memory'),
  ('COMPUTE.INFRA.UPSTREAM_TIMEOUT',                  'COMPUTE', 'INFRA',     'WARNING', true,  true,  'SRE',              'Upstream dependency timed out'),
  ('COMPUTE.ENGINE.CIRCULAR_UNRESOLVED',               'COMPUTE', 'ENGINE',    'MATERIAL', false, false, 'SRE',              'Circular reference in schedule unresolved after deterministic solver limit'),
  ('COMPUTE.ENGINE.DIVISION_UNDEFINED',                 'COMPUTE', 'ENGINE',    'MATERIAL', false, false, 'SRE',              'Division by undefined/zero denominator'),
  ('COMPUTE.ENGINE.UNDEFINED_MATH',                      'COMPUTE', 'ENGINE',    'SECURITY', false, true,  'SRE',              'Mathematically undefined operation — hard block per DEC-FIN-009'),
  ('COMPUTE.LEASE.EXPIRED',                               'COMPUTE', 'LEASE',     'WARNING', true,  false, 'SRE',              'Worker lease expired, reaper reclaimed job'),
  ('COMPUTE.LIFECYCLE.CANCELLED_BY_USER',                  'COMPUTE', 'LIFECYCLE', 'INFO',    false, false, 'SRE',              'Job cancelled by user request'),
  ('COMPUTE.LIFECYCLE.KILLED_BY_KILL_SWITCH_ORG',           'COMPUTE', 'LIFECYCLE', 'WARNING', false, false, 'SRE',              'Job killed by per-org kill switch'),
  ('COMPUTE.LIFECYCLE.KILLED_BY_KILL_SWITCH_GLOBAL',         'COMPUTE', 'LIFECYCLE', 'WARNING', false, false, 'SRE',              'Job killed by global kill switch'),
  ('COMPUTE.LIFECYCLE.QUARANTINED',                           'COMPUTE', 'LIFECYCLE', 'WARNING', false, false, 'SRE',              'Job quarantined by operator, will not auto-retry'),
  ('COMPUTE.CAPACITY.CONCURRENCY_LIMIT_REACHED',               'COMPUTE', 'CAPACITY',  'WARNING', true,  false, 'Platform',         'Per-org concurrency limit reached at claim time'),
  ('COMPUTE.CAPACITY.QUEUE_BACKLOG_SLO_BREACH',                 'COMPUTE', 'CAPACITY',  'WARNING', false, true,  'Platform',         'Queue depth SLO breached'),
  ('COMPUTE.INPUT.ENGINE_MANIFEST_NOT_FOUND',                    'COMPUTE', 'INFRA',     'WARNING', false, true,  'SRE',              'Referenced engine_manifest_id not found at claim time')
ON CONFLICT (code) DO NOTHING;

-- Mandatory FK for compute_jobs/compute_job_runs (own domain). Deliberately NOT added to
-- finance_exceptions.reason_code — WP-B05 already owns that column as free TEXT with its own,
-- non-namespaced values (ROUNDING, MISSING_SOURCE, ...); WP-B07 section 3.2 explicitly keeps the
-- FK one-directional so this ADR doesn't retroactively constrain B05's DDL.
ALTER TABLE compute_jobs
  ADD COLUMN IF NOT EXISTS reason_code TEXT REFERENCES finance_reason_codes(code);
ALTER TABLE compute_job_runs
  ADD COLUMN IF NOT EXISTS reason_code TEXT REFERENCES finance_reason_codes(code);

-- Replay audit (WP-B07 runbook 6.1 step 4) — a replay is always a NEW compute_jobs row (B04
-- section 4 forbids mutating a terminal row); this column links it back to what it replays.
ALTER TABLE compute_jobs
  ADD COLUMN IF NOT EXISTS replayed_from_job_id TEXT REFERENCES compute_jobs(id);

-- Correlation id for the export request itself (WP-B07 section 2.4) — gap the ADR found relative
-- to the WP-B06 DDL (finance_export_manifests had generated_by/generated_at but no request_id to
-- tie the export click back to api_logs/structured logs).
ALTER TABLE finance_export_manifests
  ADD COLUMN IF NOT EXISTS request_id TEXT;

COMMIT;
