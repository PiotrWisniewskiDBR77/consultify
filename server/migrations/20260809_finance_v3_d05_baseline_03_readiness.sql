-- Finance v3 — Gate D (WP-D05b): Baseline Models domain schema, part 3/3 — readiness gate +
-- monthly->quarterly->annual roll-up views.
--
-- Source: docs/validation/finance-v3/generated/gate-d/WP-D05_baseline_models_schema_ADR.md
-- section 8 (roll-up as VIEW, flow/stock = statement_type-driven, same rule WP-D01 section 12
-- already assigned; quarter number = CEIL(fiscal_month/3.0), never finance_stmt_periods.
-- fiscal_quarter, which WP-D01's chk_finance_stmt_period_month_shape guarantees is always NULL on
-- MONTH rows), and section 11 point 2 (the readiness-gate bug this file's own live testing found
-- and fixed: OUTPUT_GRID_COVERS_HORIZON). Runs after ..._02_integrity.sql. No wrapping transaction
-- needed (independent CREATE FUNCTION / CREATE VIEW statements), matching WP-D01b's/WP-D03b's own
-- third-file convention.
--
-- IMPORTANT — the readiness-gate bug this work package's own live testing found and fixed (ADR
-- section 11 point 2): the first draft of the readiness gate had eight checks, including a
-- NO_MISSING_OUTPUT_CELLS check that only counts rows with value_status='MISSING'. A fixture with
-- only 3 of 36 declared horizon months populated PASSED that check, because the missing 33 months
-- were never written as rows at all — absence of a row is not the same as a row with
-- value_status='MISSING', and SQL COUNT(*) WHERE ... silently skips what was never inserted (the
-- same "SQL quietly skips what isn't there" pattern WP-D01/WP-D03 already caught for COALESCE).
-- OUTPUT_GRID_COVERS_HORIZON (comparing COUNT(DISTINCT period_id) against horizon_months) is the
-- ninth check added specifically to close this gap; it is NOT redundant with
-- NO_MISSING_OUTPUT_CELLS — one catches "row present but marked MISSING", the other catches "row
-- never written for this period at all".
--
-- All boolean checks use COALESCE(..., false), never a bare comparison against a value that can be
-- NULL when no matching row exists — the same discipline WP-D01's own RECONCILIATION_RESIDUAL_
-- WITHIN_TOLERANCE fix (WP-D01 ADR section 7) established and WP-D03 carried forward from the
-- start (WP-D03b_analysis_migration_report.md section 6, "REQUIRED_LINES_AVAILABLE").

-- WP-D05 readiness gate — Baseline Model DRAFT -> READY_FOR_REVIEW.
CREATE OR REPLACE FUNCTION finance_baseline_readiness_check(p_business_version_id TEXT)
RETURNS TABLE(check_name TEXT, passed BOOLEAN, detail TEXT) AS $$
DECLARE
  v_org TEXT;
  v_horizon_months INTEGER;
  v_stmt_source_version_id TEXT;
  v_stmt_source_status TEXT;
  v_analysis_source_version_id TEXT;
  v_analysis_source_status TEXT;
  v_analysis_own_stmt_source_version_id TEXT;
  v_schedules_count INTEGER;
  v_assumptions_count INTEGER;
  v_missing_count INTEGER;
  v_period_count INTEGER;
