-- Finance v3 — Gate D fix-forward (RC-02 + RC-03, 2026-08-10): two integrity defects that only a
-- REAL filed IFRS statement pack could expose. Both were found by the Apator real-company proof
-- (`docs/validation/finance-v3/generated/gate-d/REAL_COMPANY_PROOF_report.md`, findings RC-02 and
-- RC-03) — the synthetic GoldCo oracle could not surface either, because it is denominated in
-- `unit='UNITS'` and satisfies the retained-earnings identity by construction.
--
-- Per this program's migration discipline (CLAUDE.md), an already-applied migration file is NEVER
-- edited in place. This is a NEW additive migration that `CREATE OR REPLACE FUNCTION`s the two
-- affected functions (plus one additive taxonomy row). The constraint triggers installed by
-- `20260809_finance_v3_d01_statements_02_integrity.sql` already point at these function names, so
-- no DROP/CREATE TRIGGER is needed — replacing the bodies takes effect both for a fresh install
-- (this file sorts after the 20260809 ones by date phase) and for replay on a migrated database.
--
-- =========================================================================================
-- RC-03 (P1) — `finance_stmt_balance_tolerance()` compared a FULL-UNIT tolerance against a
-- PRESENTATION-UNIT value.
--
-- `finance_stmt_lines.value_decimal` is stored IN the declared presentation unit: with
-- `unit='THOUSANDS'`, `value_decimal = 965357` means PLN 965 357 thousand. The pre-fix function
-- returned `finance_stmt_unit_value(unit)` (= 1000 for THOUSANDS) as its rounding tolerance and
-- compared THAT against a difference of `value_decimal`s. The comment in the original migration
-- says "1 full presentation unit" (i.e. PLN 1 000 at THOUSANDS), but what was effectively allowed
-- was 1000 presentation units = PLN 1 000 000. Live probe on the real Apator FY2024 balance sheet
-- (REAL_COMPANY_PROOF §5 RC-03): an injected imbalance of 500 (thousand PLN) was ACCEPTED, only
-- 1 500 was rejected. That is the balance gate — the last line of defence against an unbalanced
-- pack — silently off by 1000×.
--
-- Fix: the rounding half of the tolerance is expressed in the SAME scale as the value it is
-- compared against. Two independently rounded presentation-unit subtotals can each carry up to
-- 0.5 unit of rounding error, so the worst case is 1 full presentation unit — and 1 presentation
-- unit expressed in presentation units is 1.0, whatever `unit` says. The materiality half
-- (`materiality_pct * ABS(total_assets)`) was already scale-correct (a fraction of a value in the
-- same scale) and is unchanged, as is the `LEAST(rounding, materiality)` rule and the
-- unrecognised-unit -> NULL behaviour.
--
-- At `unit='UNITS'` the returned tolerance is 1, exactly as before — so every existing GoldCo
-- vertical-slice expectation (`tolerance=1` in the BUG-GOLDCO-02 probe output) is unchanged. The
-- behaviour change is strictly a TIGHTENING for THOUSANDS/MILLIONS/BILLIONS packs.
--
-- =========================================================================================
-- RC-02 (P1) — the retained-earnings roll-forward trigger aborted the entire import of a
-- correctly filed IFRS pack.
--
-- `finance_stmt_check_retained_earnings_rollforward()` enforced
-- `opening_RE + NET_INCOME - DIVIDENDS_DECLARED = closing_RE` by `RAISE EXCEPTION`, which in a
-- DEFERRABLE INITIALLY DEFERRED constraint trigger aborts the WHOLE mapping transaction at COMMIT.
-- On the real, consolidated Apator IFRS pack that identity does not hold, and not because the data
-- is wrong: consolidated equity legally moves through items outside net income and dividends —
-- other comprehensive income, prior-period/error corrections, transactions with owners (treasury
-- shares, share-based payment), transfers between retained earnings and other reserves,
-- non-controlling-interest movements. Measured gaps (thousand PLN):
--   FY2023: -29 215 + 8 504 - 14 612 = -35 323 vs reported closing -72 699 -> gap 37 376
--   FY2024: -72 699 + 73 214 - 17 428 = -16 913 vs reported closing   8 590 -> gap 25 503
-- The analyst got no warning and no exception to resolve — just the loss of the whole import.
--
-- That is a direct violation of DEC-FIN-009 ("the system does not block work because of data
-- problems; only a security/tenant breach and a mathematically undefined operation block").
-- Assets = Liabilities + Equity is an accounting identity that cannot legally fail, so section
-- 8.1's hard reject stays. The retained-earnings roll-forward is NOT such an identity once real
-- IFRS equity movements exist, so it must not abort anything.
--
-- Fix, in two parts:
--   (a) additional legal components are taken into account when the data carries them — a new
--       additive canonical taxonomy line `OTHER_EQUITY_MOVEMENTS` (BS) collects exactly the legal
--       retained-earnings movements that are neither net income nor declared dividends (OCI
--       recycled to retained earnings, prior-period corrections, transactions with owners,
--       transfers to/from reserves, NCI movements). When present it enters the identity, so a pack
--       that DOES disclose the bridge reconciles exactly and raises nothing.
--   (b) a residual gap above tolerance no longer aborts: it writes a `RAISED` row into
--       `finance_exceptions` (severity graded by materiality) and downgrades the business
--       version's `result_quality` to `CONDITIONAL`/`PROVISIONAL`, leaving the import committed
--       and the discrepancy visible in the Exception Inbox for an owner decision.
--
-- Severity grading: gap relative to `GREATEST(ABS(closing_RE), ABS(opening_RE))`, compared against
-- the materiality percentage frozen on the latest reconciliation run for this version, or the
-- `PROVISIONAL_PENDING_OWNER_DECISION` 5% placeholder (statementReconciliationService.ts
-- `PROVISIONAL_MATERIALITY_THRESHOLD_PCT`) when no run exists yet. >= threshold -> `MATERIAL`
-- (version becomes `PROVISIONAL`); below -> `WARNING` (version becomes `CONDITIONAL`). Apator
-- FY2023: 37 376 / 72 699 = 51.4% -> `MATERIAL`.
--
-- The exception is de-duplicated per (version, entity, period, basis, scope) via `dedup_key`,
-- because the constraint trigger is FOR EACH ROW (Postgres has no FOR EACH STATEMENT constraint
-- trigger) and would otherwise log one row per BS/P&L line in the batch.

BEGIN;

-- ---------------------------------------------------------------------------------------
-- RC-02 (a) — additive taxonomy line for the legal non-NI, non-dividend equity movements.
-- Same additive-INSERT pattern as section 8.2 of the original integrity migration, which added
-- RETAINED_EARNINGS / DIVIDENDS_DECLARED the same way.
-- ---------------------------------------------------------------------------------------
INSERT INTO financial_statement_lines (id, statement_type, line_code, line_name, line_name_pl, sort_order, is_system)
VALUES
  ('fsl-bs-other-equity-movements', 'BS', 'OTHER_EQUITY_MOVEMENTS',
   'Other Movements in Retained Earnings', 'Pozostałe zmiany zysków zatrzymanych', 87, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------------------
-- RC-03 — tolerance expressed in the same scale as the value it is compared against.
-- ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION finance_stmt_balance_tolerance(
  p_business_version_id TEXT, p_unit TEXT, p_total_assets NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  v_unit_multiplier NUMERIC;
  v_rounding_tolerance NUMERIC;
  v_materiality_pct NUMERIC;
  v_materiality_tolerance NUMERIC;
BEGIN
  v_unit_multiplier := finance_stmt_unit_value(p_unit);
  IF v_unit_multiplier IS NULL THEN
    -- Unrecognised unit -> no tolerance derivable. Unchanged from the pre-fix function.
    RETURN NULL;
  END IF;

  -- RC-03 FIX. Pre-fix this line was `v_rounding_tolerance := finance_stmt_unit_value(p_unit)`,
  -- i.e. 1000 at THOUSANDS — compared against value_decimals that are THEMSELVES in thousands,
  -- so 1000 thousand = PLN 1 000 000 of slack instead of the documented PLN 1 000.
  -- value_decimal is denominated in the presentation unit, therefore "1 full presentation unit"
  -- IS 1.0 in value_decimal terms, at every unit.
  v_rounding_tolerance := 1;

  SELECT materiality_threshold_applied INTO v_materiality_pct
    FROM finance_reconciliation_runs
    WHERE business_version_id = p_business_version_id
    ORDER BY created_at DESC LIMIT 1;

  IF v_materiality_pct IS NULL THEN
    RETURN v_rounding_tolerance;
  END IF;

  -- Already scale-correct: a fraction of a value_decimal is in value_decimal scale.
  v_materiality_tolerance := v_materiality_pct * ABS(p_total_assets);

  RETURN LEAST(v_rounding_tolerance, v_materiality_tolerance);
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------------------
-- RC-02 (b) — roll-forward mismatch becomes an exception to resolve, never a lost import.
-- Keeps every pre-fix guard: STANDALONE/CONSOLIDATED scope handling from the d01b fix, the
-- "dividends MISSING -> cannot verify, skip (never silent zero)" rule, and the deferred
-- whole-batch evaluation.
-- ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION finance_stmt_check_retained_earnings_rollforward() RETURNS TRIGGER AS $$
DECLARE
  v_prev_period TEXT;
  v_opening_re NUMERIC;
  v_net_income NUMERIC;
  v_dividends NUMERIC;
  v_dividends_status finance_value_status;
  v_other NUMERIC;
  v_other_status finance_value_status;
  v_other_applied NUMERIC;
  v_closing_re NUMERIC;
  v_unit TEXT;
  v_tolerance NUMERIC;
  v_re_line TEXT;
  v_ni_line TEXT;
  v_div_line TEXT;
  v_other_line TEXT;
  v_implied NUMERIC;
  v_gap NUMERIC;
  v_basis NUMERIC;
  v_materiality_pct NUMERIC;
  v_severity TEXT;
  v_dedup TEXT;
  v_exception_id TEXT;
  v_artifact_id TEXT;
  v_org_id TEXT;
BEGIN
  IF NEW.statement_type NOT IN ('BS', 'P&L') THEN
    RETURN NULL;
  END IF;
  IF NEW.consolidation_scope = 'ELIMINATION' THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_re_line FROM financial_statement_lines WHERE line_code = 'RETAINED_EARNINGS' AND statement_type = 'BS' LIMIT 1;
  SELECT id INTO v_ni_line FROM financial_statement_lines WHERE line_code = 'NET_INCOME' AND statement_type = 'P&L' LIMIT 1;
  SELECT id INTO v_div_line FROM financial_statement_lines WHERE line_code = 'DIVIDENDS_DECLARED' AND statement_type = 'BS' LIMIT 1;
  SELECT id INTO v_other_line FROM financial_statement_lines WHERE line_code = 'OTHER_EQUITY_MOVEMENTS' AND statement_type = 'BS' LIMIT 1;

  SELECT previous_period_id INTO v_prev_period FROM finance_stmt_periods WHERE period_id = NEW.period_id;
  IF v_prev_period IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT value_decimal INTO v_opening_re FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = v_prev_period
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = NEW.consolidation_scope AND canonical_line_id = v_re_line;
  SELECT value_decimal, unit INTO v_net_income, v_unit FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = NEW.consolidation_scope AND canonical_line_id = v_ni_line;
  SELECT value_decimal, value_status INTO v_dividends, v_dividends_status FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = NEW.consolidation_scope AND canonical_line_id = v_div_line;
  SELECT value_decimal, value_status INTO v_other, v_other_status FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = NEW.consolidation_scope AND canonical_line_id = v_other_line;
  SELECT value_decimal INTO v_closing_re FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = NEW.consolidation_scope AND canonical_line_id = v_re_line;

  IF v_opening_re IS NULL OR v_net_income IS NULL OR v_closing_re IS NULL
     OR v_dividends_status IS NULL OR v_dividends_status NOT IN ('NA', 'PRESENT_ZERO', 'PRESENT_NONZERO') THEN
    RETURN NULL; -- cannot verify (a MISSING dividends line is never treated as a silent zero)
  END IF;

  -- (a) legal non-NI, non-dividend movements enter the identity when the pack discloses them.
  IF v_other_status IS NOT NULL AND v_other_status IN ('NA', 'PRESENT_ZERO', 'PRESENT_NONZERO') THEN
    v_other_applied := COALESCE(v_other, 0);
  ELSE
    v_other_applied := 0;
  END IF;

  v_tolerance := finance_stmt_balance_tolerance(NEW.business_version_id, v_unit, v_closing_re);
  v_implied := v_opening_re + v_net_income - COALESCE(v_dividends, 0) + v_other_applied;
  v_gap := ABS(v_implied - v_closing_re);

  IF v_tolerance IS NULL OR v_gap <= v_tolerance THEN
    RETURN NULL; -- reconciles
  END IF;

  -- (b) DEC-FIN-009: an unexplained roll-forward gap is a data question, not a blocking
  -- condition. Record it, mark the version, let the import stand.
  v_dedup := 'RE_ROLLFORWARD:' || NEW.business_version_id || ':' || NEW.entity_id || ':' ||
             NEW.period_id || ':' || NEW.accumulation_basis || ':' || NEW.consolidation_scope;

  IF EXISTS (SELECT 1 FROM finance_exceptions WHERE dedup_key = v_dedup) THEN
    RETURN NULL; -- already logged for this cell by an earlier row of the same batch
  END IF;

  SELECT artifact_id, organization_id INTO v_artifact_id, v_org_id
    FROM finance_business_versions WHERE business_version_id = NEW.business_version_id;

  SELECT materiality_threshold_applied INTO v_materiality_pct
    FROM finance_reconciliation_runs
    WHERE business_version_id = NEW.business_version_id
    ORDER BY created_at DESC LIMIT 1;
  v_materiality_pct := COALESCE(v_materiality_pct, 0.05); -- PROVISIONAL_PENDING_OWNER_DECISION

  v_basis := GREATEST(ABS(v_closing_re), ABS(v_opening_re));
  IF v_basis = 0 OR (v_gap / v_basis) >= v_materiality_pct THEN
    v_severity := 'MATERIAL';
  ELSE
    v_severity := 'WARNING';
  END IF;

  v_exception_id := gen_random_uuid()::text;

  INSERT INTO finance_exceptions (
    id, exception_group_id, organization_id, artifact_id, business_version_id,
    event_type, severity, source_ref, expected, observed, delta, unit,
    reason_code, reason, dedup_key, raised_by, created_by, evidence
  ) VALUES (
    v_exception_id, v_exception_id, COALESCE(v_org_id, NEW.organization_id), v_artifact_id, NEW.business_version_id,
    'RAISED', v_severity,
    jsonb_build_object(
      'check', 'RETAINED_EARNINGS_ROLLFORWARD',
      'statement_line_code', 'RETAINED_EARNINGS',
      'entity_id', NEW.entity_id,
      'period_id', NEW.period_id,
      'previous_period_id', v_prev_period,
      'accumulation_basis', NEW.accumulation_basis,
      'consolidation_scope', NEW.consolidation_scope
    ),
    v_implied, v_closing_re, v_closing_re - v_implied, v_unit,
    'RE_ROLLFORWARD_UNEXPLAINED',
    format(
      'retained earnings roll-forward unexplained: opening=%s + NI=%s - dividends=%s + other_equity_movements=%s = %s, reported closing=%s (gap=%s, tolerance=%s). Legal IFRS movements outside net income and dividends (OCI, prior-period corrections, transactions with owners, transfers to reserves, NCI) can explain this — map them to OTHER_EQUITY_MOVEMENTS to close the bridge.',
      v_opening_re, v_net_income, COALESCE(v_dividends, 0), v_other_applied, v_implied, v_closing_re, v_gap, v_tolerance
    ),
    v_dedup, NEW.created_by, NEW.created_by,
    jsonb_build_object(
      'opening_retained_earnings', v_opening_re,
      'net_income', v_net_income,
      'dividends_declared', COALESCE(v_dividends, 0),
      'other_equity_movements', v_other_applied,
      'implied_closing', v_implied,
      'reported_closing', v_closing_re,
      'gap', v_gap,
      'tolerance', v_tolerance,
      'materiality_threshold_applied', v_materiality_pct
    )
  );

  UPDATE finance_business_versions
     SET result_quality = CASE
           WHEN v_severity = 'MATERIAL' THEN 'PROVISIONAL'
           WHEN result_quality = 'PROVISIONAL' THEN 'PROVISIONAL'
           ELSE 'CONDITIONAL'
         END
   WHERE business_version_id = NEW.business_version_id
     AND status <> 'APPROVED';

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMIT;
