-- Forward-only compatibility producer for databases whose historical baseline
-- ledger contains 20260719_baseline_gap.sql but whose physical OKR tables are
-- absent. This must sort before the RES-009 consumer on the same date.
-- Additive and idempotent; no historical migration or ledger row is rewritten.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS okr_objectives (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  label TEXT NOT NULL,
  parent_id TEXT,
  cycle_id TEXT,
  owner_user_id TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
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
  kpi_id TEXT,
  kr_type TEXT NOT NULL DEFAULT 'metric',
  score DOUBLE PRECISION NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'aspirational',
  owner_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS okr_cycles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  period_quarter INTEGER,
  period_year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  dept_id TEXT,
  team_id TEXT,
  closed_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS okr_check_ins (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  key_result_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  confidence TEXT,
  value DOUBLE PRECISION,
  score DOUBLE PRECISION,
  note TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_okr_cycles_org ON okr_cycles(organization_id);
CREATE INDEX IF NOT EXISTS idx_okr_cycles_org_status ON okr_cycles(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_okr_cycles_org_dept ON okr_cycles(organization_id, dept_id);
CREATE INDEX IF NOT EXISTS idx_okr_objectives_cycle ON okr_objectives(cycle_id);
CREATE INDEX IF NOT EXISTS idx_okr_objectives_org ON okr_objectives(organization_id);
CREATE INDEX IF NOT EXISTS idx_okr_key_results_kpi ON okr_key_results(kpi_id);
CREATE INDEX IF NOT EXISTS idx_okr_key_results_objective ON okr_key_results(objective_id);
CREATE INDEX IF NOT EXISTS idx_okr_key_results_org ON okr_key_results(organization_id);
CREATE INDEX IF NOT EXISTS idx_okr_checkins_kr ON okr_check_ins(key_result_id);
CREATE INDEX IF NOT EXISTS idx_okr_checkins_org ON okr_check_ins(organization_id);
CREATE INDEX IF NOT EXISTS idx_okr_checkins_kr_checked_at
  ON okr_check_ins(key_result_id, checked_at DESC);

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

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_okr_objectives_cycle' AND table_name = 'okr_objectives'
  ) THEN
    ALTER TABLE okr_objectives
      ADD CONSTRAINT fk_okr_objectives_cycle FOREIGN KEY (cycle_id)
      REFERENCES okr_cycles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_okr_kr_objective' AND table_name = 'okr_key_results'
  ) THEN
    ALTER TABLE okr_key_results
      ADD CONSTRAINT fk_okr_kr_objective FOREIGN KEY (objective_id)
      REFERENCES okr_objectives(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.initiative_kpis') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_okr_kr_kpi' AND table_name = 'okr_key_results'
  ) THEN
    ALTER TABLE okr_key_results
      ADD CONSTRAINT fk_okr_kr_kpi FOREIGN KEY (kpi_id)
      REFERENCES initiative_kpis(id) ON DELETE SET NULL;
  END IF;
END $$;
