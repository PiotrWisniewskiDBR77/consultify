-- Finance v3 — Gate D (WP-D05b): Baseline Models domain schema, part 2/3 — integrity controls.
--
-- Source: docs/validation/finance-v3/generated/gate-d/WP-D05_baseline_models_schema_ADR.md
-- sections 5 (four physical plug/financing-exclusion layers), 6 (circularity — fail-closed via
-- the already-reserved finance_exceptions(severity='SECURITY', blocking_category='UNDEFINED_MATH')
-- mechanism), 7 (funding gap alert), Zalacznik A (literal payload-validation and cash-rollforward
-- trigger bodies, transcribed verbatim below — already live-tested by the ADR author).
--
-- Runs after ..._01_tables.sql (these functions/triggers reference tables created there) and
-- before ..._03_readiness.sql (the readiness gate queries finance_exceptions_current, which this
-- file's funding-gap/solver-diagnostics logic populates).
--
-- Same "cross-row lookup -> CONSTRAINT TRIGGER, not CHECK" discipline WP-D01/WP-D03 already
-- established (Postgres CHECK does not allow subqueries) for the deferred balance/roll-forward
-- checks; the payload-denylist, discretionary-financing-line block, funding-gap flag, and content
-- freeze are all single-row, immediate (non-deferred) BEFORE triggers.

BEGIN;

-- ============================================================================
-- Physical layer #1 is the schedule_type CHECK enum on finance_baseline_schedules itself
-- (file 01) — no trigger needed for that layer.
--
-- Physical layer #2 — forbidden-key denylist on `payload`, checked on EVERY schedule_type (not
-- only debt_maturity/equity_re), plus a required-key allowlist for the two most sensitive types.
-- Transcribed verbatim from the ADR's Zalacznik A (already live-tested — TEST 1-4).
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_baseline_validate_schedule_payload() RETURNS TRIGGER AS $$
DECLARE
  v_forbidden_keys TEXT[] := ARRAY[
    'discretionary_repayment','new_draw','debt_drawdown','revolver_draw',
    'dividend_amount','dividend','equity_injection','share_buyback',
    'buyback_amount','surplus_allocation','cash_plug','balancing_item','plug'
  ];
  v_key TEXT;
BEGIN
  IF jsonb_typeof(NEW.payload) != 'object' THEN
    RAISE EXCEPTION 'finance_baseline_schedules: payload must be a JSON object';
  END IF;
  FOREACH v_key IN ARRAY v_forbidden_keys LOOP
    IF NEW.payload ? v_key THEN
      RAISE EXCEPTION 'finance_baseline_schedules: payload key "%" is a discretionary financing/plug concept, forbidden in Baseline (DEC-FIN-002)', v_key;
    END IF;
  END LOOP;
  CASE NEW.schedule_type
    WHEN 'debt_maturity' THEN
      IF NOT (NEW.payload ? 'principal_opening' AND NEW.payload ? 'contractual_rate' AND NEW.payload ? 'amortization_schedule') THEN
        RAISE EXCEPTION 'finance_baseline_schedules: debt_maturity payload requires principal_opening, contractual_rate, amortization_schedule';
      END IF;
    WHEN 'equity_re' THEN
      IF NOT (NEW.payload ? 'opening_retained_earnings') THEN
        RAISE EXCEPTION 'finance_baseline_schedules: equity_re payload requires opening_retained_earnings';
      END IF;
    ELSE NULL;
  END CASE;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_baseline_validate_schedule_payload ON finance_baseline_schedules;
CREATE TRIGGER trg_finance_baseline_validate_schedule_payload
  BEFORE INSERT OR UPDATE ON finance_baseline_schedules
  FOR EACH ROW EXECUTE FUNCTION finance_baseline_validate_schedule_payload();

