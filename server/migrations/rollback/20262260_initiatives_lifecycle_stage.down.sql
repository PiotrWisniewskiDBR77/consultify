-- Rollback for STAGE-1 / DEC-539 lifecycle-stage schema objects.
-- This reverses only objects introduced by 20262260_initiatives_lifecycle_stage.sql.
BEGIN;

DROP TRIGGER IF EXISTS ie_aggregate_initiative_stage_sync ON ie_aggregate_state;
DROP FUNCTION IF EXISTS sync_initiative_stage_from_aggregate();

DROP TRIGGER IF EXISTS initiatives_lifecycle_stage_sync ON initiatives;
DROP FUNCTION IF EXISTS sync_initiative_lifecycle_stage();

ALTER TABLE initiatives
  DROP CONSTRAINT IF EXISTS initiatives_lifecycle_stage_source_check,
  DROP CONSTRAINT IF EXISTS initiatives_lifecycle_stage_check,
  DROP COLUMN IF EXISTS lifecycle_stage_source,
  DROP COLUMN IF EXISTS lifecycle_stage;

COMMIT;
