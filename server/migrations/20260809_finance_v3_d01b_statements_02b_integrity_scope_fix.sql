-- Finance v3 — Gate D fix-forward (BUG-GOLDCO-02, 2026-08-09): the balance / cash roll-forward /
-- retained-earnings roll-forward constraint triggers installed by
-- `20260809_finance_v3_d01_statements_02_integrity.sql` (sections 8.1/8.3/8.4) hardcode their
-- lookups to `consolidation_scope = 'CONSOLIDATED'`. `finance_stmt_lines.consolidation_scope` has
-- three legal values (`STANDALONE`/`CONSOLIDATED`/`ELIMINATION`, WP-D01 ADR §4.5) — a Statement
-- Pack mapped at `STANDALONE` (the schema's own documented scope for a genuine single-entity,
-- non-consolidated pack, i.e. most real-world statement packs) NEVER triggered the
-- Assets=Liabilities+Equity check, the cash roll-forward, or the retained-earnings roll-forward at
-- all. Confirmed live: an identical PLN 50,000,000 imbalance was silently accepted at STANDALONE
-- scope and correctly rejected at CONSOLIDATED scope — see
-- docs/validation/finance-v3/generated/gate-d/GOLDCO_STATEMENTS_VERTICAL_SLICE_REPORT.md section 6
-- (BUG-GOLDCO-02) for the full reproduction.
--
-- Per this program's own migration discipline (CLAUDE.md "STRUKTURA PRAC" / this WP's own task
-- brief), already-applied migration SQL is never edited in place — this is a NEW additive migration
-- that `CREATE OR REPLACE FUNCTION`s the three affected trigger functions with the scope bug fixed.
-- The triggers themselves (`trg_finance_stmt_check_balance`, `trg_finance_stmt_check_cash_rollforward`,
-- `trg_finance_stmt_check_re_rollforward`) already point at these function names, so no
-- `DROP TRIGGER`/`CREATE TRIGGER` is needed here — replacing the function body is sufficient and
-- takes effect for both fresh installs (this file runs after ..._02_integrity.sql in filename/date
-- order) and upgrade replay on an already-migrated database.
--
-- Fix: instead of hardcoding `consolidation_scope = 'CONSOLIDATED'`, each lookup now uses
-- `NEW.consolidation_scope` — i.e. it checks the SAME scope the inserted/updated row itself belongs
-- to. `ELIMINATION`-scope rows are explicitly skipped by these three checks (RETURN NULL) — an
-- elimination bucket carries one-sided adjustment lines per canonical_line_id, not a full
-- Assets=Liabilities+Equity balance sheet or a cash/RE roll-forward chain; ELIMINATION rows already
-- have their own dedicated debits=credits check (section 8.5, `finance_stmt_check_elimination_balance`,
-- unaffected by this migration — it was already scoped correctly to `consolidation_scope = 'ELIMINATION'`).
-- This means STANDALONE packs now get Assets=Liabilities+Equity / cash / RE roll-forward checks
-- (previously silently skipped), and CONSOLIDATED packs keep getting exactly the same checks they
-- always did (`NEW.consolidation_scope = 'CONSOLIDATED'` behaves identically to the old hardcoded
-- literal for a CONSOLIDATED-scope row) — this is a strict widening of coverage, not a behavior
-- change for any previously-checked row.

BEGIN;

