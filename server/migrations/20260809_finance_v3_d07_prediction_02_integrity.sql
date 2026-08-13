-- Finance v3 — Gate D (WP-D07b): Prediction / Scenario Engine domain schema, part 2/3 — integrity
-- controls.
--
-- Source: docs/validation/finance-v3/generated/gate-d/WP-D07_prediction_schema_ADR.md sections 5
-- (scenario_mode hierarchy — which child tables each mode allows), 8 (Base = Baseline, input side
-- section 8.1 + output side section 8.2), Zalacznik A (literal, live-tested trigger bodies for
-- finance_prediction_gate_driver_overrides / finance_prediction_forbid_standard_base_outputs /
-- finance_prediction_scenario_mode_transition_guard — transcribed verbatim below, plus the "same
-- shape repeated for finance_prediction_initiatives / finance_prediction_financing" the ADR's own
-- Zalacznik A comment explicitly calls for).
--
-- Runs after ..._01_tables.sql (these functions/triggers reference tables created there) and before
-- ..._03_readiness.sql (the readiness gate / detect_overlaps queries these tables and the
-- preflight/conflict-resolution rows this file's gating does NOT block — see section 6.2 note below).
--
-- Same "cross-row lookup -> trigger, not CHECK" discipline WP-D01/WP-D03/WP-D05 already established
-- (Postgres CHECK does not allow subqueries).

BEGIN;

-- ============================================================================
-- Physical layer, input side — Base = Baseline (ADR section 8.1) plus the scenario_mode hierarchy
-- (section 5.2-5.4): which of the three mutable child tables (driver_overrides/initiatives/
-- financing) each scenario_mode allows. Transcribed verbatim from the ADR's Zalacznik A (already
-- live-tested — TEST 1/4/5/7) for finance_prediction_driver_overrides; the ADR's own comment ("Same
-- shape repeated for finance_prediction_initiatives ... and finance_prediction_financing ...")
-- is implemented literally below as two sibling functions, same shape, different mode rule.
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_prediction_gate_driver_overrides() RETURNS TRIGGER AS $$
DECLARE v_mode TEXT;
BEGIN
  v_mode := (SELECT scenario_mode FROM finance_prediction_scenarios WHERE business_version_id = NEW.business_version_id);
  IF v_mode IS NULL THEN
    RAISE EXCEPTION 'finance_prediction_driver_overrides: no finance_prediction_scenarios row for business_version_id %', NEW.business_version_id;
  END IF;
  IF v_mode = 'STANDARD_BASE' THEN
    RAISE EXCEPTION 'finance_prediction_driver_overrides: scenario_mode=STANDARD_BASE forbids any driver override (DEC-FIN item 3, Base = Baseline)';
  END IF;
  IF v_mode = 'STANDARD_UPSIDE' AND NEW.override_source != 'STANDARD_PRESET_UPSIDE' THEN
    RAISE EXCEPTION 'finance_prediction_driver_overrides: scenario_mode=STANDARD_UPSIDE requires override_source=STANDARD_PRESET_UPSIDE, got %', NEW.override_source;
  END IF;
  IF v_mode = 'STANDARD_DOWNSIDE' AND NEW.override_source != 'STANDARD_PRESET_DOWNSIDE' THEN
    RAISE EXCEPTION 'finance_prediction_driver_overrides: scenario_mode=STANDARD_DOWNSIDE requires override_source=STANDARD_PRESET_DOWNSIDE, got %', NEW.override_source;
  END IF;
  -- DRIVER_OVERRIDE and FUNDAMENTAL_INITIATIVE both allow driver overrides unconditionally (ADR
  -- section 5.4) — no further check needed for those two modes.
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_prediction_gate_driver_overrides ON finance_prediction_driver_overrides;
CREATE TRIGGER trg_finance_prediction_gate_driver_overrides
  BEFORE INSERT OR UPDATE ON finance_prediction_driver_overrides
  FOR EACH ROW EXECUTE FUNCTION finance_prediction_gate_driver_overrides();

