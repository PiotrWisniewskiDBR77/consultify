-- V8 MyWork Roof Package — core tables
-- WP-W7-ROOF-01: Cross-surface state, Home block maturity, Inbox materialization, Calendar phasing

-- ==========================================
-- 1. Canonical Object States (Decision W7-1)
-- One truth across Home, Calendar, Inbox, Radar
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_canonical_object_states (
  object_id           TEXT NOT NULL,
  object_type         TEXT NOT NULL
                      CHECK (object_type IN (
                        'task', 'decision', 'initiative', 'milestone',
                        'approval', 'ai_proposal', 'notification', 'signal'
                      )),
  organization_id     TEXT NOT NULL,
  canonical_state     TEXT NOT NULL,
  last_updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  surface_projections TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (object_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_cos_org
  ON v8_canonical_object_states(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_cos_type
  ON v8_canonical_object_states(organization_id, object_type);
CREATE INDEX IF NOT EXISTS idx_v8_cos_updated
  ON v8_canonical_object_states(last_updated_at);

-- ==========================================
-- 2. Home Block Maturity (Decision W7-2)
-- Explicit maturity labels for all 8 blocks
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_home_block_maturity (
  block_id        TEXT PRIMARY KEY,
  block_name      TEXT NOT NULL
                  CHECK (block_name IN (
                    'aiPulseCore', 'momentum', 'sparkField', 'decisionTemperature',
                    'industryLens', 'executionCurrent', 'teamSignal', 'commandDock'
                  )),
  organization_id TEXT NOT NULL,
  maturity_level  TEXT NOT NULL
                  CHECK (maturity_level IN (
                    'backed_by_real_service', 'partial_stitched', 'placeholder_non_canonical'
                  )),
  service_ref     TEXT,
  last_audited_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (block_name, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_hbm_org
  ON v8_home_block_maturity(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_hbm_maturity
  ON v8_home_block_maturity(organization_id, maturity_level);

-- ==========================================
-- 3. Inbox Materializations (Decision W7-3)
-- Event-driven materialization tracking
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_inbox_materializations (
  materialization_id TEXT PRIMARY KEY,
  event_source_ref   TEXT NOT NULL,
  inbox_item_id      TEXT NOT NULL,
  user_id            TEXT NOT NULL,
  organization_id    TEXT NOT NULL,
  materialized_at    TEXT NOT NULL DEFAULT (datetime('now')),
  latency_ms         INTEGER NOT NULL DEFAULT 0,
  latency_band       TEXT NOT NULL
                     CHECK (latency_band IN (
                       'near_realtime', 'operational', 'degraded'
                     ))
);

CREATE INDEX IF NOT EXISTS idx_v8_inbox_mat_org
  ON v8_inbox_materializations(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_inbox_mat_user
  ON v8_inbox_materializations(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_inbox_mat_band
  ON v8_inbox_materializations(organization_id, latency_band);
CREATE INDEX IF NOT EXISTS idx_v8_inbox_mat_time
  ON v8_inbox_materializations(materialized_at);

-- ==========================================
-- 4. Calendar Phases (Decision W7-4)
-- Phase A (internal) / Phase B (external sync)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_calendar_phases (
  phase_id        TEXT PRIMARY KEY,
  phase_name      TEXT NOT NULL
                  CHECK (phase_name IN (
                    'phase_a_internal', 'phase_b_external_sync'
                  )),
  organization_id TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'completed', 'blocked')),
  blocked_by      TEXT,
  UNIQUE (phase_name, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_cal_phase_org
  ON v8_calendar_phases(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_cal_phase_status
  ON v8_calendar_phases(organization_id, status);
