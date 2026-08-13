-- Finance v3 — Gate D (WP-D09b): Enterprise Valuation domain schema, part 2/2 — integrity.
--
-- Source: docs/validation/finance-v3/generated/gate-d/WP-D09_valuation_schema_ADR.md, sections
-- 7.3 (basket weight-sum, DEFERRABLE constraint trigger — transcribed verbatim from Zalacznik A),
-- 8 (terminal g<WACC), 9 (EV->Equity bridge as_of alignment — transcribed verbatim), 10
-- (sensitivity 5x5/1-base-cell gate), 11 (comps readiness gate — transcribed verbatim), 12.2/12.3
-- (Advisor staleness/freeze — transcribed verbatim from Zalacznik A), 12.4 (compare bridge
-- requires is_comparison=true). Parent-content-table immutability follows the same per-table
-- function pattern WP-D01/WP-D03/WP-D05/WP-D07 already established
-- (finance_stmt_lines_enforce_parent_immutability / finance_analysis_kpi_values_.../
-- finance_baseline_{schedules,assumptions,outputs}_.../finance_prediction_{...}_...) rather than
-- the ADR's own aspirational single shared "finance_valuation_enforce_parent_immutability()" —
-- documented divergence: Valuation's content tables reach their parent business_version_id via
-- three different join depths (direct column on variants/wacc_inputs/methods/ev_equity_bridge;
-- one hop via method_id on terminal/sensitivity_grids/comps; one hop via bridge_id on bridge
-- components; two hops via grid_id->method_id on sensitivity cells), so a single generic function
-- would need either dynamic SQL per call or a lookup table mapping table name to its join path —
-- more moving parts than nine small, explicit, independently-testable functions matching the
-- established convention. Advisor freeze/staleness (12.2/12.3) attach directly to
-- finance_business_versions and are genuinely table-agnostic (no-op for every non-Valuation row),
-- so those two ARE shared/generic, exactly as the ADR describes.

BEGIN;

-- ============================================================================
-- 1. finance_valuation_methods — basket weight-sum = 100 (or 0 while empty/DRAFT). Cross-row
--    aggregate, so a same-row CHECK cannot express it — first DEFERRABLE constraint trigger in
--    the whole Finance v3 program (ADR section 7.3), letting a multi-row rebalance (e.g. 34/33/33
--    inserted one at a time) be validated once at COMMIT instead of failing on the first
--    intermediate row. Transcribed verbatim from the ADR's Zalacznik A.
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_valuation_check_basket_weight_sum() RETURNS TRIGGER AS $$
DECLARE v_bv_id TEXT; v_count INTEGER; v_sum NUMERIC;
BEGIN
  v_bv_id := COALESCE(NEW.business_version_id, OLD.business_version_id);
  SELECT count(*), coalesce(sum(weight_pct), 0) INTO v_count, v_sum
    FROM finance_valuation_methods
    WHERE business_version_id = v_bv_id AND is_in_recommendation_basket = true;
  IF v_count > 0 AND abs(v_sum - 100) > 0.01 THEN
    RAISE EXCEPTION 'finance_valuation_methods: basket weights for business_version % sum to % (must be 100, or 0 basket rows for DRAFT)', v_bv_id, v_sum;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_valuation_methods_weight_sum ON finance_valuation_methods;
CREATE CONSTRAINT TRIGGER trg_finance_valuation_methods_weight_sum
  AFTER INSERT OR UPDATE OR DELETE ON finance_valuation_methods
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_check_basket_weight_sum();