-- ============================================================================
-- Content freeze — finance_baseline_schedules / finance_baseline_assumptions /
-- finance_baseline_outputs, once the parent business_version is APPROVED. Same pattern as
-- finance_stmt_lines_enforce_parent_immutability (WP-D01) / finance_analysis_kpi_values_
-- enforce_parent_immutability (WP-D03), applied per-table here (ADR Zalacznik A test 12a/12b).
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_baseline_schedules_enforce_parent_immutability() RETURNS TRIGGER AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM finance_business_versions
    WHERE business_version_id = COALESCE(NEW.business_version_id, OLD.business_version_id);
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_baseline_schedules: parent business_version % is APPROVED and immutable; % not permitted',
      COALESCE(NEW.business_version_id, OLD.business_version_id), TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_baseline_schedules_parent_immutability ON finance_baseline_schedules;
CREATE TRIGGER trg_finance_baseline_schedules_parent_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_baseline_schedules
  FOR EACH ROW EXECUTE FUNCTION finance_baseline_schedules_enforce_parent_immutability();

CREATE OR REPLACE FUNCTION finance_baseline_assumptions_enforce_parent_immutability() RETURNS TRIGGER AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM finance_business_versions
    WHERE business_version_id = COALESCE(NEW.business_version_id, OLD.business_version_id);
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_baseline_assumptions: parent business_version % is APPROVED and immutable; % not permitted',
      COALESCE(NEW.business_version_id, OLD.business_version_id), TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_baseline_assumptions_parent_immutability ON finance_baseline_assumptions;
CREATE TRIGGER trg_finance_baseline_assumptions_parent_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_baseline_assumptions
  FOR EACH ROW EXECUTE FUNCTION finance_baseline_assumptions_enforce_parent_immutability();

CREATE OR REPLACE FUNCTION finance_baseline_outputs_enforce_parent_immutability() RETURNS TRIGGER AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM finance_business_versions
    WHERE business_version_id = COALESCE(NEW.business_version_id, OLD.business_version_id);
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_baseline_outputs: parent business_version % is APPROVED and immutable; % not permitted',
      COALESCE(NEW.business_version_id, OLD.business_version_id), TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- NOTE on ordering: Postgres fires multiple BEFORE ROW triggers on the same table in alphabetical
