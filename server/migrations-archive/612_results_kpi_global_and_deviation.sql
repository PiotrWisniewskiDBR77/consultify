-- Migration 612: Results KPI global scope + Deviation Management (R1)
-- Scope:
-- - Allow global KPIs (initiative_id nullable) with org scoping
-- - Add baseline/current + threshold contract for deterministic evaluation
-- - Add deviation cases + action plan items

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1) initiative_kpis: global KPI support + thresholds
-- ============================================

ALTER TABLE initiative_kpis
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

-- Backfill organization_id for existing initiative-bound KPIs
UPDATE initiative_kpis k
SET organization_id = i.organization_id
FROM initiatives i
WHERE k.organization_id IS NULL
  AND k.initiative_id IS NOT NULL
  AND i.id = k.initiative_id;

-- Global KPI: allow initiative_id to be NULL
ALTER TABLE initiative_kpis
  ALTER COLUMN initiative_id DROP NOT NULL;

-- KPI definition enrichment
ALTER TABLE initiative_kpis
  ADD COLUMN IF NOT EXISTS baseline_value REAL,
  ADD COLUMN IF NOT EXISTS current_value REAL,
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT,
  ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'HIGHER_IS_BETTER',
  ADD COLUMN IF NOT EXISTS threshold_mode TEXT DEFAULT 'PERCENT_FROM_TARGET',
  ADD COLUMN IF NOT EXISTS amber_threshold_pct REAL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS red_threshold_pct REAL DEFAULT 0.20,
  ADD COLUMN IF NOT EXISTS amber_threshold_abs REAL,
  ADD COLUMN IF NOT EXISTS red_threshold_abs REAL;

-- Normalize legacy rows (best-effort)
UPDATE initiative_kpis
SET direction = 'HIGHER_IS_BETTER'
WHERE direction IS NULL OR direction = '';

UPDATE initiative_kpis
SET threshold_mode = 'PERCENT_FROM_TARGET'
WHERE threshold_mode IS NULL OR threshold_mode = '';

-- Guardrails (add constraints only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'initiative_kpis_direction_chk'
  ) THEN
    ALTER TABLE initiative_kpis
      ADD CONSTRAINT initiative_kpis_direction_chk
      CHECK (direction IN ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'initiative_kpis_threshold_mode_chk'
  ) THEN
    ALTER TABLE initiative_kpis
      ADD CONSTRAINT initiative_kpis_threshold_mode_chk
      CHECK (threshold_mode IN ('ABSOLUTE', 'PERCENT_FROM_TARGET'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_initiative_kpis_org ON initiative_kpis(organization_id);
CREATE INDEX IF NOT EXISTS idx_initiative_kpis_initiative ON initiative_kpis(initiative_id);

-- NOTE: We intentionally do NOT set organization_id NOT NULL here to avoid
-- breaking legacy datasets with inconsistent initiatives rows. The API will
-- enforce org scoping and reject writes without orgId.

-- ============================================
-- 2) Deviation cases + action items
-- ============================================

CREATE TABLE IF NOT EXISTS kpi_deviation_cases (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  kpi_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE,
  severity TEXT NOT NULL CHECK (severity IN ('AMBER', 'RED')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'MITIGATING', 'RESOLVED', 'CLOSED')),
  owner_user_id TEXT,
  deviation_summary TEXT,
  rca_text TEXT,
  detected_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  detected_by TEXT DEFAULT 'system',
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, kpi_id, period_start),
  FOREIGN KEY (kpi_id) REFERENCES initiative_kpis(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kpi_dev_cases_org ON kpi_deviation_cases(organization_id);
CREATE INDEX IF NOT EXISTS idx_kpi_dev_cases_kpi ON kpi_deviation_cases(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_dev_cases_status ON kpi_deviation_cases(status);
CREATE INDEX IF NOT EXISTS idx_kpi_dev_cases_period ON kpi_deviation_cases(period_start);

CREATE TABLE IF NOT EXISTS kpi_deviation_actions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_id TEXT NOT NULL,
  title TEXT NOT NULL,
  owner_user_id TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DONE', 'CANCELLED')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES kpi_deviation_cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kpi_dev_actions_case ON kpi_deviation_actions(case_id);
CREATE INDEX IF NOT EXISTS idx_kpi_dev_actions_status ON kpi_deviation_actions(status);

