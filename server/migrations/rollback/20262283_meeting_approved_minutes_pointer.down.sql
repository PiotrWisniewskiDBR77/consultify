-- Rollback MTG-2b: remove only the approved-minutes pointer introduced by
-- 20262283. Does not remove `meeting_notes` or materialized artifacts.

BEGIN;

DROP INDEX IF EXISTS idx_meetings_approved_minutes_artifact;
ALTER TABLE meetings DROP COLUMN IF EXISTS approved_minutes_at;
ALTER TABLE meetings DROP COLUMN IF EXISTS approved_minutes_artifact_id;
ALTER TABLE meetings DROP COLUMN IF EXISTS approved_minutes_note_id;

COMMIT;
