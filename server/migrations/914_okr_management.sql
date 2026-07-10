-- Migration 914: OKR management — cycles, check-ins, KR<->KPI auto-score link.
--
-- SSOT: Harvard/wdrozenie-100/_KONCEPT_RESULTS_2026-07-10.md, §3.3 (para 3: OKR
-- + Raporty OKR). D7 (first slice): OKR CRUD + okr_cycles + okr_check_ins +
-- link KR->KPI (auto-score). Decisions already resolved (not "Pytania"):
-- legacy tables = kanon (not v8), OKR KR<->KPI auto-score via a live KPI link,
-- one OKR set per dept x quarterly cycle (folded into okr_cycles.dept_id /
-- team_id rather than a separate okr_sets table for this first slice — a
-- dedicated okr_sets table remains a documented follow-up if multiple
-- concurrent sets per dept per cycle are needed).
--
-- okr_objectives / okr_key_results already exist (lazy-DDL'd, read-only, by
-- resultsStrategic.routes.ts ensureOkrTables() — D10). This migration:
--   1. Re-declares those two tables with CREATE TABLE IF NOT EXISTS (harmless
--      no-op if the lazy-DDL path already ran; makes this migration
--      self-sufficient on a fresh DB too).
--   2. Adds okr_cycles (quarterly cycle, optionally dept/team scoped).
--   3. Adds okr_check_ins (weekly-cadence check-in: confidence RAG + value/score + note).
--   4. Extends okr_objectives: cycle_id, owner_user_id, description, status.
--   5. Extends okr_key_results: kpi_id (auto-score link), kr_type
--      (metric|milestone), score (persisted 0.0-1.0), kind
--      (committed|aspirational), owner_user_id, updated_at.
--
-- Idempotent (IF NOT EXISTS / guarded DO blocks) — safe to re-run. Additive
-- only, no NOT NULL tightening, no data migration. NOT executed by this task
-- — run via skill `consultify-promocja-demo` after review.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 0. Base tables (idempotent re-declare — see header note 1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS okr_objectives (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  label TEXT NOT NULL,
  parent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS okr_key_results (
  id TEXT PRIMARY KEY,
  objective_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  label TEXT NOT NULL,
  baseline DOUBLE PRECISION,
  target DOUBLE PRECISION,
  current DOUBLE PRECISION,
  weight DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 1. okr_cycles — quarterly cycle, optionally scoped to a dept/team.
--    "kilka list OKR per dział" = zestaw per dział x cykl kwartalny.
-- ============================================================================
CREATE TABLE IF NOT EXISTS okr_cycles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,                      -- e.g. "Q3 2026"
  period_quarter INTEGER,                  -- 1-4; nullable for annual/custom cycles
  period_year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',    -- draft|active|grading|closed
  dept_id TEXT,                            -- nullable: NULL = company-wide cycle
  team_id TEXT,                            -- nullable: finer-grain scoping if dept absent
  closed_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_okr_cycles_org ON okr_cycles(organization_id);
CREATE INDEX IF NOT EXISTS idx_okr_cycles_org_status ON okr_cycles(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_okr_cycles_org_dept ON okr_cycles(organization_id, dept_id);

-- ============================================================================
-- 2. okr_check_ins — weekly cadence (Doerr/Google): confidence RAG + value/score + note.
-- ============================================================================
CREATE TABLE IF NOT EXISTS okr_check_ins (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  key_result_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  confidence TEXT,                 -- 'green'|'amber'|'red' (RAG)
  value DOUBLE PRECISION,          -- manual metric reading (metric-KR without a kpi_id link)
  score DOUBLE PRECISION,          -- explicit 0.0-1.0 override (milestone-KR, or manual grading)
  note TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_okr_checkins_kr ON okr_check_ins(key_result_id);
CREATE INDEX IF NOT EXISTS idx_okr_checkins_org ON okr_check_ins(organization_id);
CREATE INDEX IF NOT EXISTS idx_okr_checkins_kr_checked_at ON okr_check_ins(key_result_id, checked_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_okr_checkins_kr' AND table_name = 'okr_check_ins'
  ) THEN
    ALTER TABLE okr_check_ins
      ADD CONSTRAINT fk_okr_checkins_kr FOREIGN KEY (key_result_id)
      REFERENCES okr_key_results(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'migration 914: FK fk_okr_checkins_kr skipped/failed (ignored): %', SQLERRM;
END $$;

-- ============================================================================
-- 3. okr_objectives — extend (cycle_id, owner, description, status)
-- ============================================================================
ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS cycle_id TEXT;
ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'; -- draft|active|closed
ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_okr_objectives_cycle ON okr_objectives(cycle_id);
CREATE INDEX IF NOT EXISTS idx_okr_objectives_org ON okr_objectives(organization_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_okr_objectives_cycle' AND table_name = 'okr_objectives'
  ) THEN
    ALTER TABLE okr_objectives
      ADD CONSTRAINT fk_okr_objectives_cycle FOREIGN KEY (cycle_id)
      REFERENCES okr_cycles(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'migration 914: FK fk_okr_objectives_cycle skipped/failed (ignored): %', SQLERRM;
END $$;

-- ============================================================================
-- 4. okr_key_results — extend (kpi_id auto-score link, kr_type, score, kind, owner)
-- ============================================================================
ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS kpi_id TEXT;
ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS kr_type TEXT NOT NULL DEFAULT 'metric'; -- metric|milestone
ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS score DOUBLE PRECISION NOT NULL DEFAULT 0; -- 0.0-1.0, recomputed on write
ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'aspirational'; -- committed|aspirational
ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_okr_key_results_kpi ON okr_key_results(kpi_id);
CREATE INDEX IF NOT EXISTS idx_okr_key_results_objective ON okr_key_results(objective_id);
CREATE INDEX IF NOT EXISTS idx_okr_key_results_org ON okr_key_results(organization_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_okr_kr_kpi' AND table_name = 'okr_key_results'
  ) THEN
    ALTER TABLE okr_key_results
      ADD CONSTRAINT fk_okr_kr_kpi FOREIGN KEY (kpi_id)
      REFERENCES initiative_kpis(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Fail-soft, mirrors 912's pattern: never let an FK add block the run
  -- (e.g. legacy rows whose kpi_id no longer resolves).
  RAISE NOTICE 'migration 914: FK fk_okr_kr_kpi skipped/failed (ignored): %', SQLERRM;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_okr_kr_objective' AND table_name = 'okr_key_results'
  ) THEN
    ALTER TABLE okr_key_results
      ADD CONSTRAINT fk_okr_kr_objective FOREIGN KEY (objective_id)
      REFERENCES okr_objectives(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'migration 914: FK fk_okr_kr_objective skipped/failed (ignored): %', SQLERRM;
END $$;
