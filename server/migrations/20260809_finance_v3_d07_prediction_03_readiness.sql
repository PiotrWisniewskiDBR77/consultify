-- Finance v3 — Gate D (WP-D07b): Prediction / Scenario Engine domain schema, part 3/3 — double-
-- counting detection, two-stage Compute readiness gate, and the Base=Baseline effective-outputs
-- view.
--
-- Source: docs/validation/finance-v3/generated/gate-d/WP-D07_prediction_schema_ADR.md sections 6
-- (two-stage Compute contract — HAS_CURRENT_PREFLIGHT / NO_OPEN_REQUIRED_RESOLUTIONS /
-- NO_OPEN_UNDEFINED_MATH), 7.1 (Layer 1 double-counting SQL, literal query sketch transcribed and
-- completed below — the ADR's own sketch left the financing UNION branch as "..." per section 13
-- escalation #2; this file's financing mapping is this work package's own, documented completion,
-- limited to the two financing_kind -> line pairs the ADR itself names literally in section 7.1's
-- comment, "not guessed" for the rest), 8.3 (finance_prediction_outputs_effective VIEW, literal SQL
-- transcribed verbatim below).
--
-- Runs after ..._02_integrity.sql (finance_prediction_readiness_check reads
-- finance_prediction_preflight_runs/_findings/_conflict_resolutions and finance_exceptions_current,
-- all already present). No wrapping transaction needed (independent CREATE FUNCTION / CREATE VIEW
-- statements), matching WP-D01b's/WP-D03b's/WP-D05b's own third-file convention.

