-- Rollback MTG-2a: remove only the materialization table and indexes introduced
-- by 20262282. Destructive for protocol materialization receipts by design.

BEGIN;

DROP INDEX IF EXISTS idx_meeting_note_materializations_receipt;
DROP INDEX IF EXISTS idx_meeting_note_materializations_artifact;
DROP INDEX IF EXISTS idx_meeting_note_materializations_note;
DROP TABLE IF EXISTS meeting_note_materializations;

COMMIT;
