ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS perspective TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'goals_perspective_declared_check'
       AND conrelid = 'goals'::regclass
  ) THEN
    ALTER TABLE goals
      ADD CONSTRAINT goals_perspective_declared_check
      CHECK (
        perspective IS NULL OR perspective IN (
          'financial',
          'customer',
          'process',
          'learning',
          'governance_data_quality'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_goals_org_perspective
  ON goals (organization_id, perspective);