-- ============================================================================
-- 2. finance_valuation_methods — comps readiness gate (ADR section 11): TRADING_COMPS /
--    PRECEDENT_TRANSACTIONS cannot become READY with zero usable (non-excluded, present-value)
--    peer rows — closes the "0 comps configured" vs. "READY with an empty peer set" ambiguity
--    WP-D05 section 12 pt.2 already found in a different shape. Transcribed verbatim from the
--    ADR's Zalacznik A.
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_valuation_methods_check_comps_readiness() RETURNS TRIGGER AS $$
DECLARE v_usable_comps INTEGER;
BEGIN
  IF NEW.readiness = 'READY' AND NEW.method_type IN ('TRADING_COMPS', 'PRECEDENT_TRANSACTIONS') THEN
    SELECT count(*) INTO v_usable_comps FROM finance_valuation_comps
      WHERE method_id = NEW.id AND is_outlier_excluded = false
        AND metric_value_status IN ('PRESENT_ZERO', 'PRESENT_NONZERO');
    IF v_usable_comps = 0 THEN
      RAISE EXCEPTION 'finance_valuation_methods: method % (%) cannot be READY with zero usable comps rows', NEW.id, NEW.method_type;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_valuation_methods_check_comps_readiness ON finance_valuation_methods;
CREATE TRIGGER trg_finance_valuation_methods_check_comps_readiness
  BEFORE INSERT OR UPDATE ON finance_valuation_methods
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_methods_check_comps_readiness();

-- ============================================================================
-- 3. finance_valuation_terminal — g < WACC, physically enforced (ADR section 8). Cross-table read
--    to finance_valuation_wacc_inputs (Postgres forbids subqueries in CHECK), so this is a
--    trigger, not a same-row CHECK — same reasoning WP-D01/D05/D07 already documented repeatedly
--    for analogous rules. Enforced ONLY once wacc_computed_pct is known (DEC-FIN-009): drafting
--    assumptions before WACC exists is never blocked.
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_valuation_terminal_check_g_below_wacc() RETURNS TRIGGER AS $$
DECLARE v_bv_id TEXT; v_wacc NUMERIC;
BEGIN
  IF NEW.convention = 'GORDON_GROWTH' AND NEW.g_pct IS NOT NULL THEN
    SELECT business_version_id INTO v_bv_id FROM finance_valuation_methods WHERE id = NEW.method_id;
    SELECT wacc_computed_pct INTO v_wacc FROM finance_valuation_wacc_inputs WHERE business_version_id = v_bv_id;
    IF v_wacc IS NOT NULL AND NEW.g_pct >= v_wacc THEN
      RAISE EXCEPTION 'finance_valuation_terminal: g_pct (%) must be strictly less than computed WACC (%) for method %', NEW.g_pct, v_wacc, NEW.method_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_valuation_terminal_check_g_below_wacc ON finance_valuation_terminal;
CREATE TRIGGER trg_finance_valuation_terminal_check_g_below_wacc
  BEFORE INSERT OR UPDATE ON finance_valuation_terminal
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_terminal_check_g_below_wacc();

-- ============================================================================
-- 4. finance_valuation_ev_equity_bridge_components — as_of alignment (ADR section 9). Cross-row
--    read to the sibling header, so a trigger, not a CHECK. Deliberately a hard block, stricter
--    than DEC-FIN-009's Info/Warning/Material/Critical tiers (ADR section 15 pt.1, flagged for
--    owner confirmation) — a misaligned as-of date produces a number with no defined meaning at a
--    single point in time, read here as the same class of problem DEC-FIN-009 already excludes
--    from tolerance. Transcribed verbatim from the ADR's Zalacznik A.
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_bridge_check_as_of_alignment() RETURNS TRIGGER AS $$
DECLARE v_header_as_of DATE;
BEGIN
  SELECT as_of_date INTO v_header_as_of FROM finance_valuation_ev_equity_bridge WHERE id = NEW.bridge_id;
  IF NEW.as_of_date <> v_header_as_of THEN
    RAISE EXCEPTION 'finance_valuation_ev_equity_bridge_components: component as_of_date % does not match bridge header as_of_date % (bridge %)', NEW.as_of_date, v_header_as_of, NEW.bridge_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_bridge_check_as_of_alignment ON finance_valuation_ev_equity_bridge_components;
