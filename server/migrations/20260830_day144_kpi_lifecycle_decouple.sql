-- Day 144: a KPI outlives the physical deletion of its initiative.
--
-- The KPI remains the parent of its mappings, deviations, measurements and
-- other dependent records. Only initiative-owned references are detached.

BEGIN;

ALTER TABLE initiative_kpis
  DROP CONSTRAINT IF EXISTS initiative_kpis_initiative_id_fkey;

ALTER TABLE initiative_kpis
  ALTER COLUMN initiative_id DROP NOT NULL,
  ADD CONSTRAINT initiative_kpis_initiative_id_fkey
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE SET NULL;

ALTER TABLE initiative_kpi_mappings
  DROP CONSTRAINT IF EXISTS initiative_kpi_mappings_initiative_id_fkey;

ALTER TABLE initiative_kpi_mappings
  ALTER COLUMN initiative_id DROP NOT NULL,
  ADD CONSTRAINT initiative_kpi_mappings_initiative_id_fkey
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE SET NULL;

COMMIT;

-- Reversal procedure (manual, deliberately not executed here):
-- 1. Resolve every initiative_kpis/initiative_kpi_mappings row whose
--    initiative_id is NULL by reattaching it to an existing initiative or by
--    making an explicit data-retention decision. Restoring NOT NULL before
--    that resolution must fail closed.
-- 2. Replace both SET NULL constraints with ON DELETE CASCADE constraints.
-- 3. Restore NOT NULL on both initiative_id columns only after the NULL count
--    is zero. Reversal restores the former destructive deletion semantics.
