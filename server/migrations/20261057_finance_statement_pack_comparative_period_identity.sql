-- A Statement pack contains one canonical document per statement type AND
-- reporting period. The original type-only index rejected legitimate FY25/FY24
-- comparisons and forced five staged siblings outside their durable pack.

DO $$
BEGIN
  IF to_regclass('public.financial_statements') IS NULL THEN
    RAISE EXCEPTION 'financial_statements is required before comparative pack identity';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'financial_statements'
       AND column_name IN ('statement_pack_id', 'statement_type', 'period_start', 'period_end')
     GROUP BY table_schema, table_name
    HAVING COUNT(*) = 4
  ) THEN
    RAISE EXCEPTION 'financial_statements comparative pack identity columns are incomplete';
  END IF;
END $$;

DROP INDEX IF EXISTS idx_fs_pack_active_type;

CREATE UNIQUE INDEX idx_fs_pack_active_type_period
  ON financial_statements(
    statement_pack_id,
    statement_type,
    COALESCE(period_start, DATE '0001-01-01'),
    COALESCE(period_end, DATE '0001-01-01')
  )
  WHERE statement_pack_id IS NOT NULL AND COALESCE(status, 'draft') <> 'archived';
