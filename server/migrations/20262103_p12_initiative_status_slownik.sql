BEGIN;

ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS on_hold BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM initiatives
    WHERE UPPER(status) NOT IN (
      'PROPOSED', 'DRAFT', 'PENDING_REVIEW', 'REVIEW', 'PROMOTED', 'PLANNING',
      'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'EXECUTING', 'IN_PROGRESS',
      'IN_EXECUTION', 'BLOCKED', 'DONE', 'TRACKING', 'ARCHIVED', 'CLOSED',
      'CANCELLED', 'REJECTED'
    )
  ) THEN
    RAISE EXCEPTION 'P12: initiatives.status zawiera kod bez jawnego mapowania';
  END IF;
END $$;

-- Ścisły zastany CHECK nie dopuszcza żadnego nowego kodu, więc backfill nie może
-- poprzedzić jego zdjęcia. Przejściowy CHECK utrzymuje ochronę przez całą transakcję.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.initiatives'::regclass
      AND conname = 'initiatives_status_check_p12_transition'
  ) THEN
    ALTER TABLE initiatives ADD CONSTRAINT initiatives_status_check_p12_transition
      CHECK (status IN (
        'PROPOSED', 'DRAFT', 'PENDING_REVIEW', 'REVIEW', 'PROMOTED', 'PLANNING',
        'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'EXECUTING', 'IN_PROGRESS',
        'IN_EXECUTION', 'BLOCKED', 'DONE', 'TRACKING', 'ARCHIVED', 'CLOSED',
        'CANCELLED', 'REJECTED'
      ));
  END IF;
END $$;

ALTER TABLE initiatives DROP CONSTRAINT IF EXISTS initiatives_status_check;

WITH mapped AS (
  SELECT
    id,
    CASE UPPER(status)
      WHEN 'PROPOSED' THEN 'PROPOSED'
      WHEN 'DRAFT' THEN 'DRAFT'
      WHEN 'PENDING_REVIEW' THEN 'PENDING_APPROVAL'
      WHEN 'REVIEW' THEN 'PENDING_APPROVAL'
      WHEN 'PROMOTED' THEN 'PENDING_APPROVAL'
      WHEN 'PLANNING' THEN 'PENDING_APPROVAL'
      WHEN 'PENDING_APPROVAL' THEN 'PENDING_APPROVAL'
      WHEN 'APPROVED' THEN 'APPROVED'
      WHEN 'SCHEDULED' THEN 'APPROVED'
      WHEN 'EXECUTING' THEN 'IN_EXECUTION'
      WHEN 'IN_PROGRESS' THEN 'IN_EXECUTION'
      WHEN 'IN_EXECUTION' THEN 'IN_EXECUTION'
      WHEN 'BLOCKED' THEN 'IN_EXECUTION'
      WHEN 'DONE' THEN 'CLOSED'
      WHEN 'TRACKING' THEN 'CLOSED'
      WHEN 'ARCHIVED' THEN 'CLOSED'
      WHEN 'CLOSED' THEN 'CLOSED'
      WHEN 'CANCELLED' THEN 'REJECTED'
      WHEN 'REJECTED' THEN 'REJECTED'
    END AS target_status,
    (on_hold OR UPPER(status) = 'BLOCKED' OR blocked_at IS NOT NULL
      OR NULLIF(BTRIM(COALESCE(blocked_reason, '')), '') IS NOT NULL) AS target_on_hold,
    (archived OR UPPER(status) = 'ARCHIVED' OR archived_at IS NOT NULL) AS target_archived
  FROM initiatives
)
UPDATE initiatives AS i
SET status = mapped.target_status,
    on_hold = mapped.target_on_hold,
    archived = mapped.target_archived,
    updated_at = CURRENT_TIMESTAMP
FROM mapped
WHERE i.id = mapped.id
  AND (i.status, i.on_hold, i.archived)
      IS DISTINCT FROM (mapped.target_status, mapped.target_on_hold, mapped.target_archived);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.initiatives'::regclass
      AND conname = 'initiatives_status_check_p12'
  ) THEN
    ALTER TABLE initiatives
      ADD CONSTRAINT initiatives_status_check_p12
      CHECK (status IN (
        'PROPOSED', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED',
        'IN_EXECUTION', 'CLOSED', 'REJECTED'
      ));
  END IF;
END $$;

ALTER TABLE initiatives DROP CONSTRAINT IF EXISTS initiatives_status_check_p12_transition;

COMMIT;
