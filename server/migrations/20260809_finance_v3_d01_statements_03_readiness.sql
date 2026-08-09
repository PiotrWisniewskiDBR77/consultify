-- Finance v3 — Gate D (WP-D01b): Statements Truth Engine domain schema, part 3/3 — readiness gate.
--
-- Source: docs/validation/finance-v3/generated/gate-d/WP-D01_statements_schema_ADR.md, Zalacznik A,
-- block 3 (DRAFT -> READY_FOR_REVIEW readiness gate). Runs after ..._02_statements_integrity.sql.
-- No wrapping transaction needed (two independent CREATE FUNCTION statements), matching the ADR's
-- own note ("trzeci plik, bez owijającej transakcji").
--
-- IMPORTANT — the second already-live-tested fix folded in verbatim from the ADR (section 7,
-- "Błąd znaleziony i naprawiony przez żywe testowanie"): the first draft of check #6
-- (RECONCILIATION_RESIDUAL_WITHIN_TOLERANCE) compared a bare `v_recon_residual_status IN (...)`
-- against a possibly-NULL status (no finance_reconciliation_runs row yet for this version). SQL's
-- `NULL IN (...)` evaluates to NULL, not false, and `bool_and()` in
-- finance_stmt_is_ready_for_review() silently *ignores* NULL rows instead of counting them as
-- failed -- which let a Statement Pack that was never reconciled read back as "ready" by omission
-- (the ADR's own TEST 3 caught this live). The explicit COALESCE(..., false) below closes it;
-- WP-D01b's own regression test (see WP-D01b_statements_migration_report.md) re-proves the fix.

-- WP-D01 readiness gate — Statement Pack DRAFT -> READY_FOR_REVIEW.

CREATE OR REPLACE FUNCTION finance_stmt_readiness_check(p_business_version_id TEXT)
RETURNS TABLE(check_name TEXT, passed BOOLEAN, detail TEXT) AS $$
DECLARE
  v_org TEXT;
  v_missing_count INTEGER;
  v_unmapped_count INTEGER;
  v_null_unit_count INTEGER;
  v_null_currency_count INTEGER;
  v_recon_residual_status TEXT;
  v_period_gap_count INTEGER;
  v_entity_count INTEGER;
BEGIN
  SELECT organization_id INTO v_org FROM finance_business_versions WHERE business_version_id = p_business_version_id;
  IF v_org IS NULL THEN
    RETURN QUERY SELECT 'VERSION_EXISTS'::TEXT, false, 'no such business_version_id'::TEXT;
    RETURN;
  END IF;

  -- 1. Mapping complete: no MISSING-status cells (NA/NOT_APPLICABLE are fine, they are explicit
  --    analyst/taxonomy decisions, not gaps).
  SELECT count(*) INTO v_missing_count
    FROM finance_stmt_lines
    WHERE business_version_id = p_business_version_id AND value_status = 'MISSING';
  RETURN QUERY SELECT 'MAPPING_COMPLETE_NO_MISSING'::TEXT, v_missing_count = 0,
    format('%s cell(s) with value_status=MISSING', v_missing_count);

  -- 2. No unresolved UNMAPPED/DUPLICATE reconciliation rows.
  SELECT count(*) INTO v_unmapped_count
    FROM finance_stmt_reconciliation
    WHERE business_version_id = p_business_version_id AND bucket IN ('UNMAPPED', 'DUPLICATE');
  RETURN QUERY SELECT 'RECONCILIATION_NO_OPEN_UNMAPPED_DUPLICATE'::TEXT, v_unmapped_count = 0,
    format('%s row(s) still UNMAPPED/DUPLICATE', v_unmapped_count);

  -- 3. Unit normalized: no NULL unit/currency on any stored cell (Gate A's structural gap).
  SELECT count(*) INTO v_null_unit_count FROM finance_stmt_lines
    WHERE business_version_id = p_business_version_id AND (unit IS NULL);
  SELECT count(*) INTO v_null_currency_count FROM finance_stmt_lines
    WHERE business_version_id = p_business_version_id AND (native_currency IS NULL OR presentation_currency IS NULL);
  RETURN QUERY SELECT 'UNIT_CURRENCY_NORMALIZED'::TEXT, (v_null_unit_count = 0 AND v_null_currency_count = 0),
    format('%s null-unit cell(s), %s null-currency cell(s)', v_null_unit_count, v_null_currency_count);

  -- 4. Period lineage complete: every period referenced by a stored line has a real
  --    finance_stmt_periods row.
  SELECT count(*) INTO v_period_gap_count
    FROM finance_stmt_lines l
    WHERE l.business_version_id = p_business_version_id
      AND NOT EXISTS (SELECT 1 FROM finance_stmt_periods p WHERE p.period_id = l.period_id);
  RETURN QUERY SELECT 'PERIOD_LINEAGE_COMPLETE'::TEXT, v_period_gap_count = 0,
    format('%s line(s) reference a non-existent period_id', v_period_gap_count);

  -- 5. Entity/perimeter declared: at least one entity row for this version.
  SELECT count(*) INTO v_entity_count FROM finance_stmt_entities WHERE business_version_id = p_business_version_id;
  RETURN QUERY SELECT 'PERIMETER_DECLARED'::TEXT, v_entity_count > 0,
    format('%s entity/perimeter row(s)', v_entity_count);

  -- 6. Reconciliation residual within tolerance for the latest run.
  SELECT status INTO v_recon_residual_status
    FROM finance_reconciliation_runs
    WHERE business_version_id = p_business_version_id
    ORDER BY created_at DESC LIMIT 1;
  -- COALESCE(..., false): a bare `IN (...)` against a NULL status (no reconciliation run at
  -- all yet) evaluates to SQL NULL, not false -- and bool_and() below silently *ignores* NULL
  -- rows instead of treating them as failed, which would let a Statement Pack that was never
  -- reconciled read as "ready" by omission. Caught by live testing (ADR section 7); the explicit
  -- COALESCE closes it.
  RETURN QUERY SELECT 'RECONCILIATION_RESIDUAL_WITHIN_TOLERANCE'::TEXT,
    COALESCE(v_recon_residual_status IN ('CLEAN', 'WITHIN_TOLERANCE'), false),
    format('latest finance_reconciliation_runs.status = %s', COALESCE(v_recon_residual_status, 'NO_RUN_YET'));

  -- 7. No blocking (SECURITY / UNDEFINED_MATH) open exceptions.
  RETURN QUERY SELECT 'NO_BLOCKING_EXCEPTIONS'::TEXT,
    NOT EXISTS (
      SELECT 1 FROM finance_exceptions_current
      WHERE business_version_id = p_business_version_id AND severity = 'SECURITY' AND state = 'OPEN'
    ),
    'no OPEN severity=SECURITY exception'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Aggregate boolean the T2 submit_for_review transition calls.
CREATE OR REPLACE FUNCTION finance_stmt_is_ready_for_review(p_business_version_id TEXT) RETURNS BOOLEAN AS $$
  SELECT bool_and(passed) FROM finance_stmt_readiness_check(p_business_version_id);
$$ LANGUAGE sql;