CREATE TRIGGER trg_finance_bridge_check_as_of_alignment
  BEFORE INSERT OR UPDATE ON finance_valuation_ev_equity_bridge_components
  FOR EACH ROW EXECUTE FUNCTION finance_bridge_check_as_of_alignment();

-- ============================================================================
-- 5. finance_valuation_sensitivity_cells / _grids — 25-cell + exactly-1-base-cell, enforced only
--    when grid_status='COMPLETE' (ADR section 10), mirroring WP-D05's readiness-gate philosophy
--    ("no row present != row present and MISSING", applied here proactively rather than after the
--    fact). Two triggers: one deferred constraint trigger on the cells (so filling 25 cells one
--    INSERT at a time inside a single transaction never fails on an intermediate count), one
--    regular trigger on the header's own grid_status transition (covers "all 25 cells already
--    exist, now flip the header to COMPLETE" in one statement).
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_sensitivity_check_grid_complete() RETURNS TRIGGER AS $$
DECLARE v_grid_id TEXT; v_status TEXT; v_count INTEGER; v_base_count INTEGER;
BEGIN
  v_grid_id := COALESCE(NEW.grid_id, OLD.grid_id);
  SELECT grid_status INTO v_status FROM finance_valuation_sensitivity_grids WHERE id = v_grid_id;
  IF v_status = 'COMPLETE' THEN
    SELECT count(*), count(*) FILTER (WHERE is_base_cell) INTO v_count, v_base_count
      FROM finance_valuation_sensitivity_cells WHERE grid_id = v_grid_id;
    IF v_count != 25 THEN
      RAISE EXCEPTION 'finance_valuation_sensitivity_cells: grid % is COMPLETE but has % cells (must be 25)', v_grid_id, v_count;
    END IF;
    IF v_base_count != 1 THEN
      RAISE EXCEPTION 'finance_valuation_sensitivity_cells: grid % is COMPLETE but has % base cells (must be exactly 1)', v_grid_id, v_base_count;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_valuation_sensitivity_cells_grid_complete ON finance_valuation_sensitivity_cells;
CREATE CONSTRAINT TRIGGER trg_finance_valuation_sensitivity_cells_grid_complete
  AFTER INSERT OR UPDATE OR DELETE ON finance_valuation_sensitivity_cells
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION finance_sensitivity_check_grid_complete();

CREATE OR REPLACE FUNCTION finance_sensitivity_check_grid_complete_on_status() RETURNS TRIGGER AS $$
DECLARE v_count INTEGER; v_base_count INTEGER;
BEGIN
  IF NEW.grid_status = 'COMPLETE' THEN
    SELECT count(*), count(*) FILTER (WHERE is_base_cell) INTO v_count, v_base_count
      FROM finance_valuation_sensitivity_cells WHERE grid_id = NEW.id;
    IF v_count != 25 THEN
      RAISE EXCEPTION 'finance_valuation_sensitivity_grids: grid % cannot be marked COMPLETE with % cells (must be 25)', NEW.id, v_count;
    END IF;
    IF v_base_count != 1 THEN
      RAISE EXCEPTION 'finance_valuation_sensitivity_grids: grid % cannot be marked COMPLETE with % base cells (must be exactly 1)', NEW.id, v_base_count;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_valuation_sensitivity_grids_complete_on_status ON finance_valuation_sensitivity_grids;
CREATE CONSTRAINT TRIGGER trg_finance_valuation_sensitivity_grids_complete_on_status
  AFTER UPDATE OF grid_status ON finance_valuation_sensitivity_grids
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION finance_sensitivity_check_grid_complete_on_status();

