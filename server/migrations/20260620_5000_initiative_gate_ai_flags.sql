-- 20260620_5000 — M13 Depth · Fala 1 (AI na bramce) · G1
--
-- Per-org rollout flag + threshold for the Initiative Gate AI feature
-- (server/src/services/initiative/initiativeGateAiConfig.ts).
--
-- Rollout safety: the feature defaults OFF for every org. Only an explicit
-- `enabled = 1` row turns it on (for a demo/internal org first). The reader
-- (initiativeGateAiConfig) treats a missing table OR missing row as OFF, so
-- this migration is additive and changes NOTHING for live clients until a row
-- is deliberately inserted.
--
-- Conventions match 20260608_rollout_tables.sql:
--   * TEXT primary key / organization_id (no UUID-with-FK so the runner never
--     fails on a missing referenced table).
--   * gen_random_uuid()::TEXT default IDs (pgcrypto, already enabled).
--   * NOW() timestamps. Additive + idempotent.

CREATE TABLE IF NOT EXISTS initiative_feature_flags (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL,
  flag_key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  threshold INTEGER NOT NULL DEFAULT 75,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE (organization_id, flag_key)
);

CREATE INDEX IF NOT EXISTS idx_initiative_feature_flags_org
  ON initiative_feature_flags (organization_id);
