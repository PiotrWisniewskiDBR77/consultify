-- KPI-E005 — measurement cadence prerequisite for the My KPIs read model.
--
-- Design: docs/product/results-vnext/KPI_E005_DESIGN.md §A.3, decyzja #4
-- ("additive ADD COLUMN ... NULL on the already-shipped, approved
-- rvn_kpi_definition_versions table, extend the relevant protect_* trigger
-- in the SAME migration, never a destructive/backfilling ALTER" — ratified
-- as the standing pattern for any future cadence-related column ROI/OKR
-- will need on an already-shipped table).
--
-- `listMyKpis`'s `branch_update_due_heuristic` (kpiPerspectivesRepository.ts)
-- reads this column to derive "this KPI has gone stale" when no explicit
-- rvn_platform_obligations row exists for it yet.

ALTER TABLE rvn_kpi_definition_versions
  ADD COLUMN IF NOT EXISTS measurement_frequency_days INT NULL
    CHECK (measurement_frequency_days IS NULL OR measurement_frequency_days > 0);

-- Extend rvn_kpi_definition_versions_protect_approved() (defined in
-- 20260810_rvn_kpi_core.sql) to also guard this new column — CREATE OR
-- REPLACE FUNCTION is idempotent; this is the FULL function body from that
-- migration with exactly one additional IS DISTINCT FROM clause appended to
-- the existing IF, per design §A.3's own instruction. The trigger itself
-- (trg_rvn_kpi_definition_versions_protect_approved) is not re-created here
-- — CREATE OR REPLACE FUNCTION changes its behavior in place, no DROP/CREATE
-- TRIGGER needed since the trigger's binding is to the function name/owner,
-- not its body.
CREATE OR REPLACE FUNCTION rvn_kpi_definition_versions_protect_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.approval_status = 'approved' THEN
    IF NEW.kpi_id IS DISTINCT FROM OLD.kpi_id
       OR NEW.version_number IS DISTINCT FROM OLD.version_number
       OR NEW.name IS DISTINCT FROM OLD.name
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.unit IS DISTINCT FROM OLD.unit
       OR NEW.target_geometry IS DISTINCT FROM OLD.target_geometry
       OR NEW.target_value IS DISTINCT FROM OLD.target_value
       OR NEW.target_min IS DISTINCT FROM OLD.target_min
       OR NEW.target_max IS DISTINCT FROM OLD.target_max
       OR NEW.warning_low IS DISTINCT FROM OLD.warning_low
       OR NEW.warning_high IS DISTINCT FROM OLD.warning_high
       OR NEW.critical_low IS DISTINCT FROM OLD.critical_low
       OR NEW.critical_high IS DISTINCT FROM OLD.critical_high
       OR NEW.binary_success_value IS DISTINCT FROM OLD.binary_success_value
       OR NEW.formula_text IS DISTINCT FROM OLD.formula_text
       OR NEW.approval_status IS DISTINCT FROM OLD.approval_status
       OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.measurement_frequency_days IS DISTINCT FROM OLD.measurement_frequency_days
    THEN
      RAISE EXCEPTION
        'rvn_kpi_definition_versions: version % is approved — only effective_to (and row_version/updated_at bookkeeping) may change',
        OLD.definition_version_id
        USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
