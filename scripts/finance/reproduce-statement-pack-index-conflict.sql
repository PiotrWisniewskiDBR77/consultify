\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE wave01_financial_statements (
  id uuid PRIMARY KEY,
  statement_pack_id uuid,
  statement_type text NOT NULL,
  period_start date,
  period_end date,
  status text NOT NULL DEFAULT 'draft'
);

CREATE UNIQUE INDEX wave01_idx_fs_pack_active_type
  ON wave01_financial_statements(statement_pack_id, statement_type)
  WHERE statement_pack_id IS NOT NULL AND COALESCE(status, 'draft') <> 'archived';

CREATE UNIQUE INDEX wave01_idx_fs_pack_active_type_period
  ON wave01_financial_statements(
    statement_pack_id,
    statement_type,
    COALESCE(period_start, DATE '0001-01-01'),
    COALESCE(period_end, DATE '0001-01-01')
  )
  WHERE statement_pack_id IS NOT NULL AND COALESCE(status, 'draft') <> 'archived';

INSERT INTO wave01_financial_statements(
  id, statement_pack_id, statement_type, period_start, period_end
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'P&L', DATE '2025-01-01', DATE '2025-12-31'
);

DO $$
BEGIN
  BEGIN
    INSERT INTO wave01_financial_statements(
      id, statement_pack_id, statement_type, period_start, period_end
    ) VALUES (
      '00000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      'P&L', DATE '2024-01-01', DATE '2024-12-31'
    );
    RAISE EXCEPTION 'WAVE01_EXPECTED_LEGACY_INDEX_CONFLICT_NOT_OBSERVED';
  EXCEPTION
    WHEN unique_violation THEN
      IF SQLERRM NOT LIKE '%wave01_idx_fs_pack_active_type%' THEN
        RAISE;
      END IF;
      RAISE NOTICE 'WAVE01_LEGACY_INDEX_CONFLICT_CONFIRMED: %', SQLERRM;
  END;
END $$;

DROP INDEX wave01_idx_fs_pack_active_type;

INSERT INTO wave01_financial_statements(
  id, statement_pack_id, statement_type, period_start, period_end
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'P&L', DATE '2024-01-01', DATE '2024-12-31'
);

DO $$
DECLARE
  row_count integer;
BEGIN
  SELECT count(*) INTO row_count FROM wave01_financial_statements;
  IF row_count <> 2 THEN
    RAISE EXCEPTION 'WAVE01_PERIOD_INDEX_EXPECTED_TWO_ROWS_GOT_%', row_count;
  END IF;
  RAISE NOTICE 'WAVE01_PERIOD_AWARE_INDEX_ACCEPTED_TWO_PERIODS';
END $$;

ROLLBACK;
