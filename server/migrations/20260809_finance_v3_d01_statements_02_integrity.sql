-- Finance v3 — Gate D (WP-D01b): Statements Truth Engine domain schema, part 2/3 — integrity
-- controls.
--
-- Source: docs/validation/finance-v3/generated/gate-d/WP-D01_statements_schema_ADR.md, Zalacznik A,
-- block 2 (sections 8.0-8.5). Runs after ..._01_statements_tables.sql (these functions/triggers
-- reference tables created there) and before ..._03_statements_readiness.sql.
--
-- All five integrity controls are CREATE CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED
-- (not CHECK — Postgres does not allow subqueries in CHECK, the same reason WP-B01/B03/B05 already
-- routed their own cross-row rules to triggers, see WP-C01_migration_report.md section 6 intro).
-- DEFERRABLE INITIALLY DEFERRED means each check fires once, at COMMIT, after a whole
-- batch paste/import has finished writing, not mid-transaction against a transiently unbalanced
-- partial write.
--
-- IMPORTANT — one already-live-tested fix folded in verbatim from the ADR (section 9, "co
-- testowanie znalazlo i naprawilo"): Postgres constraint triggers MUST be FOR EACH ROW (there is
-- no FOR EACH STATEMENT constraint trigger). The functions below read NEW directly per-row rather
-- than aggregating a whole-statement transition table; DEFERRABLE INITIALLY DEFERRED still gives
-- the "check the whole batch, not mid-write" semantics because every row's deferred trigger queues
-- up and only fires at COMMIT.

BEGIN;