BEGIN
  SELECT organization_id INTO v_org FROM finance_business_versions WHERE business_version_id = p_business_version_id;
  IF v_org IS NULL THEN
    RETURN QUERY SELECT 'VERSION_EXISTS'::TEXT, false, 'no such business_version_id'::TEXT;
    RETURN;
  END IF;

  SELECT horizon_months INTO v_horizon_months FROM finance_baseline_models WHERE business_version_id = p_business_version_id;

  -- 1. Source Statement Pack (STATEMENT_TO_MODEL edge) exists and is APPROVED.
  SELECT le.source_version_id INTO v_stmt_source_version_id
    FROM finance_lineage_edges le
    WHERE le.target_version_id = p_business_version_id AND le.edge_type = 'STATEMENT_TO_MODEL'
    LIMIT 1;
  SELECT status INTO v_stmt_source_status FROM finance_business_versions WHERE business_version_id = v_stmt_source_version_id;
  RETURN QUERY SELECT 'SOURCE_STATEMENT_PACK_APPROVED'::TEXT,
    COALESCE(v_stmt_source_status = 'APPROVED', false),
    format('STATEMENT_TO_MODEL source_version_id=%s status=%s', COALESCE(v_stmt_source_version_id, 'NONE'), COALESCE(v_stmt_source_status, 'NO_EDGE'));

  -- 2. Source Historical Analysis (ANALYSIS_TO_MODEL edge) exists and is APPROVED.
  SELECT le.source_version_id INTO v_analysis_source_version_id
    FROM finance_lineage_edges le
    WHERE le.target_version_id = p_business_version_id AND le.edge_type = 'ANALYSIS_TO_MODEL'
    LIMIT 1;
  SELECT status INTO v_analysis_source_status FROM finance_business_versions WHERE business_version_id = v_analysis_source_version_id;
  RETURN QUERY SELECT 'SOURCE_ANALYSIS_APPROVED'::TEXT,
    COALESCE(v_analysis_source_status = 'APPROVED', false),
    format('ANALYSIS_TO_MODEL source_version_id=%s status=%s', COALESCE(v_analysis_source_version_id, 'NONE'), COALESCE(v_analysis_source_status, 'NO_EDGE'));

  -- 3. Compatible lineage: the Analysis's OWN source Statement Pack (its STATEMENT_TO_ANALYSIS
  --    edge) must be the SAME Statement Pack Version this Model points to — otherwise the Model
  --    would be built on an Analysis of a different Statement Pack than the one it itself cites.
  IF v_analysis_source_version_id IS NOT NULL THEN
    SELECT le.source_version_id INTO v_analysis_own_stmt_source_version_id
      FROM finance_lineage_edges le
      WHERE le.target_version_id = v_analysis_source_version_id AND le.edge_type = 'STATEMENT_TO_ANALYSIS'
      LIMIT 1;
  END IF;
  RETURN QUERY SELECT 'SOURCE_STATEMENT_PACK_AND_ANALYSIS_COMPATIBLE'::TEXT,
    COALESCE(v_stmt_source_version_id IS NOT NULL AND v_stmt_source_version_id = v_analysis_own_stmt_source_version_id, false),
    format('model statement_pack=%s, analysis statement_pack=%s', COALESCE(v_stmt_source_version_id, 'NONE'), COALESCE(v_analysis_own_stmt_source_version_id, 'NONE'));

  -- 4. Schedules declared: at least one finance_baseline_schedules row.
  SELECT count(*) INTO v_schedules_count FROM finance_baseline_schedules WHERE business_version_id = p_business_version_id;
  RETURN QUERY SELECT 'SCHEDULES_DECLARED'::TEXT, v_schedules_count > 0,
    format('%s finance_baseline_schedules row(s)', v_schedules_count);

  -- 5. Assumptions declared: at least one finance_baseline_assumptions row (driver grid populated).
  SELECT count(*) INTO v_assumptions_count FROM finance_baseline_assumptions WHERE business_version_id = p_business_version_id;
  RETURN QUERY SELECT 'ASSUMPTIONS_DECLARED'::TEXT, v_assumptions_count > 0,
    format('%s finance_baseline_assumptions row(s)', v_assumptions_count);

  -- 6. No MISSING-status output cells (NA/NOT_APPLICABLE are fine — explicit decisions, not gaps).
  SELECT count(*) INTO v_missing_count FROM finance_baseline_outputs
    WHERE business_version_id = p_business_version_id AND value_status = 'MISSING';
  RETURN QUERY SELECT 'NO_MISSING_OUTPUT_CELLS'::TEXT, v_missing_count = 0,
    format('%s cell(s) with value_status=MISSING', v_missing_count);

  -- 7. OUTPUT_GRID_COVERS_HORIZON — the bug this work package's live testing found and fixed
  --    (see file header): a partially-populated grid (e.g. 3 of 36 declared horizon months) must
  --    NOT read as ready merely because it has zero value_status=MISSING rows — absence of a row
  --    is not caught by check #6 at all. Compares COUNT(DISTINCT period_id) actually present in
  --    finance_baseline_outputs against the model's own declared horizon_months.
  SELECT count(DISTINCT period_id) INTO v_period_count FROM finance_baseline_outputs
    WHERE business_version_id = p_business_version_id;
  RETURN QUERY SELECT 'OUTPUT_GRID_COVERS_HORIZON'::TEXT,
    COALESCE(v_horizon_months IS NOT NULL AND v_period_count >= v_horizon_months, false),
    format('%s distinct period(s) populated vs. horizon_months=%s', v_period_count, COALESCE(v_horizon_months::TEXT, 'NO_MODEL_ROW'));

  -- 8. No OPEN severity=SECURITY blocking_category=UNDEFINED_MATH exception — the circularity
  --    solver's fail-closed non-convergence signal (ADR section 6.2), first real consumer of the
  --    WP-B05-reserved UNDEFINED_MATH blocking mechanism. Literal check name quoted by the ADR's
  --    own TEST 13 ("NO_OPEN_UNDEFINED_MATH=false").
  RETURN QUERY SELECT 'NO_OPEN_UNDEFINED_MATH'::TEXT,
    NOT EXISTS (
      SELECT 1 FROM finance_exceptions_current
      WHERE business_version_id = p_business_version_id AND severity = 'SECURITY'
        AND blocking_category = 'UNDEFINED_MATH' AND state = 'OPEN'
    ),
    'no OPEN severity=SECURITY blocking_category=UNDEFINED_MATH exception'::TEXT;

  -- 9. No OPEN severity=SECURITY exception of any blocking_category (broader safety net, also
  --    catches TENANT_BREACH — the other WP-B05-reserved blocking_category).
  RETURN QUERY SELECT 'NO_OPEN_BLOCKING_EXCEPTIONS'::TEXT,
    NOT EXISTS (
      SELECT 1 FROM finance_exceptions_current
      WHERE business_version_id = p_business_version_id AND severity = 'SECURITY' AND state = 'OPEN'
    ),
    'no OPEN severity=SECURITY exception'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Aggregate boolean the submit_for_review transition calls. COALESCE(..., false) so a