-- ============================================================================
-- Double-counting Layer 1 — SQL, structural, cheap (ADR section 7.1). Materializes every impact
-- source as (entity, canonical_line, period, source_type, source_id, estimated_delta), groups by
-- target cell, flags COUNT(DISTINCT source) > 1. estimated_delta here is a NAIVE, same-unit-agnostic
-- sum — exactly the same simplification the ADR's own live-tested TEST 8 used ("naiwna suma
-- procentow... realny podglad numeryczny w jednostkach walutowych to Warstwa 2", section 7.1) — this
-- function proves the GROUPING mechanism, not financial correctness; Layer 2 (service, calling
-- baselineScheduleEngine.ts twice per driver override, expanding ramp/duration/decay per
-- impact_chain row) is out of scope for this migration, same documented boundary as WP-D03 section
-- 6.3 already established for unit-checking.
--
-- Financing UNION branch (third branch, ADR section 7.1's own "..." placeholder): mapped only for
-- the two financing_kind -> line pairs the ADR's prose names literally elsewhere in the same
-- section ("FACILITY_DRAWDOWN/DISCRETIONARY_REPAYMENT -> LONG_TERM_DEBT+INTEREST_EXPENSE,
-- DIVIDEND_DECLARATION -> DIVIDENDS_DECLARED+RETAINED_EARNINGS") plus EQUITY_INJECTION/
-- SHARE_BUYBACK -> EQUITY (both capital-account events, same canonical target line) as this work
-- package's own, documented extension using the same reasoning. SURPLUS_ALLOCATION_POLICY/
-- COVENANT_DEFINITION/MIN_CASH_POLICY are horizon-wide policies (period_id NULL by the file 01
-- CHECK constraint) and are excluded from this branch entirely — they are not point-in-time flows
-- onto a statement line and cannot double-count against a specific period cell (ADR section 9.1
-- treats them as a query pattern over finance_prediction_outputs_effective instead). The specific
-- numeric field extracted from payload (payload->>'amount' / payload->>'principal') is a
-- best-effort, non-exhaustive read of the JSONB payload shape — the full closed mapping is
-- explicitly deferred to the executive work package per ADR section 13 escalation #2, same as
-- finance_prediction_driver_line_map's own honestly-partial seed (file 01).
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_prediction_detect_overlaps(p_business_version_id TEXT)
RETURNS TABLE(entity_id TEXT, canonical_line_id TEXT, period_id TEXT, source_count INTEGER, combined_impact_decimal NUMERIC, sources JSONB) AS $$
  WITH sourced_impacts AS (
    -- driver_overrides, mapped to affected lines via finance_prediction_driver_line_map
    SELECT o.entity_id, m.canonical_line_id, o.period_id,
           'DRIVER_OVERRIDE'::TEXT AS source_type, o.id AS source_id,
           (o.value_decimal - COALESCE(o.baseline_value_decimal, 0)) AS estimated_delta
    FROM finance_prediction_driver_overrides o
    JOIN finance_prediction_driver_line_map m ON m.schedule_type = o.schedule_type
    WHERE o.business_version_id = p_business_version_id AND o.value_decimal IS NOT NULL

    UNION ALL

    -- impact_chain rows, direct (single-period simplification — full ramp/duration/decay expansion
    -- is Layer 2, ADR section 7.2). period_id falls back to the parent initiative's default when
    -- the impact does not override it (ADR section 4.3/4.4 inheritance rule).
    SELECT ic.entity_id, ic.statement_line_id AS canonical_line_id,
           COALESCE(ic.start_period_id, i.default_start_period_id) AS period_id,
           'INITIATIVE_IMPACT'::TEXT AS source_type, ic.id AS source_id,
           (CASE WHEN ic.sign = 'NEGATIVE' THEN -1 ELSE 1 END) * ic.amount_decimal AS estimated_delta
    FROM finance_prediction_impact_chain ic
    JOIN finance_prediction_initiatives i ON i.id = ic.initiative_id
    WHERE ic.business_version_id = p_business_version_id

    UNION ALL

    -- financing rows, mapped via a closed CASE over financing_kind (see file header for exactly
    -- which pairs are covered and why the policy kinds are excluded).
    SELECT f.entity_id, fl.canonical_line_id, f.period_id,
           'FINANCING'::TEXT AS source_type, f.id AS source_id,
           COALESCE((f.payload->>'amount')::numeric, (f.payload->>'principal')::numeric, 0) AS estimated_delta
    FROM finance_prediction_financing f
    JOIN LATERAL (
      SELECT l.id AS canonical_line_id
      FROM financial_statement_lines l
      WHERE (f.financing_kind IN ('FACILITY_DRAWDOWN', 'DISCRETIONARY_REPAYMENT') AND l.line_code IN ('LONG_TERM_DEBT', 'INTEREST_EXPENSE'))
         OR (f.financing_kind = 'DIVIDEND_DECLARATION' AND l.line_code IN ('DIVIDENDS_DECLARED', 'RETAINED_EARNINGS'))
         OR (f.financing_kind IN ('EQUITY_INJECTION', 'SHARE_BUYBACK') AND l.line_code = 'EQUITY')
    ) fl ON true
    WHERE f.business_version_id = p_business_version_id
  ),
  grouped AS (
    SELECT entity_id, canonical_line_id, period_id,
           COUNT(DISTINCT (source_type, source_id))::INTEGER AS source_count,
           SUM(estimated_delta) AS combined_impact_decimal,
           jsonb_agg(jsonb_build_object('source_type', source_type, 'source_id', source_id, 'estimated_delta', estimated_delta)) AS sources
    FROM sourced_impacts
    WHERE period_id IS NOT NULL -- a source whose period could not be resolved at all (no start_period_id anywhere in its chain) cannot be grouped into a period cell; it surfaces instead as a MISSING_REQUIRED_INPUT finding at the application preflight layer, not here
    GROUP BY entity_id, canonical_line_id, period_id
  )
  SELECT entity_id, canonical_line_id, period_id, source_count, combined_impact_decimal, sources
  FROM grouped
  WHERE source_count > 1;
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- Two-stage Compute gate (ADR section 6.2) — three named checks, live-tested (TEST 9/10/11).
-- Building assumptions (INSERT into driver_overrides/initiatives/impact_chain/financing) is NEVER
-- blocked by this function — none of the three checks is a trigger on those tables, they are read
-- exclusively by this gate, called before compute enqueue (ADR section 6.2, "System nie blokuje
-- budowania zalozen").
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_prediction_readiness_check(p_business_version_id TEXT)
RETURNS TABLE(check_name TEXT, passed BOOLEAN, detail TEXT) AS $$
DECLARE
  v_org TEXT;
  v_current_preflight_id TEXT;
  v_open_required_count INTEGER;
BEGIN
  SELECT organization_id INTO v_org FROM finance_business_versions WHERE business_version_id = p_business_version_id;
  IF v_org IS NULL THEN
    RETURN QUERY SELECT 'VERSION_EXISTS'::TEXT, false, 'no such business_version_id'::TEXT;
    RETURN;
  END IF;

  -- 1. HAS_CURRENT_PREFLIGHT — a non-superseded finance_prediction_preflight_runs row exists.
  SELECT id INTO v_current_preflight_id FROM finance_prediction_preflight_runs
    WHERE business_version_id = p_business_version_id AND superseded_by_preflight_run_id IS NULL
    ORDER BY run_at DESC LIMIT 1;
  RETURN QUERY SELECT 'HAS_CURRENT_PREFLIGHT'::TEXT, v_current_preflight_id IS NOT NULL,
    format('current preflight_run_id=%s', COALESCE(v_current_preflight_id, 'NONE'));

  -- 2. NO_OPEN_REQUIRED_RESOLUTIONS — every requires_resolution=true finding on the CURRENT
  --    preflight run has a finance_prediction_conflict_resolutions row in state='RESOLVED'.
  IF v_current_preflight_id IS NOT NULL THEN
    SELECT count(*) INTO v_open_required_count
      FROM finance_prediction_preflight_findings f
      WHERE f.preflight_run_id = v_current_preflight_id AND f.requires_resolution = true
        AND NOT EXISTS (
          SELECT 1 FROM finance_prediction_conflict_resolutions r
          WHERE r.finding_id = f.id AND r.state = 'RESOLVED'
        );
  ELSE
    v_open_required_count := NULL;
  END IF;
  RETURN QUERY SELECT 'NO_OPEN_REQUIRED_RESOLUTIONS'::TEXT,
    COALESCE(v_open_required_count = 0, false),
    format('%s required finding(s) without a RESOLVED resolution', COALESCE(v_open_required_count::TEXT, 'NO_CURRENT_PREFLIGHT'));

  -- 3. NO_OPEN_UNDEFINED_MATH — reused verbatim from WP-B05/WP-D05 (ADR section 6.2's own literal
  --    check name, TEST 13's wording).
  RETURN QUERY SELECT 'NO_OPEN_UNDEFINED_MATH'::TEXT,
    NOT EXISTS (
      SELECT 1 FROM finance_exceptions_current
      WHERE business_version_id = p_business_version_id AND severity = 'SECURITY'
        AND blocking_category = 'UNDEFINED_MATH' AND state = 'OPEN'
    ),
    'no OPEN severity=SECURITY blocking_category=UNDEFINED_MATH exception'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Aggregate boolean computeJobService MUST call before enqueueing job_type='PREDICTION_COMPUTE'
-- (ADR section 6.2/6.3). COALESCE(..., false) so a business_version_id with zero rows returned
-- (should not happen — VERSION_EXISTS always returns at least one row) never reads as SQL
-- NULL -> truthy-by-omission, same discipline WP-D01/WP-D03/WP-D05 already established.
CREATE OR REPLACE FUNCTION finance_prediction_can_start_compute(p_business_version_id TEXT) RETURNS BOOLEAN AS $$
  SELECT COALESCE(bool_and(passed), false) FROM finance_prediction_readiness_check(p_business_version_id);
$$ LANGUAGE sql;

-- ============================================================================
-- finance_prediction_outputs_effective (ADR section 8.3) — the ONLY place the Models/Results UI
-- reads. For scenario_mode='STANDARD_BASE', reads finance_baseline_outputs DIRECTLY through the
-- MODEL_TO_SCENARIO lineage edge (no second row that could ever diverge — the guarantee is
-- structural, not a result of an independent recomputation happening to match). For every other
-- mode, reads the real finance_prediction_outputs rows. Transcribed verbatim from the ADR's
-- Zalacznik A / section 8.3 (already live-tested — TEST 3).
-- ============================================================================
CREATE OR REPLACE VIEW finance_prediction_outputs_effective AS
  SELECT s.business_version_id, bo.canonical_line_id, bo.entity_id, bo.period_id, bo.statement_type,
         bo.consolidation_scope, bo.value_status, bo.value_decimal, bo.native_currency,
         bo.presentation_currency, bo.unit, bo.multiplier,
         NULL::NUMERIC AS variance_vs_baseline_decimal,
         'BASELINE_PASSTHROUGH'::TEXT AS source
  FROM finance_prediction_scenarios s
  JOIN finance_lineage_edges e ON e.target_version_id = s.business_version_id AND e.edge_type = 'MODEL_TO_SCENARIO'
  JOIN finance_baseline_outputs bo ON bo.business_version_id = e.source_version_id
  WHERE s.scenario_mode = 'STANDARD_BASE'
UNION ALL
  SELECT po.business_version_id, po.canonical_line_id, po.entity_id, po.period_id, po.statement_type,
         po.consolidation_scope, po.value_status, po.value_decimal, po.native_currency,
         po.presentation_currency, po.unit, po.multiplier, po.variance_vs_baseline_decimal,
         'PREDICTION_COMPUTE'::TEXT AS source
  FROM finance_prediction_outputs po
  JOIN finance_prediction_scenarios s ON s.business_version_id = po.business_version_id
  WHERE s.scenario_mode != 'STANDARD_BASE';
