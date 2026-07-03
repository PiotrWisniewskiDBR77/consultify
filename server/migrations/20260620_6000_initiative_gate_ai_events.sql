-- 20260620_6000 — M13 Depth · Fala 1 (AI na bramce) · G4
--
-- Durable telemetry for Initiative Gate AI decisions: one row per gate
-- evaluation/transition that the feature touched. Powers the success metrics
-- in INITIATIVE_GATE_AI_SPEC.md §7 (% gates flagged · % overridden · low-score
-- → later BLOCKED/rework correlation · insight→APPROVE time).
--
-- Written by server/src/services/initiative/gateAiTelemetryService.ts, which is
-- FAIL-SAFE: a missing table OR any write error is swallowed so telemetry can
-- never break a transition. Shipping this code ahead of the migration changes
-- nothing for live clients.
--
-- Conventions match 20260608_rollout_tables.sql and the sibling
-- 20260620_5000_initiative_gate_ai_flags.sql:
--   * TEXT primary key / organization_id (no UUID-with-FK so the runner never
--     fails on a missing referenced table).
--   * gen_random_uuid()::TEXT default IDs (pgcrypto, already enabled).
--   * NOW() timestamps. Additive + idempotent.

CREATE TABLE IF NOT EXISTS initiative_gate_ai_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL,
  initiative_id TEXT,
  gate TEXT,
  score INTEGER,
  timeline_block INTEGER NOT NULL DEFAULT 0,
  blocked INTEGER NOT NULL DEFAULT 0,
  overridden INTEGER NOT NULL DEFAULT 0,
  override_reason TEXT,
  user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_initiative_gate_ai_events_org
  ON initiative_gate_ai_events (organization_id);
