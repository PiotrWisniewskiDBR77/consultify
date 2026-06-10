-- 20260608 — Module 06 Realizacja (Execution) — Rollout persistence
--
-- The Rollout sub-tab inside ExecutionHub (src/components/Execution/RolloutTab.tsx)
-- needs durable storage for its four sub-resources: KPI tracking, risk register,
-- change log and closure checklist. Previously these lived only in the in-memory
-- `fullSession` React state (legacy FullRolloutView + Rollout*Tab.tsx) and were
-- lost on every page refresh.
--
-- This migration creates the backing tables for `/api/rollout/*` routes
-- (server/src/routes/rollout.routes.ts). Additive and idempotent.
--
-- Conventions match the rest of the codebase (see 20260603_generated_initiatives.sql):
--   * TEXT primary keys / organization_id (not UUID-with-FK) so the migration
--     runner never fails on a missing referenced table.
--   * gen_random_uuid()::TEXT default IDs (pgcrypto, already enabled).
--   * NOW() timestamps.

-- ── KPI tracking ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rollout_kpis (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  name TEXT NOT NULL DEFAULT 'New KPI',
  baseline NUMERIC NOT NULL DEFAULT 0,
  target NUMERIC NOT NULL DEFAULT 100,
  current_value NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '%',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rollout_kpis_org ON rollout_kpis(organization_id);
CREATE INDEX IF NOT EXISTS idx_rollout_kpis_project ON rollout_kpis(project_id);

CREATE TABLE IF NOT EXISTS rollout_kpi_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  kpi_id TEXT NOT NULL,
  value NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rollout_kpi_history_kpi ON rollout_kpi_history(kpi_id);

-- ── Risk register ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rollout_risks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL DEFAULT 'New Risk',
  probability TEXT NOT NULL DEFAULT 'medium',
  impact TEXT NOT NULL DEFAULT 'medium',
  mitigation TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  owner_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rollout_risks_org ON rollout_risks(organization_id);
CREATE INDEX IF NOT EXISTS idx_rollout_risks_project ON rollout_risks(project_id);

-- ── Change log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rollout_changes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL DEFAULT 'New Change',
  type TEXT NOT NULL DEFAULT 'process',
  status TEXT NOT NULL DEFAULT 'PROPOSED',
  impact TEXT,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rollout_changes_org ON rollout_changes(organization_id);
CREATE INDEX IF NOT EXISTS idx_rollout_changes_project ON rollout_changes(project_id);

-- ── Closure checklist ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rollout_closures (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL DEFAULT 'New Closure Item',
  category TEXT NOT NULL DEFAULT 'handover',
  status TEXT NOT NULL DEFAULT 'OPEN',
  due_date DATE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rollout_closures_org ON rollout_closures(organization_id);
CREATE INDEX IF NOT EXISTS idx_rollout_closures_project ON rollout_closures(project_id);