-- 8.0 shared tolerance helper — "source rounding" half of the addendum's
-- "source rounding AND materiality, usually the more restrictive" rule.
-- Two independently-rounded presentation-unit subtotals (Total Assets side,
-- Total Liabilities+Equity side) can each carry up to 0.5 unit of rounding
-- error -> worst case combined tolerance is 1 full presentation unit.
CREATE OR REPLACE FUNCTION finance_stmt_unit_value(p_unit TEXT) RETURNS NUMERIC AS $$
BEGIN
  RETURN CASE p_unit
    WHEN 'UNITS' THEN 1
    WHEN 'THOUSANDS' THEN 1000
    WHEN 'MILLIONS' THEN 1000000
    WHEN 'BILLIONS' THEN 1000000000
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION finance_stmt_balance_tolerance(
  p_business_version_id TEXT, p_unit TEXT, p_total_assets NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  v_rounding_tolerance NUMERIC;
  v_materiality_pct NUMERIC;
  v_materiality_tolerance NUMERIC;
BEGIN
  v_rounding_tolerance := finance_stmt_unit_value(p_unit); -- 1 full presentation unit, worst case of two independently rounded subtotals

  SELECT materiality_threshold_applied INTO v_materiality_pct
    FROM finance_reconciliation_runs
    WHERE business_version_id = p_business_version_id
    ORDER BY created_at DESC LIMIT 1;

  IF v_materiality_pct IS NULL THEN
    -- No reconciliation run recorded yet for this version -> fall back to rounding-only tolerance;
    -- the PROVISIONAL_PENDING_OWNER_DECISION placeholder (GATE_B_INTEGRATION_RECONCILIATION.md §7)
    -- is per-run, not a standing default, so this function does not invent one.
    RETURN v_rounding_tolerance;
  END IF;

  v_materiality_tolerance := v_materiality_pct * ABS(p_total_assets);

  -- Addendum correction: NOT max(1 unit, 0.1%) — derive from BOTH source rounding and
  -- materiality, and take the more restrictive (smaller) of the two.
  RETURN LEAST(v_rounding_tolerance, v_materiality_tolerance);
END;
$$ LANGUAGE plpgsql;

-- 8.1 Assets = Liabilities + Equity. Constraint triggers must be FOR EACH ROW
-- (Postgres restriction — no FOR EACH STATEMENT constraint triggers, no transition
-- tables needed here since the row-level NEW already carries the dimensional key);
-- DEFERRABLE INITIALLY DEFERRED means the check runs once at COMMIT, after a whole
-- batch paste/import has finished writing both the Assets and the Liabilities+Equity
-- side, not mid-write while the row set is transiently unbalanced.
CREATE OR REPLACE FUNCTION finance_stmt_check_balance() RETURNS TRIGGER AS $$
DECLARE
  v_assets NUMERIC;
  v_liab_equity NUMERIC;
  v_tolerance NUMERIC;
  v_unit TEXT;
BEGIN
  IF NEW.statement_type != 'BS' THEN
    RETURN NULL;
  END IF;

  SELECT value_decimal, unit INTO v_assets, v_unit
    FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id
      AND period_id = NEW.period_id AND accumulation_basis = NEW.accumulation_basis
      AND canonical_line_id = (SELECT id FROM financial_statement_lines WHERE line_code = 'TOTAL_ASSETS' AND statement_type = 'BS' LIMIT 1)
      AND consolidation_scope = 'CONSOLIDATED';

  SELECT value_decimal INTO v_liab_equity
    FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id
      AND period_id = NEW.period_id AND accumulation_basis = NEW.accumulation_basis
      AND canonical_line_id = (SELECT id FROM financial_statement_lines WHERE line_code = 'TOTAL_LIABILITIES_EQUITY' AND statement_type = 'BS' LIMIT 1)
      AND consolidation_scope = 'CONSOLIDATED';

  IF v_assets IS NOT NULL AND v_liab_equity IS NOT NULL THEN
    v_tolerance := finance_stmt_balance_tolerance(NEW.business_version_id, v_unit, v_assets);
    IF ABS(v_assets - v_liab_equity) > v_tolerance THEN
      RAISE EXCEPTION 'finance_stmt_lines: balance check failed for version=% entity=% period=% basis=%: assets=% liab+equity=% diff=% tolerance=%',
        NEW.business_version_id, NEW.entity_id, NEW.period_id, NEW.accumulation_basis, v_assets, v_liab_equity, ABS(v_assets - v_liab_equity), v_tolerance;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_stmt_check_balance ON finance_stmt_lines;
CREATE CONSTRAINT TRIGGER trg_finance_stmt_check_balance
  AFTER INSERT OR UPDATE ON finance_stmt_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION finance_stmt_check_balance();

-- 8.2 Taxonomy extension — RETAINED_EARNINGS and DIVIDENDS_DECLARED do not exist yet in the
-- canonical financial_statement_lines taxonomy (confirmed absent: only TOTAL_ASSETS, CASH,
-- TOTAL_LIABILITIES, EQUITY, TOTAL_LIABILITIES_EQUITY, NET_CHANGE_CASH, CFO/CFI/CFF exist as of
-- 567_financial_statements_ratios.sql / 20260317_finance_v1_canonical_layer.sql). Additive INSERT
-- into the already-live, AUTO_MIGRATE-classified table — not a new taxonomy table.
INSERT INTO financial_statement_lines (id, statement_type, line_code, line_name, line_name_pl, sort_order, is_system)
VALUES
  ('fsl-bs-retained-earnings', 'BS', 'RETAINED_EARNINGS', 'Retained Earnings', 'Zyski zatrzymane', 85, TRUE),
  ('fsl-bs-dividends-declared', 'BS', 'DIVIDENDS_DECLARED', 'Dividends Declared', 'Zadeklarowane dywidendy', 86, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 8.3 Cash roll-forward: opening BS CASH (previous_period_id) + CF NET_CHANGE_CASH (current
-- period) = closing BS CASH (current period). This single equation covers BOTH master-plan
-- bullets "CF closing cash = BS cash" and "opening + movements = closing" for cash, because for
-- cash they are the same equation. Same deferred-constraint-trigger pattern as section 8.1.
CREATE OR REPLACE FUNCTION finance_stmt_check_cash_rollforward() RETURNS TRIGGER AS $$
DECLARE
  v_prev_period TEXT;
  v_opening_cash NUMERIC;
  v_net_change NUMERIC;
  v_closing_cash NUMERIC;
  v_unit TEXT;
  v_tolerance NUMERIC;
  v_cash_line TEXT;
  v_net_change_line TEXT;
BEGIN
  IF NEW.statement_type NOT IN ('BS', 'CF') THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_cash_line FROM financial_statement_lines WHERE line_code = 'CASH' AND statement_type = 'BS' LIMIT 1;
  SELECT id INTO v_net_change_line FROM financial_statement_lines WHERE line_code = 'NET_CHANGE_CASH' AND statement_type = 'CF' LIMIT 1;

  SELECT previous_period_id INTO v_prev_period FROM finance_stmt_periods WHERE period_id = NEW.period_id;
  IF v_prev_period IS NULL THEN
    RETURN NULL; -- first period on record (e.g. opening balance sheet) -- nothing to roll forward from, not an error
  END IF;

  SELECT value_decimal INTO v_opening_cash FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = v_prev_period
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = 'CONSOLIDATED' AND canonical_line_id = v_cash_line;
  SELECT value_decimal, unit INTO v_net_change, v_unit FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = 'CONSOLIDATED' AND canonical_line_id = v_net_change_line;
  SELECT value_decimal INTO v_closing_cash FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = 'CONSOLIDATED' AND canonical_line_id = v_cash_line;

  IF v_opening_cash IS NOT NULL AND v_net_change IS NOT NULL AND v_closing_cash IS NOT NULL THEN
    v_tolerance := finance_stmt_balance_tolerance(NEW.business_version_id, v_unit, v_closing_cash);
    IF ABS((v_opening_cash + v_net_change) - v_closing_cash) > v_tolerance THEN
      RAISE EXCEPTION 'finance_stmt_lines: cash roll-forward failed for version=% entity=% period=%: opening=% + net_change=% != closing=% (diff=%, tolerance=%)',
        NEW.business_version_id, NEW.entity_id, NEW.period_id, v_opening_cash, v_net_change, v_closing_cash,
        ABS((v_opening_cash + v_net_change) - v_closing_cash), v_tolerance;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_stmt_check_cash_rollforward ON finance_stmt_lines;
CREATE CONSTRAINT TRIGGER trg_finance_stmt_check_cash_rollforward
  AFTER INSERT OR UPDATE ON finance_stmt_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION finance_stmt_check_cash_rollforward();

-- 8.4 Retained earnings roll-forward: opening BS RETAINED_EARNINGS + P&L NET_INCOME -
-- DIVIDENDS_DECLARED = closing BS RETAINED_EARNINGS. DIVIDENDS_DECLARED contributes 0 only when
-- its value_status is explicitly NA (analyst confirmed no dividends this period) or
-- PRESENT_ZERO -- never when MISSING (silent-zero is exactly the Gate A bug this schema exists
-- to close), in which case the roll-forward check is skipped (cannot verify, not "passes").
CREATE OR REPLACE FUNCTION finance_stmt_check_retained_earnings_rollforward() RETURNS TRIGGER AS $$
DECLARE
  v_prev_period TEXT;
  v_opening_re NUMERIC;
  v_net_income NUMERIC;
  v_dividends NUMERIC;
  v_dividends_status finance_value_status;
  v_closing_re NUMERIC;
  v_unit TEXT;
  v_tolerance NUMERIC;
  v_re_line TEXT;
  v_ni_line TEXT;
  v_div_line TEXT;
BEGIN
  IF NEW.statement_type NOT IN ('BS', 'P&L') THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_re_line FROM financial_statement_lines WHERE line_code = 'RETAINED_EARNINGS' AND statement_type = 'BS' LIMIT 1;
  SELECT id INTO v_ni_line FROM financial_statement_lines WHERE line_code = 'NET_INCOME' AND statement_type = 'P&L' LIMIT 1;
  SELECT id INTO v_div_line FROM financial_statement_lines WHERE line_code = 'DIVIDENDS_DECLARED' AND statement_type = 'BS' LIMIT 1;

  SELECT previous_period_id INTO v_prev_period FROM finance_stmt_periods WHERE period_id = NEW.period_id;
  IF v_prev_period IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT value_decimal INTO v_opening_re FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = v_prev_period
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = 'CONSOLIDATED' AND canonical_line_id = v_re_line;
  SELECT value_decimal, unit INTO v_net_income, v_unit FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = 'CONSOLIDATED' AND canonical_line_id = v_ni_line;
  SELECT value_decimal, value_status INTO v_dividends, v_dividends_status FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = 'CONSOLIDATED' AND canonical_line_id = v_div_line;
  SELECT value_decimal INTO v_closing_re FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = 'CONSOLIDATED' AND canonical_line_id = v_re_line;

  IF v_opening_re IS NOT NULL AND v_net_income IS NOT NULL AND v_closing_re IS NOT NULL
     AND v_dividends_status IN ('NA', 'PRESENT_ZERO', 'PRESENT_NONZERO') THEN
    v_tolerance := finance_stmt_balance_tolerance(NEW.business_version_id, v_unit, v_closing_re);
    IF ABS((v_opening_re + v_net_income - COALESCE(v_dividends, 0)) - v_closing_re) > v_tolerance THEN
      RAISE EXCEPTION 'finance_stmt_lines: retained earnings roll-forward failed for version=% entity=% period=%: opening=% + NI=% - dividends=% != closing=% (diff=%, tolerance=%)',
        NEW.business_version_id, NEW.entity_id, NEW.period_id, v_opening_re, v_net_income, COALESCE(v_dividends, 0), v_closing_re,
        ABS((v_opening_re + v_net_income - COALESCE(v_dividends, 0)) - v_closing_re), v_tolerance;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_stmt_check_re_rollforward ON finance_stmt_lines;
CREATE CONSTRAINT TRIGGER trg_finance_stmt_check_re_rollforward
  AFTER INSERT OR UPDATE ON finance_stmt_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION finance_stmt_check_retained_earnings_rollforward();

-- 8.5 Elimination debits = credits: consolidation_scope='ELIMINATION' rows for the same
-- canonical_line_id/period/basis must net to (approximately) zero once sign_convention is
-- applied -- a non-zero net means an intercompany elimination was posted one-sided.
CREATE OR REPLACE FUNCTION finance_stmt_check_elimination_balance() RETURNS TRIGGER AS $$
DECLARE
  v_net NUMERIC;
  v_unit TEXT;
  v_tolerance NUMERIC;
BEGIN
  IF NEW.consolidation_scope != 'ELIMINATION' THEN
    RETURN NULL;
  END IF;

  SELECT
    SUM(CASE WHEN sign_convention = 'CONTRA' THEN -value_decimal ELSE value_decimal END),
    MIN(unit)
    INTO v_net, v_unit
  FROM finance_stmt_lines
  WHERE business_version_id = NEW.business_version_id AND canonical_line_id = NEW.canonical_line_id
    AND period_id = NEW.period_id AND accumulation_basis = NEW.accumulation_basis
    AND consolidation_scope = 'ELIMINATION' AND value_decimal IS NOT NULL;

  IF v_net IS NOT NULL THEN
    v_tolerance := finance_stmt_balance_tolerance(NEW.business_version_id, v_unit, v_net);
    IF ABS(v_net) > v_tolerance THEN
      RAISE EXCEPTION 'finance_stmt_lines: elimination debits != credits for version=% canonical_line=% period=% basis=%: net=% (tolerance=%)',
        NEW.business_version_id, NEW.canonical_line_id, NEW.period_id, NEW.accumulation_basis, v_net, v_tolerance;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_stmt_check_elimination_balance ON finance_stmt_lines;
CREATE CONSTRAINT TRIGGER trg_finance_stmt_check_elimination_balance
  AFTER INSERT OR UPDATE ON finance_stmt_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION finance_stmt_check_elimination_balance();

COMMIT;