-- 8.1 (fix) Assets = Liabilities + Equity — now checked for STANDALONE and CONSOLIDATED rows
-- (ELIMINATION rows skipped, see file header).
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
  IF NEW.consolidation_scope = 'ELIMINATION' THEN
    RETURN NULL; -- eliminations are per-canonical_line_id adjustment legs, not a full BS; see section 8.5.
  END IF;

  SELECT value_decimal, unit INTO v_assets, v_unit
    FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id
      AND period_id = NEW.period_id AND accumulation_basis = NEW.accumulation_basis
      AND canonical_line_id = (SELECT id FROM financial_statement_lines WHERE line_code = 'TOTAL_ASSETS' AND statement_type = 'BS' LIMIT 1)
      AND consolidation_scope = NEW.consolidation_scope;

  SELECT value_decimal INTO v_liab_equity
    FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id
      AND period_id = NEW.period_id AND accumulation_basis = NEW.accumulation_basis
      AND canonical_line_id = (SELECT id FROM financial_statement_lines WHERE line_code = 'TOTAL_LIABILITIES_EQUITY' AND statement_type = 'BS' LIMIT 1)
      AND consolidation_scope = NEW.consolidation_scope;

  IF v_assets IS NOT NULL AND v_liab_equity IS NOT NULL THEN
    v_tolerance := finance_stmt_balance_tolerance(NEW.business_version_id, v_unit, v_assets);
    IF ABS(v_assets - v_liab_equity) > v_tolerance THEN
      RAISE EXCEPTION 'finance_stmt_lines: balance check failed for version=% entity=% period=% basis=% scope=%: assets=% liab+equity=% diff=% tolerance=%',
        NEW.business_version_id, NEW.entity_id, NEW.period_id, NEW.accumulation_basis, NEW.consolidation_scope, v_assets, v_liab_equity, ABS(v_assets - v_liab_equity), v_tolerance;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 8.3 (fix) Cash roll-forward — now checked for STANDALONE and CONSOLIDATED rows.
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
  IF NEW.consolidation_scope = 'ELIMINATION' THEN
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
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = NEW.consolidation_scope AND canonical_line_id = v_cash_line;
  SELECT value_decimal, unit INTO v_net_change, v_unit FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = NEW.consolidation_scope AND canonical_line_id = v_net_change_line;
  SELECT value_decimal INTO v_closing_cash FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = NEW.consolidation_scope AND canonical_line_id = v_cash_line;

  IF v_opening_cash IS NOT NULL AND v_net_change IS NOT NULL AND v_closing_cash IS NOT NULL THEN
    v_tolerance := finance_stmt_balance_tolerance(NEW.business_version_id, v_unit, v_closing_cash);
    IF ABS((v_opening_cash + v_net_change) - v_closing_cash) > v_tolerance THEN
      RAISE EXCEPTION 'finance_stmt_lines: cash roll-forward failed for version=% entity=% period=% scope=%: opening=% + net_change=% != closing=% (diff=%, tolerance=%)',
        NEW.business_version_id, NEW.entity_id, NEW.period_id, NEW.consolidation_scope, v_opening_cash, v_net_change, v_closing_cash,
        ABS((v_opening_cash + v_net_change) - v_closing_cash), v_tolerance;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 8.4 (fix) Retained earnings roll-forward — now checked for STANDALONE and CONSOLIDATED rows.
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
  IF NEW.consolidation_scope = 'ELIMINATION' THEN
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
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = NEW.consolidation_scope AND canonical_line_id = v_re_line;
  SELECT value_decimal, unit INTO v_net_income, v_unit FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = NEW.consolidation_scope AND canonical_line_id = v_ni_line;
  SELECT value_decimal, value_status INTO v_dividends, v_dividends_status FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = NEW.consolidation_scope AND canonical_line_id = v_div_line;
  SELECT value_decimal INTO v_closing_re FROM finance_stmt_lines
    WHERE business_version_id = NEW.business_version_id AND entity_id = NEW.entity_id AND period_id = NEW.period_id
      AND accumulation_basis = NEW.accumulation_basis AND consolidation_scope = NEW.consolidation_scope AND canonical_line_id = v_re_line;

  IF v_opening_re IS NOT NULL AND v_net_income IS NOT NULL AND v_closing_re IS NOT NULL
     AND v_dividends_status IN ('NA', 'PRESENT_ZERO', 'PRESENT_NONZERO') THEN
    v_tolerance := finance_stmt_balance_tolerance(NEW.business_version_id, v_unit, v_closing_re);
    IF ABS((v_opening_re + v_net_income - COALESCE(v_dividends, 0)) - v_closing_re) > v_tolerance THEN
      RAISE EXCEPTION 'finance_stmt_lines: retained earnings roll-forward failed for version=% entity=% period=% scope=%: opening=% + NI=% - dividends=% != closing=% (diff=%, tolerance=%)',
        NEW.business_version_id, NEW.entity_id, NEW.period_id, NEW.consolidation_scope, v_opening_re, v_net_income, COALESCE(v_dividends, 0), v_closing_re,
        ABS((v_opening_re + v_net_income - COALESCE(v_dividends, 0)) - v_closing_re), v_tolerance;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMIT;
