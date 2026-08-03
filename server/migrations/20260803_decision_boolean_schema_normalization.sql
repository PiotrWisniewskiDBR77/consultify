-- Normalize Decision-domain boolean columns after all legacy producers.
--
-- Older full-directory migration paths may create these tables from the
-- INTEGER-based 292/297/303 migrations before the BOOLEAN-based 728 migration.
-- CREATE TABLE IF NOT EXISTS then preserves the wrong winning definition.
-- Railway demo currently has BOOLEAN columns, so this migration is a no-op
-- there; fresh databases are repaired deterministically.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'decision_impacts'
      AND column_name = 'is_blocker'
      AND data_type <> 'boolean'
  ) THEN
    ALTER TABLE decision_impacts ALTER COLUMN is_blocker DROP DEFAULT;
    ALTER TABLE decision_impacts
      ALTER COLUMN is_blocker TYPE BOOLEAN USING (is_blocker <> 0);
    ALTER TABLE decision_impacts ALTER COLUMN is_blocker SET DEFAULT FALSE;
  END IF;
END $$;

DO $$
DECLARE
  column_name_to_fix TEXT;
BEGIN
  FOREACH column_name_to_fix IN ARRAY ARRAY[
    'notify_on_create',
    'notify_on_update',
    'notify_on_decision',
    'notify_on_escalation'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'decision_stakeholders'
        AND column_name = column_name_to_fix
        AND data_type <> 'boolean'
    ) THEN
      EXECUTE format(
        'ALTER TABLE decision_stakeholders ALTER COLUMN %I DROP DEFAULT',
        column_name_to_fix
      );
      EXECUTE format(
        'ALTER TABLE decision_stakeholders ALTER COLUMN %I TYPE BOOLEAN USING (%I <> 0)',
        column_name_to_fix,
        column_name_to_fix
      );
      EXECUTE format(
        'ALTER TABLE decision_stakeholders ALTER COLUMN %I SET DEFAULT TRUE',
        column_name_to_fix
      );
    END IF;
  END LOOP;
END $$;
