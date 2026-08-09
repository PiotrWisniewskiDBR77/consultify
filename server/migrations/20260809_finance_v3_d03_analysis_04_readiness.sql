-- Finance v3 — Gate D (WP-D03b): Historical Analysis domain schema, part 4/4 — readiness gate.
--
-- Source: docs/validation/finance-v3/generated/gate-d/WP-D03_analysis_schema_ADR.md section 7 (six
-- named checks). Runs after ..._03_kpi_p0_catalog.sql. No wrapping transaction needed (two independent
-- CREATE FUNCTION statements), matching WP-D01's own third file
-- (20260809_finance_v3_d01_statements_03_readiness.sql).
--
-- Carries forward the COALESCE(..., false) fix WP-D01's own live testing found and fixed for its
-- readiness gate (a bare `x IN (...)` against a possibly-NULL value evaluates to SQL NULL, and
-- bool_and() silently ignores NULL rows instead of counting them as failed) — applied here
-- immediately, not rediscovered (ADR section 7, last paragraph).

-- 1. SOURCE_STATEMENT_PACK_APPROVED — exactly one STATEMENT_TO_ANALYSIS edge targeting this
--    version, and its source version's business_version.status = 'APPROVED'.
-- 2. KPI_CATALOG_CONFIGURED — non-empty Draft (ADR section 4.4: selection = row presence).
-- 3. NO_MISSING_KPI_VALUES — zero value_status='MISSING' rows for this version.
-- 4. ALL_KPI_FORMULAS_COMPILED_OK — every referenced kpi_catalog_id is compile_status='COMPILED_OK'
--    (defends against a formula that became DEPRECATED/inconsistent after the value row was created).
-- 5. REQUIRED_LINES_AVAILABLE — for every selected KPI, all of its required_canonical_line_codes
--    have a non-MISSING finance_stmt_lines cell in the source Statement Pack Version for that period.
-- 6. NO_BLOCKING_EXCEPTIONS — zero OPEN severity=SECURITY exceptions for this artifact.
--
-- Deliberately NO 'BENCHMARKS_ATTACHED' check (ADR section 7: addendum explicitly says not to force
-- optional benchmarks/custom KPI as a gate).

CREATE OR REPLACE FUNCTION finance_analysis_readiness_check(p_business_version_id TEXT)
RETURNS TABLE(check_name TEXT, passed BOOLEAN, detail TEXT) AS $$
DECLARE
  v_org TEXT;
  v_edge_count INTEGER;
  v_source_status TEXT;
  v_kpi_value_count INTEGER;
  v_missing_count INTEGER;
  v_bad_compile_count INTEGER;
  v_missing_lines_count INTEGER;