-- finance_prediction_initiatives — "tryb C" content, ONLY allowed once the scenario has been
-- promoted to FUNDAMENTAL_INITIATIVE (ADR section 5.4 — DRIVER_OVERRIDE explicitly forbids
-- initiatives; live-tested TEST 5/7).
CREATE OR REPLACE FUNCTION finance_prediction_gate_initiatives() RETURNS TRIGGER AS $$
DECLARE v_mode TEXT;
BEGIN
  v_mode := (SELECT scenario_mode FROM finance_prediction_scenarios WHERE business_version_id = NEW.business_version_id);
  IF v_mode IS NULL THEN
    RAISE EXCEPTION 'finance_prediction_initiatives: no finance_prediction_scenarios row for business_version_id %', NEW.business_version_id;
  END IF;
  IF v_mode != 'FUNDAMENTAL_INITIATIVE' THEN
    RAISE EXCEPTION 'finance_prediction_initiatives: scenario_mode=% does not allow initiatives — promote the scenario first (only DRIVER_OVERRIDE -> FUNDAMENTAL_INITIATIVE is a valid transition)', v_mode;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_prediction_gate_initiatives ON finance_prediction_initiatives;
CREATE TRIGGER trg_finance_prediction_gate_initiatives
  BEFORE INSERT OR UPDATE ON finance_prediction_initiatives
  FOR EACH ROW EXECUTE FUNCTION finance_prediction_gate_initiatives();

-- finance_prediction_financing — forbidden for all three STANDARD_* modes (Base must stay
-- structurally empty; Upside/Downside must stay a pure, reproducible driver preset without
-- financing decisions mixed in, ADR section 5.3). Allowed for DRIVER_OVERRIDE and
-- FUNDAMENTAL_INITIATIVE.
CREATE OR REPLACE FUNCTION finance_prediction_gate_financing() RETURNS TRIGGER AS $$
DECLARE v_mode TEXT;
BEGIN
  v_mode := (SELECT scenario_mode FROM finance_prediction_scenarios WHERE business_version_id = NEW.business_version_id);
  IF v_mode IS NULL THEN
    RAISE EXCEPTION 'finance_prediction_financing: no finance_prediction_scenarios row for business_version_id %', NEW.business_version_id;
  END IF;
  IF v_mode IN ('STANDARD_BASE', 'STANDARD_UPSIDE', 'STANDARD_DOWNSIDE') THEN
    RAISE EXCEPTION 'finance_prediction_financing: scenario_mode=% forbids financing decisions (only DRIVER_OVERRIDE / FUNDAMENTAL_INITIATIVE allow financing, ADR section 5.3/5.4)', v_mode;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_prediction_gate_financing ON finance_prediction_financing;
CREATE TRIGGER trg_finance_prediction_gate_financing
  BEFORE INSERT OR UPDATE ON finance_prediction_financing
  FOR EACH ROW EXECUTE FUNCTION finance_prediction_gate_financing();

