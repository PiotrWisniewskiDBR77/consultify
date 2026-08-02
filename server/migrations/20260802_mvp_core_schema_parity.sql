-- Additive compatibility required by the accepted MVP core workflows when
-- they are installed on the current fresh-database baseline.
--
-- Older databases already expose projects.updated_at. The canonical baseline
-- currently does not, while Decision -> Initiative acceptance and runtime
-- writes use that timestamp explicitly.

ALTER TABLE IF EXISTS projects
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE IF EXISTS initiatives
  ADD COLUMN IF NOT EXISTS title TEXT;

UPDATE initiatives
SET title = name
WHERE title IS NULL;

UPDATE initiatives
SET status = CASE
  WHEN UPPER(COALESCE(status, '')) IN (
    'DRAFT', 'PENDING_REVIEW', 'REVIEW', 'PROMOTED', 'PLANNING',
    'APPROVED', 'SCHEDULED', 'EXECUTING', 'BLOCKED', 'DONE',
    'TRACKING', 'CANCELLED', 'ARCHIVED'
  ) THEN UPPER(status)
  ELSE 'DRAFT'
END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'initiatives'::regclass
      AND conname = 'initiatives_status_check'
  ) THEN
    ALTER TABLE initiatives
      ADD CONSTRAINT initiatives_status_check
      CHECK (
        status IN (
          'DRAFT', 'PENDING_REVIEW', 'REVIEW', 'PROMOTED', 'PLANNING',
          'APPROVED', 'SCHEDULED', 'EXECUTING', 'BLOCKED', 'DONE',
          'TRACKING', 'CANCELLED', 'ARCHIVED'
        )
      );
  END IF;
END $$;
