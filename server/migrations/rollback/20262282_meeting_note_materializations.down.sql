-- Rollback MTG-2a: remove only the indexes introduced by 20262282.
-- The table and its status/stage constraints belong to the earlier
-- 20261090_meetings_day19_note_materialization.sql migration and must survive.

BEGIN;

DROP INDEX IF EXISTS idx_meeting_note_materializations_receipt;
DROP INDEX IF EXISTS idx_meeting_note_materializations_artifact;
DROP INDEX IF EXISTS idx_meeting_note_materializations_note;

COMMIT;