-- ============================================================================
-- One-way scenario_mode promotion (ADR section 5.4) — the only combinability transition allowed.
-- Transcribed verbatim from the ADR's Zalacznik A (already live-tested — TEST 6/6b), extended here
-- to stamp scenario_mode_promoted_at/_by (ADR section 4.1: "obsadzone wylacznie przy jedynym
-- dozwolonym przejsciu") — the ADR's literal snippet omits this stamping for brevity but section 4.1
-- requires it, so it is added here, documented rather than silently reproduced from the snippet only.
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_prediction_scenario_mode_transition_guard() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.scenario_mode = OLD.scenario_mode THEN RETURN NEW; END IF;
  IF OLD.scenario_mode = 'DRIVER_OVERRIDE' AND NEW.scenario_mode = 'FUNDAMENTAL_INITIATIVE' THEN
    NEW.scenario_mode_promoted_at := now();
    IF NEW.scenario_mode_promoted_by IS NULL THEN
      RAISE EXCEPTION 'finance_prediction_scenarios: scenario_mode_promoted_by is required when promoting % -> %', OLD.scenario_mode, NEW.scenario_mode;
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'finance_prediction_scenarios: scenario_mode transition % -> % is not allowed (only DRIVER_OVERRIDE -> FUNDAMENTAL_INITIATIVE, one-way, never downgrade, never touching STANDARD_*)', OLD.scenario_mode, NEW.scenario_mode;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_prediction_scenario_mode_transition_guard ON finance_prediction_scenarios;
CREATE TRIGGER trg_finance_prediction_scenario_mode_transition_guard
  BEFORE UPDATE OF scenario_mode ON finance_prediction_scenarios
  FOR EACH ROW EXECUTE FUNCTION finance_prediction_scenario_mode_transition_guard();

-- Generic updated_at bump for finance_prediction_scenarios on any other update (mirrors the
-- transition-guard trigger's own NEW.updated_at handling for the scenario_mode-changing path).
CREATE OR REPLACE FUNCTION finance_prediction_scenarios_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_prediction_scenarios_touch_updated_at ON finance_prediction_scenarios;
CREATE TRIGGER trg_finance_prediction_scenarios_touch_updated_at
  BEFORE UPDATE ON finance_prediction_scenarios
  FOR EACH ROW EXECUTE FUNCTION finance_prediction_scenarios_touch_updated_at();

-- ============================================================================
-- Physical layer, output side — Base = Baseline (ADR section 8.2). Transcribed verbatim from the
-- ADR's Zalacznik A (already live-tested — TEST 2).
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_prediction_forbid_standard_base_outputs() RETURNS TRIGGER AS $$
DECLARE v_mode TEXT;
BEGIN
  v_mode := (SELECT scenario_mode FROM finance_prediction_scenarios WHERE business_version_id = NEW.business_version_id);
  IF v_mode = 'STANDARD_BASE' THEN
    RAISE EXCEPTION 'finance_prediction_outputs: scenario_mode=STANDARD_BASE may never own its own output rows — Models/Results must read finance_baseline_outputs through the MODEL_TO_SCENARIO lineage edge instead (finance_prediction_outputs_effective view), so Base cannot physically diverge from Baseline';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_prediction_forbid_standard_base_outputs ON finance_prediction_outputs;
CREATE TRIGGER trg_finance_prediction_forbid_standard_base_outputs
  BEFORE INSERT OR UPDATE ON finance_prediction_outputs
  FOR EACH ROW EXECUTE FUNCTION finance_prediction_forbid_standard_base_outputs();

-- ============================================================================
-- Content freeze — driver_overrides / initiatives / impact_chain / financing / outputs, once the
-- parent business_version is APPROVED (ADR section 3 "parent immutability x5", live-tested TEST 13
-- on driver_overrides). Same per-table pattern WP-D01/WP-D03/WP-D05 already established
-- (finance_stmt_lines_enforce_parent_immutability / finance_analysis_kpi_values_enforce_parent_
-- immutability / finance_baseline_{schedules,assumptions,outputs}_enforce_parent_immutability).
-- Applied uniformly to all five business_version_id-scoped mutable domain tables — the ADR's own
-- Zalacznik A count text ("9 funkcji/triggerow... parent immutability x5") lists five, and these
-- five are exactly the tables whose rows could otherwise still be inserted/edited after Approval
-- despite finance_business_versions' own immutability trigger only protecting its own row.
-- finance_prediction_preflight_runs/_findings/_conflict_resolutions are deliberately NOT frozen —
-- they are read-only artifacts of analysis, not assumption content, and preflight history remaining
-- visible/append-only after Approval is not a content-mutation risk (documented boundary, same
-- "not literally listed, own design decision" discipline WP-D05b used for its 9th readiness check).
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_prediction_driver_overrides_enforce_parent_immutability() RETURNS TRIGGER AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM finance_business_versions
    WHERE business_version_id = COALESCE(NEW.business_version_id, OLD.business_version_id);
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_prediction_driver_overrides: parent business_version % is APPROVED and immutable; % not permitted',
      COALESCE(NEW.business_version_id, OLD.business_version_id), TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_prediction_driver_overrides_parent_immutability ON finance_prediction_driver_overrides;
CREATE TRIGGER trg_finance_prediction_driver_overrides_parent_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_prediction_driver_overrides
  FOR EACH ROW EXECUTE FUNCTION finance_prediction_driver_overrides_enforce_parent_immutability();

CREATE OR REPLACE FUNCTION finance_prediction_initiatives_enforce_parent_immutability() RETURNS TRIGGER AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM finance_business_versions
    WHERE business_version_id = COALESCE(NEW.business_version_id, OLD.business_version_id);
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_prediction_initiatives: parent business_version % is APPROVED and immutable; % not permitted',
      COALESCE(NEW.business_version_id, OLD.business_version_id), TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_prediction_initiatives_parent_immutability ON finance_prediction_initiatives;
CREATE TRIGGER trg_finance_prediction_initiatives_parent_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_prediction_initiatives
  FOR EACH ROW EXECUTE FUNCTION finance_prediction_initiatives_enforce_parent_immutability();

CREATE OR REPLACE FUNCTION finance_prediction_impact_chain_enforce_parent_immutability() RETURNS TRIGGER AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM finance_business_versions
    WHERE business_version_id = COALESCE(NEW.business_version_id, OLD.business_version_id);
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_prediction_impact_chain: parent business_version % is APPROVED and immutable; % not permitted',
      COALESCE(NEW.business_version_id, OLD.business_version_id), TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_prediction_impact_chain_parent_immutability ON finance_prediction_impact_chain;
CREATE TRIGGER trg_finance_prediction_impact_chain_parent_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_prediction_impact_chain
  FOR EACH ROW EXECUTE FUNCTION finance_prediction_impact_chain_enforce_parent_immutability();

CREATE OR REPLACE FUNCTION finance_prediction_financing_enforce_parent_immutability() RETURNS TRIGGER AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM finance_business_versions
    WHERE business_version_id = COALESCE(NEW.business_version_id, OLD.business_version_id);
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_prediction_financing: parent business_version % is APPROVED and immutable; % not permitted',
      COALESCE(NEW.business_version_id, OLD.business_version_id), TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_prediction_financing_parent_immutability ON finance_prediction_financing;
CREATE TRIGGER trg_finance_prediction_financing_parent_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_prediction_financing
  FOR EACH ROW EXECUTE FUNCTION finance_prediction_financing_enforce_parent_immutability();

CREATE OR REPLACE FUNCTION finance_prediction_outputs_enforce_parent_immutability() RETURNS TRIGGER AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM finance_business_versions
    WHERE business_version_id = COALESCE(NEW.business_version_id, OLD.business_version_id);
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_prediction_outputs: parent business_version % is APPROVED and immutable; % not permitted',
      COALESCE(NEW.business_version_id, OLD.business_version_id), TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- NOTE on ordering: Postgres fires multiple BEFORE ROW triggers on the same table in alphabetical
-- order of trigger name — trg_finance_prediction_forbid_standard_base_outputs (created above, "f")
-- fires before trg_finance_prediction_outputs_parent_immutability ("o") only coincidentally would
-- not matter here (each trigger raises independently of the others' outcome), same non-issue D05b
-- already documented for its own outputs table.
DROP TRIGGER IF EXISTS trg_finance_prediction_outputs_parent_immutability ON finance_prediction_outputs;
CREATE TRIGGER trg_finance_prediction_outputs_parent_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_prediction_outputs
  FOR EACH ROW EXECUTE FUNCTION finance_prediction_outputs_enforce_parent_immutability();

COMMIT;
