-- Ensure initiative_dependencies.source_id exists and is non-null.
-- Some environments enforce NOT NULL without a default, which breaks inserts.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'initiative_dependencies'
      AND column_name = 'source_id'
  ) THEN
    ALTER TABLE initiative_dependencies
      ADD COLUMN source_id TEXT NOT NULL DEFAULT 'manual';
  ELSE
    -- Backfill + enforce sane default for future inserts.
    UPDATE initiative_dependencies SET source_id = 'manual' WHERE source_id IS NULL;
    ALTER TABLE initiative_dependencies ALTER COLUMN source_id SET DEFAULT 'manual';
    ALTER TABLE initiative_dependencies ALTER COLUMN source_id SET NOT NULL;
  END IF;
END $$;