-- ============================================================================
-- 6. finance_valuation_advisor_outputs / finance_business_versions — staleness on recompute (ADR
--    section 12.2) and freeze on approval (ADR section 12.3). Both attach to
--    finance_business_versions, fire for EVERY artifact type in the system, and are a genuine
--    no-op for every non-Valuation row (UPDATE ... WHERE business_version_id = ... against a
--    child table with zero matching rows does nothing). This is the one place this migration
--    reuses the ADR's own "generic, table-agnostic" framing literally: zero new code in
--    approveVersion() (server/src/services/finance/canonical/artifactVersionService.ts:389),
--    zero new call site. Transcribed verbatim from the ADR's Zalacznik A.
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_valuation_mark_advisor_stale_on_recompute() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.compute_snapshot_id IS DISTINCT FROM OLD.compute_snapshot_id THEN
    UPDATE finance_valuation_advisor_outputs
      SET is_stale = true, stale_since = now()
      WHERE business_version_id = NEW.business_version_id
        AND is_frozen = false
        AND compute_snapshot_id IS DISTINCT FROM NEW.compute_snapshot_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_bv_mark_advisor_stale_on_recompute ON finance_business_versions;
CREATE TRIGGER trg_finance_bv_mark_advisor_stale_on_recompute
  AFTER UPDATE OF compute_snapshot_id ON finance_business_versions
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_mark_advisor_stale_on_recompute();

CREATE OR REPLACE FUNCTION finance_valuation_freeze_advisor_on_approval() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'APPROVED' AND (OLD.status IS DISTINCT FROM 'APPROVED') THEN
    UPDATE finance_valuation_advisor_outputs
      SET is_frozen = true, frozen_at = now()
      WHERE business_version_id = NEW.business_version_id AND is_frozen = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_bv_freeze_advisor_on_approval ON finance_business_versions;
CREATE TRIGGER trg_finance_bv_freeze_advisor_on_approval
  AFTER UPDATE OF status ON finance_business_versions
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_freeze_advisor_on_approval();

-- ============================================================================
-- 7. finance_valuation_advisor_outputs — immutability once frozen (ADR section 12.3): allow-list-
--    by-diff idiom identical to finance_bv_enforce_immutability (WP-B01), comparing whole rows as
--    JSONB instead of a hardcoded column list so future reconciliation columns automatically
--    inherit the guard. Blocks UPDATE/DELETE on an already-frozen row; a separate trigger blocks
--    brand-new INSERTs once the parent variant is APPROVED (Advisor is pre-approval by
--    definition; a Reopen creates a new business_version_id where the Advisor starts fresh).
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_advisor_outputs_enforce_freeze() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_frozen THEN
      RAISE EXCEPTION 'finance_valuation_advisor_outputs: % is frozen (approved), cannot delete', OLD.id;
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.is_frozen THEN
    IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
      RAISE EXCEPTION 'finance_valuation_advisor_outputs: % is frozen (approved), no mutation permitted', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_advisor_outputs_enforce_freeze ON finance_valuation_advisor_outputs;
CREATE TRIGGER trg_finance_advisor_outputs_enforce_freeze
  BEFORE UPDATE OR DELETE ON finance_valuation_advisor_outputs
  FOR EACH ROW EXECUTE FUNCTION finance_advisor_outputs_enforce_freeze();

CREATE OR REPLACE FUNCTION finance_valuation_advisor_outputs_no_new_after_approval() RETURNS TRIGGER AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM finance_business_versions WHERE business_version_id = NEW.business_version_id;
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_valuation_advisor_outputs: parent business_version % is APPROVED; new Advisor findings not permitted', NEW.business_version_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_valuation_advisor_outputs_no_new_after_approval ON finance_valuation_advisor_outputs;
CREATE TRIGGER trg_finance_valuation_advisor_outputs_no_new_after_approval
  BEFORE INSERT ON finance_valuation_advisor_outputs
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_advisor_outputs_no_new_after_approval();

-- ============================================================================
-- 8. finance_valuation_advisor_output_variants — a bridge row may exist only when its parent
--    finding is itself a comparison (ADR section 12.4).
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_valuation_advisor_output_variants_require_comparison() RETURNS TRIGGER AS $$
DECLARE v_is_comparison BOOLEAN;
BEGIN
  SELECT is_comparison INTO v_is_comparison FROM finance_valuation_advisor_outputs WHERE id = NEW.advisor_output_id;
  IF NOT COALESCE(v_is_comparison, false) THEN
    RAISE EXCEPTION 'finance_valuation_advisor_output_variants: parent finding % has is_comparison=false; cannot attach compared-variant rows', NEW.advisor_output_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_valuation_advisor_output_variants_require_comparison ON finance_valuation_advisor_output_variants;