-- order of trigger name. trg_finance_baseline_outputs_parent_immutability is named to fire before
-- trg_finance_baseline_outputs_a_block_discretionary_financing / trg_..._b_mark_funding_gap only
-- coincidentally would not matter here (each trigger raises independently of the others' outcome),
-- but is still named first for readability.
DROP TRIGGER IF EXISTS trg_finance_baseline_outputs_parent_immutability ON finance_baseline_outputs;
CREATE TRIGGER trg_finance_baseline_outputs_parent_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_baseline_outputs
  FOR EACH ROW EXECUTE FUNCTION finance_baseline_outputs_enforce_parent_immutability();

-- ============================================================================
-- Physical layer #3 — taxonomy-driven denylist on finance_baseline_outputs (ADR section 5.3).
-- Cross-table lookup to financial_statement_lines.excluded_from_baseline (trigger, not CHECK —
-- same "no subquery in CHECK" reason as WP-D01). Blocks PRESENT_NONZERO only; NA/MISSING remain
-- allowed so DIVIDENDS_DECLARED can still exist as a structural row with an always-empty value in
-- Baseline. Curated denylist — a defense-in-depth layer, not the sole guarantee (layers 1-2 are).
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_baseline_block_discretionary_financing_lines() RETURNS TRIGGER AS $$
DECLARE v_excluded BOOLEAN;
BEGIN
  SELECT excluded_from_baseline INTO v_excluded FROM financial_statement_lines WHERE id = NEW.canonical_line_id;
  IF COALESCE(v_excluded, false) AND NEW.value_status = 'PRESENT_NONZERO' THEN
    RAISE EXCEPTION 'finance_baseline_outputs: canonical_line_id % is excluded_from_baseline (discretionary financing/distribution decision) and cannot carry a PRESENT_NONZERO value in a Baseline Model (DEC-FIN-002)', NEW.canonical_line_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_baseline_outputs_a_block_discretionary_financing ON finance_baseline_outputs;
CREATE TRIGGER trg_finance_baseline_outputs_a_block_discretionary_financing
  BEFORE INSERT OR UPDATE ON finance_baseline_outputs
  FOR EACH ROW EXECUTE FUNCTION finance_baseline_block_discretionary_financing_lines();

-- ============================================================================
-- Funding gap alert (ADR section 7). Fires exclusively on the CASH row. Negative cash sets
-- quality_flag='FUNDING_GAP' directly on the row (visible in the grid, zero extra query) AND
-- raises a non-blocking finance_exceptions(severity='WARNING') row, deduplicated by
-- (business_version_id, entity_id, period_id) so repeated recomputes of the same period do not
-- pile up duplicate warnings. Never blocks anything (DEC-FIN-009: negative cash is a valid,
-- visible state, not an error).
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_baseline_mark_funding_gap() RETURNS TRIGGER AS $$
DECLARE
  v_cash_line_id TEXT;
  v_dedup_key TEXT;
  v_artifact_id TEXT;
  v_already_raised BOOLEAN;
  v_exception_id TEXT;
BEGIN
  SELECT id INTO v_cash_line_id FROM financial_statement_lines WHERE line_code = 'CASH' AND statement_type = 'BS' LIMIT 1;
  IF v_cash_line_id IS NULL OR NEW.canonical_line_id != v_cash_line_id THEN
    RETURN NEW;
  END IF;

  IF NEW.value_decimal IS NOT NULL AND NEW.value_decimal < 0 THEN
    NEW.quality_flag := 'FUNDING_GAP';

    v_dedup_key := format('FUNDING_GAP:%s:%s:%s', NEW.business_version_id, NEW.entity_id, NEW.period_id);

    SELECT EXISTS (
      SELECT 1 FROM finance_exceptions WHERE dedup_key = v_dedup_key
    ) INTO v_already_raised;

    IF NOT v_already_raised THEN
      SELECT artifact_id INTO v_artifact_id FROM finance_business_versions WHERE business_version_id = NEW.business_version_id;

      -- exception_group_id is NOT NULL with no DEFAULT — for a RAISED event it must equal the
      -- row's own id (finance_exceptions table comment, WP-B05 ADR §7.1), so id is generated
      -- explicitly here rather than left to the column DEFAULT (which would not be visible yet
      -- inside this same INSERT).
      v_exception_id := gen_random_uuid()::text;
      INSERT INTO finance_exceptions (
        id, exception_group_id, organization_id, artifact_id, business_version_id, event_type, severity,
        source_ref, expected, observed, dedup_key, reason_code, raised_by
      ) VALUES (
        v_exception_id, v_exception_id, NEW.organization_id, v_artifact_id, NEW.business_version_id, 'RAISED', 'WARNING',
        jsonb_build_object('canonical_line_id', NEW.canonical_line_id, 'entity_id', NEW.entity_id, 'period_id', NEW.period_id),
        0, NEW.value_decimal, v_dedup_key, 'FUNDING_GAP', 'finance_baseline_mark_funding_gap'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_baseline_outputs_b_mark_funding_gap ON finance_baseline_outputs;
CREATE TRIGGER trg_finance_baseline_outputs_b_mark_funding_gap
  BEFORE INSERT OR UPDATE ON finance_baseline_outputs
  FOR EACH ROW EXECUTE FUNCTION finance_baseline_mark_funding_gap();

-- ============================================================================
-- Physical layer #4 — cash roll-forward with ZERO plug option (ADR section 5.4). Deferred
-- constraint trigger, FOR EACH ROW (Postgres does not support FOR EACH STATEMENT constraint
-- triggers — same restriction WP-D01 already documented; DEFERRABLE INITIALLY DEFERRED still
-- gives "check the whole batch at COMMIT" semantics because every row's firing queues up and only
-- runs at COMMIT). Tolerance is finance_baseline_models.circularity_tolerance_currency — the same
-- epsilon the solver uses, one source of truth, not two invented numbers. Transcribed verbatim
-- from the ADR's Zalacznik A (already live-tested — TEST 7-8).
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_baseline_check_cash_rollforward() RETURNS TRIGGER AS $$
DECLARE
  v_cash_line_id TEXT; v_net_change_line_id TEXT;
  v_opening_cash NUMERIC; v_net_change NUMERIC; v_closing_cash NUMERIC;
  v_prev_period_id TEXT; v_tolerance NUMERIC; v_diff NUMERIC;
BEGIN
  SELECT id INTO v_cash_line_id FROM financial_statement_lines WHERE line_code = 'CASH' AND statement_type = 'BS' LIMIT 1;
  SELECT id INTO v_net_change_line_id FROM financial_statement_lines WHERE line_code = 'NET_CHANGE_CASH' AND statement_type = 'CF' LIMIT 1;
  IF NEW.canonical_line_id != v_cash_line_id THEN RETURN NEW; END IF;

  SELECT previous_period_id INTO v_prev_period_id FROM finance_stmt_periods WHERE period_id = NEW.period_id;
  IF v_prev_period_id IS NULL THEN RETURN NEW; END IF;

  SELECT value_decimal INTO v_opening_cash FROM finance_baseline_outputs
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id
      AND canonical_line_id = v_cash_line_id AND period_id = v_prev_period_id AND consolidation_scope = NEW.consolidation_scope;
  SELECT value_decimal INTO v_net_change FROM finance_baseline_outputs
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id
      AND canonical_line_id = v_net_change_line_id AND period_id = NEW.period_id AND consolidation_scope = NEW.consolidation_scope;
  IF v_opening_cash IS NULL OR v_net_change IS NULL THEN RETURN NEW; END IF;

  v_closing_cash := NEW.value_decimal;
  SELECT circularity_tolerance_currency INTO v_tolerance FROM finance_baseline_models WHERE business_version_id = NEW.business_version_id;
  v_tolerance := COALESCE(v_tolerance, 1);
  v_diff := ABS((v_opening_cash + v_net_change) - v_closing_cash);
  IF v_diff > v_tolerance THEN
    RAISE EXCEPTION 'finance_baseline: cash roll-forward broken for period %, entity % — opening (%) + net_change (%) != closing (%), diff % > tolerance % — no plug line exists to absorb this residual',
      NEW.period_id, NEW.entity_id, v_opening_cash, v_net_change, v_closing_cash, v_diff, v_tolerance;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_baseline_check_cash_rollforward ON finance_baseline_outputs;
CREATE CONSTRAINT TRIGGER trg_finance_baseline_check_cash_rollforward
  AFTER INSERT OR UPDATE ON finance_baseline_outputs
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION finance_baseline_check_cash_rollforward();

-- Analogous check: Assets = Liabilities + Equity, same tolerance source (ADR section 5.4, second
-- paragraph). Same deferred-constraint-trigger pattern as the cash check above.
CREATE OR REPLACE FUNCTION finance_baseline_check_balance() RETURNS TRIGGER AS $$
DECLARE
  v_assets NUMERIC; v_liab_equity NUMERIC; v_tolerance NUMERIC;
  v_assets_line TEXT; v_le_line TEXT;
BEGIN
  IF NEW.statement_type != 'BS' THEN RETURN NEW; END IF;

  SELECT id INTO v_assets_line FROM financial_statement_lines WHERE line_code = 'TOTAL_ASSETS' AND statement_type = 'BS' LIMIT 1;
  SELECT id INTO v_le_line FROM financial_statement_lines WHERE line_code = 'TOTAL_LIABILITIES_EQUITY' AND statement_type = 'BS' LIMIT 1;

  SELECT value_decimal INTO v_assets FROM finance_baseline_outputs
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id
      AND period_id = NEW.period_id AND canonical_line_id = v_assets_line AND consolidation_scope = 'CONSOLIDATED';
  SELECT value_decimal INTO v_liab_equity FROM finance_baseline_outputs
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id
      AND period_id = NEW.period_id AND canonical_line_id = v_le_line AND consolidation_scope = 'CONSOLIDATED';

  IF v_assets IS NOT NULL AND v_liab_equity IS NOT NULL THEN
    SELECT circularity_tolerance_currency INTO v_tolerance FROM finance_baseline_models WHERE business_version_id = NEW.business_version_id;
    v_tolerance := COALESCE(v_tolerance, 1);
    IF ABS(v_assets - v_liab_equity) > v_tolerance THEN
      RAISE EXCEPTION 'finance_baseline_outputs: balance check failed for version=% entity=% period=%: assets=% liab+equity=% diff=% tolerance=%',
        NEW.business_version_id, NEW.entity_id, NEW.period_id, v_assets, v_liab_equity, ABS(v_assets - v_liab_equity), v_tolerance;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_baseline_check_balance ON finance_baseline_outputs;
CREATE CONSTRAINT TRIGGER trg_finance_baseline_check_balance
  AFTER INSERT OR UPDATE ON finance_baseline_outputs
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION finance_baseline_check_balance();

-- Analogous check: opening RETAINED_EARNINGS + NET_INCOME = closing RETAINED_EARNINGS, WITHOUT a
-- "- dividends" term carrying a real value (layer #3 already guarantees DIVIDENDS_DECLARED cannot
-- be PRESENT_NONZERO in Baseline, ADR section 5.4).
CREATE OR REPLACE FUNCTION finance_baseline_check_re_rollforward() RETURNS TRIGGER AS $$
DECLARE
  v_prev_period TEXT; v_opening_re NUMERIC; v_net_income NUMERIC; v_closing_re NUMERIC; v_tolerance NUMERIC;
  v_re_line TEXT; v_ni_line TEXT;
BEGIN
  IF NEW.statement_type NOT IN ('BS', 'P&L') THEN RETURN NEW; END IF;

  SELECT id INTO v_re_line FROM financial_statement_lines WHERE line_code = 'RETAINED_EARNINGS' AND statement_type = 'BS' LIMIT 1;
  SELECT id INTO v_ni_line FROM financial_statement_lines WHERE line_code = 'NET_INCOME' AND statement_type = 'P&L' LIMIT 1;

  SELECT previous_period_id INTO v_prev_period FROM finance_stmt_periods WHERE period_id = NEW.period_id;
  IF v_prev_period IS NULL THEN RETURN NEW; END IF;

  SELECT value_decimal INTO v_opening_re FROM finance_baseline_outputs
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = v_prev_period
      AND canonical_line_id = v_re_line AND consolidation_scope = 'CONSOLIDATED';
  SELECT value_decimal INTO v_net_income FROM finance_baseline_outputs
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND canonical_line_id = v_ni_line AND consolidation_scope = 'CONSOLIDATED';
  SELECT value_decimal INTO v_closing_re FROM finance_baseline_outputs
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND canonical_line_id = v_re_line AND consolidation_scope = 'CONSOLIDATED';

  IF v_opening_re IS NOT NULL AND v_net_income IS NOT NULL AND v_closing_re IS NOT NULL THEN
    SELECT circularity_tolerance_currency INTO v_tolerance FROM finance_baseline_models WHERE business_version_id = NEW.business_version_id;
    v_tolerance := COALESCE(v_tolerance, 1);
    IF ABS((v_opening_re + v_net_income) - v_closing_re) > v_tolerance THEN
      RAISE EXCEPTION 'finance_baseline_outputs: retained earnings roll-forward failed for version=% entity=% period=%: opening=% + NI=% != closing=% (diff=%, tolerance=%)',
        NEW.business_version_id, NEW.entity_id, NEW.period_id, v_opening_re, v_net_income, v_closing_re,
        ABS((v_opening_re + v_net_income) - v_closing_re), v_tolerance;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_baseline_check_re_rollforward ON finance_baseline_outputs;
CREATE CONSTRAINT TRIGGER trg_finance_baseline_check_re_rollforward
  AFTER INSERT OR UPDATE ON finance_baseline_outputs
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION finance_baseline_check_re_rollforward();

COMMIT;
