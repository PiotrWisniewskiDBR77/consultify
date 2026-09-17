-- Explicit rollback for MTG-1 / DEC-596 migration 20262301.
-- Drops only what 20262301 added: the agenda-items table, the lifecycle
-- CHECK constraint, the lifecycle default and the four new meetings columns.
-- Destructive by nature (agenda items created after apply are removed);
-- kept out of the forward chain by KNOWN_EXCLUDED_MIGRATIONS_SUBDIRS.

BEGIN;

DROP INDEX IF EXISTS idx_meeting_agenda_items_org;
DROP INDEX IF EXISTS idx_meeting_agenda_items_meeting;
DROP TABLE IF EXISTS meeting_agenda_items;

ALTER TABLE meetings ALTER COLUMN lifecycle_state DROP DEFAULT;

ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_lifecycle_state_check;

ALTER TABLE meetings DROP COLUMN IF EXISTS lifecycle_state;
ALTER TABLE meetings DROP COLUMN IF EXISTS scribe_user_id;
ALTER TABLE meetings DROP COLUMN IF EXISTS chair_user_id;
ALTER TABLE meetings DROP COLUMN IF EXISTS type;

COMMIT;