CREATE TRIGGER trg_finance_valuation_advisor_output_variants_require_comparison
  BEFORE INSERT ON finance_valuation_advisor_output_variants
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_advisor_output_variants_require_comparison();

-- ============================================================================
-- 9. Parent-content-table immutability (ADR "Approved is immutable" carried into every Valuation
--    content table, same discipline as WP-D01/D03/D05/D07's own per-table guards). See header
--    note on why this is nine explicit functions rather than one generic one.
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_valuation_variants_enforce_parent_immutability() RETURNS TRIGGER AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM finance_business_versions
    WHERE business_version_id = COALESCE(NEW.business_version_id, OLD.business_version_id);
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_valuation_variants: parent business_version % is APPROVED and immutable; % not permitted',
      COALESCE(NEW.business_version_id, OLD.business_version_id), TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_valuation_variants_parent_immutability ON finance_valuation_variants;
CREATE TRIGGER trg_finance_valuation_variants_parent_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_valuation_variants
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_variants_enforce_parent_immutability();

CREATE OR REPLACE FUNCTION finance_valuation_wacc_inputs_enforce_parent_immutability() RETURNS TRIGGER AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM finance_business_versions
    WHERE business_version_id = COALESCE(NEW.business_version_id, OLD.business_version_id);
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_valuation_wacc_inputs: parent business_version % is APPROVED and immutable; % not permitted',
      COALESCE(NEW.business_version_id, OLD.business_version_id), TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_valuation_wacc_inputs_parent_immutability ON finance_valuation_wacc_inputs;
CREATE TRIGGER trg_finance_valuation_wacc_inputs_parent_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_valuation_wacc_inputs
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_wacc_inputs_enforce_parent_immutability();

CREATE OR REPLACE FUNCTION finance_valuation_methods_enforce_parent_immutability() RETURNS TRIGGER AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM finance_business_versions
    WHERE business_version_id = COALESCE(NEW.business_version_id, OLD.business_version_id);
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_valuation_methods: parent business_version % is APPROVED and immutable; % not permitted',
      COALESCE(NEW.business_version_id, OLD.business_version_id), TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_valuation_methods_parent_immutability ON finance_valuation_methods;
CREATE TRIGGER trg_finance_valuation_methods_parent_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_valuation_methods
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_methods_enforce_parent_immutability();

CREATE OR REPLACE FUNCTION finance_valuation_terminal_enforce_parent_immutability() RETURNS TRIGGER AS $$
DECLARE v_status TEXT; v_method_id TEXT;
BEGIN
  v_method_id := COALESCE(NEW.method_id, OLD.method_id);
  SELECT fbv.status INTO v_status
    FROM finance_valuation_methods m JOIN finance_business_versions fbv ON fbv.business_version_id = m.business_version_id
    WHERE m.id = v_method_id;
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_valuation_terminal: parent business_version (via method %) is APPROVED and immutable; % not permitted', v_method_id, TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_valuation_terminal_parent_immutability ON finance_valuation_terminal;
CREATE TRIGGER trg_finance_valuation_terminal_parent_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_valuation_terminal
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_terminal_enforce_parent_immutability();

CREATE OR REPLACE FUNCTION finance_valuation_ev_bridge_enforce_parent_immutability() RETURNS TRIGGER AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM finance_business_versions
    WHERE business_version_id = COALESCE(NEW.business_version_id, OLD.business_version_id);
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_valuation_ev_equity_bridge: parent business_version % is APPROVED and immutable; % not permitted',
      COALESCE(NEW.business_version_id, OLD.business_version_id), TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_valuation_ev_bridge_parent_immutability ON finance_valuation_ev_equity_bridge;
CREATE TRIGGER trg_finance_valuation_ev_bridge_parent_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_valuation_ev_equity_bridge
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_ev_bridge_enforce_parent_immutability();

CREATE OR REPLACE FUNCTION finance_valuation_ev_bridge_components_enforce_parent_immutability() RETURNS TRIGGER AS $$
DECLARE v_status TEXT; v_bridge_id TEXT;
BEGIN
  v_bridge_id := COALESCE(NEW.bridge_id, OLD.bridge_id);
  SELECT fbv.status INTO v_status
    FROM finance_valuation_ev_equity_bridge b JOIN finance_business_versions fbv ON fbv.business_version_id = b.business_version_id
    WHERE b.id = v_bridge_id;
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_valuation_ev_equity_bridge_components: parent business_version (via bridge %) is APPROVED and immutable; % not permitted', v_bridge_id, TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_valuation_ev_bridge_components_parent_immutability ON finance_valuation_ev_equity_bridge_components;
CREATE TRIGGER trg_finance_valuation_ev_bridge_components_parent_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_valuation_ev_equity_bridge_components
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_ev_bridge_components_enforce_parent_immutability();

CREATE OR REPLACE FUNCTION finance_valuation_sensitivity_grids_enforce_parent_immutability() RETURNS TRIGGER AS $$
DECLARE v_status TEXT; v_method_id TEXT;
BEGIN
  v_method_id := COALESCE(NEW.method_id, OLD.method_id);
  SELECT fbv.status INTO v_status
    FROM finance_valuation_methods m JOIN finance_business_versions fbv ON fbv.business_version_id = m.business_version_id
    WHERE m.id = v_method_id;
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_valuation_sensitivity_grids: parent business_version (via method %) is APPROVED and immutable; % not permitted', v_method_id, TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_valuation_sensitivity_grids_parent_immutability ON finance_valuation_sensitivity_grids;
CREATE TRIGGER trg_finance_valuation_sensitivity_grids_parent_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_valuation_sensitivity_grids
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_sensitivity_grids_enforce_parent_immutability();

CREATE OR REPLACE FUNCTION finance_valuation_sensitivity_cells_enforce_parent_immutability() RETURNS TRIGGER AS $$
DECLARE v_status TEXT; v_grid_id TEXT;
BEGIN
  v_grid_id := COALESCE(NEW.grid_id, OLD.grid_id);
  SELECT fbv.status INTO v_status
    FROM finance_valuation_sensitivity_grids g
    JOIN finance_valuation_methods m ON m.id = g.method_id
    JOIN finance_business_versions fbv ON fbv.business_version_id = m.business_version_id
    WHERE g.id = v_grid_id;
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_valuation_sensitivity_cells: parent business_version (via grid %) is APPROVED and immutable; % not permitted', v_grid_id, TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_valuation_sensitivity_cells_parent_immutability ON finance_valuation_sensitivity_cells;
CREATE TRIGGER trg_finance_valuation_sensitivity_cells_parent_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_valuation_sensitivity_cells
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_sensitivity_cells_enforce_parent_immutability();

CREATE OR REPLACE FUNCTION finance_valuation_comps_enforce_parent_immutability() RETURNS TRIGGER AS $$
DECLARE v_status TEXT; v_method_id TEXT;
BEGIN
  v_method_id := COALESCE(NEW.method_id, OLD.method_id);
  SELECT fbv.status INTO v_status
    FROM finance_valuation_methods m JOIN finance_business_versions fbv ON fbv.business_version_id = m.business_version_id
    WHERE m.id = v_method_id;
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_valuation_comps: parent business_version (via method %) is APPROVED and immutable; % not permitted', v_method_id, TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_valuation_comps_parent_immutability ON finance_valuation_comps;
CREATE TRIGGER trg_finance_valuation_comps_parent_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_valuation_comps
  FOR EACH ROW EXECUTE FUNCTION finance_valuation_comps_enforce_parent_immutability();

COMMIT;