BEGIN
  SELECT organization_id INTO v_org FROM finance_business_versions WHERE business_version_id = p_business_version_id;
  IF v_org IS NULL THEN
    RETURN QUERY SELECT 'VERSION_EXISTS'::TEXT, false, 'no such business_version_id'::TEXT;
    RETURN;
  END IF;

  -- 1. SOURCE_STATEMENT_PACK_APPROVED
  SELECT count(*) INTO v_edge_count
    FROM finance_lineage_edges
    WHERE edge_type = 'STATEMENT_TO_ANALYSIS' AND target_version_id = p_business_version_id;

  SELECT fbv.status INTO v_source_status
    FROM finance_lineage_edges e
    JOIN finance_business_versions fbv ON fbv.business_version_id = e.source_version_id
    WHERE e.edge_type = 'STATEMENT_TO_ANALYSIS' AND e.target_version_id = p_business_version_id;

  RETURN QUERY SELECT 'SOURCE_STATEMENT_PACK_APPROVED'::TEXT,
    (v_edge_count = 1 AND v_source_status = 'APPROVED'),
    format('%s STATEMENT_TO_ANALYSIS edge(s) found, source business_version.status = %s', v_edge_count, COALESCE(v_source_status, 'NONE'));

  -- 2. KPI_CATALOG_CONFIGURED
  SELECT count(*) INTO v_kpi_value_count
    FROM finance_analysis_kpi_values WHERE business_version_id = p_business_version_id;
  RETURN QUERY SELECT 'KPI_CATALOG_CONFIGURED'::TEXT, v_kpi_value_count > 0,
    format('%s finance_analysis_kpi_values row(s)', v_kpi_value_count);

  -- 3. NO_MISSING_KPI_VALUES
  SELECT count(*) INTO v_missing_count
    FROM finance_analysis_kpi_values
    WHERE business_version_id = p_business_version_id AND value_status = 'MISSING';
  RETURN QUERY SELECT 'NO_MISSING_KPI_VALUES'::TEXT, v_missing_count = 0,
    format('%s row(s) still value_status=MISSING', v_missing_count);

  -- 4. ALL_KPI_FORMULAS_COMPILED_OK
  SELECT count(*) INTO v_bad_compile_count
    FROM finance_analysis_kpi_values v
    JOIN finance_analysis_kpi_catalog c ON c.id = v.kpi_catalog_id
    WHERE v.business_version_id = p_business_version_id
      AND c.compile_status IS DISTINCT FROM 'COMPILED_OK';
  RETURN QUERY SELECT 'ALL_KPI_FORMULAS_COMPILED_OK'::TEXT, v_bad_compile_count = 0,
    format('%s referenced KPI catalog row(s) not COMPILED_OK', v_bad_compile_count);

  -- 5. REQUIRED_LINES_AVAILABLE — for each (kpi_value row x required_canonical_line_code), the
  --    source Statement Pack Version (via the STATEMENT_TO_ANALYSIS edge) must carry a non-MISSING
  --    finance_stmt_lines cell for that line/period.
  SELECT count(*) INTO v_missing_lines_count
    FROM finance_analysis_kpi_values v
    JOIN finance_analysis_kpi_catalog c ON c.id = v.kpi_catalog_id
    CROSS JOIN LATERAL unnest(c.required_canonical_line_codes) AS req_code
    WHERE v.business_version_id = p_business_version_id
      AND NOT EXISTS (
        SELECT 1
        FROM finance_lineage_edges e
        JOIN finance_stmt_lines sl ON sl.business_version_id = e.source_version_id
        JOIN financial_statement_lines fsl ON fsl.id = sl.canonical_line_id
        WHERE e.edge_type = 'STATEMENT_TO_ANALYSIS' AND e.target_version_id = v.business_version_id
          AND sl.period_id = v.period_id
          AND fsl.line_code = req_code
          AND sl.value_status NOT IN ('MISSING')
      );
  RETURN QUERY SELECT 'REQUIRED_LINES_AVAILABLE'::TEXT, v_missing_lines_count = 0,
    format('%s (kpi value x required line) combination(s) not available in the source Statement Pack Version', v_missing_lines_count);

  -- 6. NO_BLOCKING_EXCEPTIONS
  RETURN QUERY SELECT 'NO_BLOCKING_EXCEPTIONS'::TEXT,
    NOT EXISTS (
      SELECT 1 FROM finance_exceptions_current
      WHERE business_version_id = p_business_version_id AND severity = 'SECURITY' AND state = 'OPEN'
    ),
    'no OPEN severity=SECURITY exception'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Aggregate boolean the DRAFT -> READY_FOR_REVIEW transition calls. COALESCE(..., false): if
-- finance_analysis_readiness_check() ever returned zero rows (should not happen given the
-- VERSION_EXISTS short-circuit above, but defensive per the WP-D01 regression class) bool_and()
-- over an empty set is NULL, not true — must not silently read as "ready".
CREATE OR REPLACE FUNCTION finance_analysis_is_ready_for_review(p_business_version_id TEXT) RETURNS BOOLEAN AS $$
  SELECT COALESCE(bool_and(passed), false) FROM finance_analysis_readiness_check(p_business_version_id);
$$ LANGUAGE sql;