-- business_version_id with zero rows returned (should not happen — VERSION_EXISTS always returns
-- at least one row) never reads as SQL NULL -> truthy-by-omission.
CREATE OR REPLACE FUNCTION finance_baseline_is_ready_for_review(p_business_version_id TEXT) RETURNS BOOLEAN AS $$
  SELECT COALESCE(bool_and(passed), false) FROM finance_baseline_readiness_check(p_business_version_id);
$$ LANGUAGE sql;

-- ============================================================================
-- Roll-up views (ADR section 8): monthly finance_baseline_outputs -> quarterly / annual.
-- Deliberately a VIEW, not materialized (documented, deferred optimization — ADR section 8 last
-- paragraph / section 12 point 4). Flow lines (P&L/CF) sum across the period; stock lines (BS)
-- take the closing (last-month) value — same statement_type-driven flow/stock rule WP-D01 section
-- 12 already assigned, reused here without reinvention. Quarter number is CEIL(fiscal_month/3.0)
-- computed from finance_stmt_periods.fiscal_month, NEVER read from a fiscal_quarter column on a
-- MONTH-type period row — WP-D01's chk_finance_stmt_period_month_shape guarantees that column is
-- always NULL there (exactly one dimension populated per period_type).
-- ============================================================================
CREATE OR REPLACE VIEW finance_baseline_outputs_quarterly AS
WITH periods AS (
  SELECT period_id, fiscal_year, fiscal_month, CEIL(fiscal_month / 3.0)::INTEGER AS fiscal_quarter
  FROM finance_stmt_periods
  WHERE period_type = 'MONTH'
),
flow AS (
  SELECT o.business_version_id, o.entity_id, o.canonical_line_id, o.consolidation_scope,
         o.statement_type, o.value_kind, p.fiscal_year, p.fiscal_quarter,
         SUM(o.value_decimal) AS value_decimal
  FROM finance_baseline_outputs o JOIN periods p ON p.period_id = o.period_id
  WHERE o.statement_type IN ('P&L', 'CF') AND o.value_decimal IS NOT NULL
  GROUP BY o.business_version_id, o.entity_id, o.canonical_line_id, o.consolidation_scope,
           o.statement_type, o.value_kind, p.fiscal_year, p.fiscal_quarter
),
stock AS (
  SELECT DISTINCT ON (o.business_version_id, o.entity_id, o.canonical_line_id, o.consolidation_scope, p.fiscal_year, p.fiscal_quarter)
         o.business_version_id, o.entity_id, o.canonical_line_id, o.consolidation_scope,
         o.statement_type, o.value_kind, p.fiscal_year, p.fiscal_quarter, o.value_decimal
  FROM finance_baseline_outputs o JOIN periods p ON p.period_id = o.period_id
  WHERE o.statement_type = 'BS'
  ORDER BY o.business_version_id, o.entity_id, o.canonical_line_id, o.consolidation_scope,
           p.fiscal_year, p.fiscal_quarter, p.fiscal_month DESC
)
SELECT * FROM flow
UNION ALL
SELECT * FROM stock;

CREATE OR REPLACE VIEW finance_baseline_outputs_annual AS
WITH periods AS (
  SELECT period_id, fiscal_year, fiscal_month
  FROM finance_stmt_periods
  WHERE period_type = 'MONTH'
),
flow AS (
  SELECT o.business_version_id, o.entity_id, o.canonical_line_id, o.consolidation_scope,
         o.statement_type, o.value_kind, p.fiscal_year,
         SUM(o.value_decimal) AS value_decimal
  FROM finance_baseline_outputs o JOIN periods p ON p.period_id = o.period_id
  WHERE o.statement_type IN ('P&L', 'CF') AND o.value_decimal IS NOT NULL
  GROUP BY o.business_version_id, o.entity_id, o.canonical_line_id, o.consolidation_scope,
           o.statement_type, o.value_kind, p.fiscal_year
),
stock AS (
  SELECT DISTINCT ON (o.business_version_id, o.entity_id, o.canonical_line_id, o.consolidation_scope, p.fiscal_year)
         o.business_version_id, o.entity_id, o.canonical_line_id, o.consolidation_scope,
         o.statement_type, o.value_kind, p.fiscal_year, o.value_decimal
  FROM finance_baseline_outputs o JOIN periods p ON p.period_id = o.period_id
  WHERE o.statement_type = 'BS'
  ORDER BY o.business_version_id, o.entity_id, o.canonical_line_id, o.consolidation_scope,
           p.fiscal_year, p.fiscal_month DESC
)
SELECT * FROM flow
UNION ALL
SELECT * FROM stock;
