-- M16 / 2.6 + 2.8 — Benefit Profile S-curve + Benefit Category Taxonomy.
--
-- 2.6 Benefit Profile S-curve: per-period planned vs actual cumulative benefit
--     realization points, so a benefit's realization can be charted as an
--     S-curve (plan line vs actual line) and slip computed at the latest period.
--
-- 2.8 Category Taxonomy: classify each benefit on benefits_register so we know
--     whether it is eligible for finance reconciliation / banking.
--       - hardness:   hard | soft
--       - value_type: cost_out | revenue_up | working_capital | cost_avoidance
--       - recurrence: run_rate | one_time
--     Reconciliation/banking is reserved for hard + run_rate benefits.
--
-- Postgres-safe: IF NOT EXISTS everywhere so re-running is a no-op.

-- ---------------------------------------------------------------------------
-- 2.6 Benefit Profile S-curve points
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS benefit_profile_points (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  initiative_id TEXT NOT NULL,
  benefit_id TEXT,
  period TEXT NOT NULL,
  planned_cumulative REAL,
  actual_cumulative REAL,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_bpp_org ON benefit_profile_points(organization_id);
CREATE INDEX IF NOT EXISTS idx_bpp_initiative ON benefit_profile_points(organization_id, initiative_id, period ASC);
CREATE INDEX IF NOT EXISTS idx_bpp_benefit ON benefit_profile_points(benefit_id);

-- ---------------------------------------------------------------------------
-- 2.8 Benefit category taxonomy columns on benefits_register
-- ---------------------------------------------------------------------------
ALTER TABLE benefits_register ADD COLUMN IF NOT EXISTS hardness TEXT;     -- hard | soft
ALTER TABLE benefits_register ADD COLUMN IF NOT EXISTS value_type TEXT;   -- cost_out | revenue_up | working_capital | cost_avoidance
ALTER TABLE benefits_register ADD COLUMN IF NOT EXISTS recurrence TEXT;   -- run_rate | one_time
