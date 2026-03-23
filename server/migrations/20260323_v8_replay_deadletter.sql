-- V8 Replay, Dead-Letter and Edge Reliability — core tables
-- WP-W5-EXT-02: Dead-letter queue, retry policies, replay tracking,
-- provider health, schema drift detection.
-- Decisions: W5-4 (schema_drift), W5-5 (retry policy shape),
-- W5-6 (90-day retention), W5-7 (bulk replay), W5-8 (structured health).

-- Dead-letter queue: durable holding state for failed sync items
CREATE TABLE IF NOT EXISTS v8_dead_letter_records (
  dead_letter_id       TEXT PRIMARY KEY,
  original_job_ref     TEXT NOT NULL,
  original_payload_ref TEXT,
  event_name           TEXT NOT NULL,
  connector_id         TEXT NOT NULL,
  organization_id      TEXT NOT NULL,
  provider_key         TEXT NOT NULL,
  object_type          TEXT NOT NULL,
  object_ref           TEXT NOT NULL,
  reason               TEXT NOT NULL,
  error_class          TEXT NOT NULL CHECK (error_class IN (
    'auth_failure', 'permission_denied', 'provider_outage',
    'mapping_failure', 'business_conflict', 'rate_limited', 'target_not_found'
  )),
  replay_eligibility   TEXT NOT NULL CHECK (replay_eligibility IN (
    'eligible', 'blocked', 'requires_fix'
  )),
  retry_count          INTEGER NOT NULL DEFAULT 0,
  last_attempt_at      TEXT NOT NULL,
  dead_lettered_at     TEXT NOT NULL DEFAULT (datetime('now')),
  correlation_id       TEXT NOT NULL,
  operator_note        TEXT,
  resolution_state     TEXT NOT NULL DEFAULT 'pending_review' CHECK (resolution_state IN (
    'pending_review', 'replayed', 'dismissed', 'escalated', 'remapped'
  )),
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_dl_org
  ON v8_dead_letter_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_dl_connector_org
  ON v8_dead_letter_records(connector_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_dl_resolution
  ON v8_dead_letter_records(resolution_state) WHERE resolution_state = 'pending_review';
CREATE INDEX IF NOT EXISTS idx_v8_dl_error_class
  ON v8_dead_letter_records(error_class, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_dl_dead_lettered_at
  ON v8_dead_letter_records(dead_lettered_at);
CREATE INDEX IF NOT EXISTS idx_v8_dl_correlation
  ON v8_dead_letter_records(correlation_id);

-- Per-family retry policies (Decision W5-5: canonical shape, family-specific tuning)
CREATE TABLE IF NOT EXISTS v8_retry_policies (
  policy_id            TEXT PRIMARY KEY,
  connector_family     TEXT NOT NULL,
  organization_id      TEXT NOT NULL,
  max_attempt_classes  TEXT NOT NULL DEFAULT '{}',
  backoff_family       TEXT NOT NULL CHECK (backoff_family IN (
    'exponential', 'linear', 'fixed'
  )),
  jitter_enabled       INTEGER NOT NULL DEFAULT 1,
  escalation_handoff   TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_retry_family_org
  ON v8_retry_policies(connector_family, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_retry_org
  ON v8_retry_policies(organization_id);

-- Replay request tracking (Decision W5-7: single + bulk with safeguards)
CREATE TABLE IF NOT EXISTS v8_replay_requests (
  replay_id            TEXT PRIMARY KEY,
  dead_letter_id       TEXT NOT NULL,
  organization_id      TEXT NOT NULL,
  replay_type          TEXT NOT NULL CHECK (replay_type IN ('single', 'bulk')),
  requested_by         TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'completed', 'failed'
  )),
  safeguards           TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_replay_dl
  ON v8_replay_requests(dead_letter_id);
CREATE INDEX IF NOT EXISTS idx_v8_replay_org
  ON v8_replay_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_replay_status
  ON v8_replay_requests(status) WHERE status IN ('pending', 'in_progress');

-- Structured provider health (Decision W5-8: 5+ dimensions, not one vague light)
CREATE TABLE IF NOT EXISTS v8_provider_health (
  health_id            TEXT PRIMARY KEY,
  provider_key         TEXT NOT NULL,
  organization_id      TEXT NOT NULL,
  auth_health          TEXT NOT NULL CHECK (auth_health IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  transport_health     TEXT NOT NULL CHECK (transport_health IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  schema_health        TEXT NOT NULL CHECK (schema_health IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  sync_freshness       TEXT NOT NULL CHECK (sync_freshness IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  replay_pressure      TEXT NOT NULL CHECK (replay_pressure IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  dead_letter_pressure TEXT NOT NULL CHECK (dead_letter_pressure IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  overall_health       TEXT NOT NULL CHECK (overall_health IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  last_checked_at      TEXT NOT NULL DEFAULT (datetime('now')),
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_ph_provider_org
  ON v8_provider_health(provider_key, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_ph_org
  ON v8_provider_health(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_ph_overall
  ON v8_provider_health(overall_health) WHERE overall_health IN ('degraded', 'unhealthy');

-- Schema drift detection (Decision W5-4: connector.runtime.schema_drift_detected)
CREATE TABLE IF NOT EXISTS v8_schema_drift_events (
  event_id             TEXT PRIMARY KEY,
  connector_id         TEXT NOT NULL,
  organization_id      TEXT NOT NULL,
  drift_type           TEXT NOT NULL CHECK (drift_type IN (
    'field_added', 'field_removed', 'field_type_changed',
    'enum_value_changed', 'endpoint_deprecated', 'breaking_response_change'
  )),
  affected_fields      TEXT NOT NULL DEFAULT '[]',
  detected_at          TEXT NOT NULL DEFAULT (datetime('now')),
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_sd_connector_org
  ON v8_schema_drift_events(connector_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_sd_org
  ON v8_schema_drift_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_sd_detected
  ON v8_schema_drift_events(detected_at);
