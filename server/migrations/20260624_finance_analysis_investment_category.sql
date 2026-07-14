-- M16/1.5 — allow 'investment' in financial_analysis_ratios.category
-- The CHECK was inline+unnamed in 570_finance_analysis_budgeting_t052_t053.sql,
-- so Postgres auto-named it `financial_analysis_ratios_category_check`.
-- Investment ratios were being remapped to 'growth' (financialAnalysisService.ts:137)
-- because the constraint rejected 'investment'. This widens the constraint.
-- (Removing the service-side remap is a separate follow-up.)

-- FRESH-DB GUARD (2026-07-14): financial_analysis_ratios is created by
-- 570_finance_analysis_budgeting_t052_t053.sql, which sorts AFTER this file on
-- a fresh replay. Skip when the table does not exist yet; 570 re-applies the
-- widened CHECK as a parity step, so the final schema is identical. No
-- behaviour change on already-migrated DBs.
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  IF to_regclass('public.financial_analysis_ratios') IS NULL THEN
    RETURN;
  END IF;

  -- Find whatever CHECK constraint currently governs `category` on this table,
  -- regardless of its auto-generated name.
  SELECT con.conname
    INTO v_constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
   WHERE rel.relname = 'financial_analysis_ratios'
     AND con.contype = 'c'
     AND pg_get_constraintdef(con.oid) ILIKE '%category%'
   LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE financial_analysis_ratios DROP CONSTRAINT %I',
      v_constraint_name
    );
  END IF;

  -- Re-add the CHECK with 'investment' included.
  ALTER TABLE financial_analysis_ratios
    ADD CONSTRAINT financial_analysis_ratios_category_check
    CHECK (category IN ('liquidity','profitability','efficiency','leverage','growth','investment'));
END $$;
