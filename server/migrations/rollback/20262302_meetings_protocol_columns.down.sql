-- Explicit rollback for MTG-2a / DEC-607 migration 20262302.
-- Drops only what 20262302 added: the four meeting_decisions protocol columns,
-- the two meeting_follow_ups link columns, and their three indexes.
-- Destructive by nature (column data captured after apply is removed); kept out
-- of the forward chain by KNOWN_EXCLUDED_MIGRATIONS_SUBDIRS.
-- Rollback order is reverse-chronological: AFTER 20262303 (child table first).

BEGIN;

DROP INDEX IF EXISTS idx_meeting_follow_ups_agenda_item;
DROP INDEX IF EXISTS idx_meeting_follow_ups_task;
DROP INDEX IF EXISTS idx_meeting_decisions_owner;

ALTER TABLE meeting_follow_ups DROP COLUMN IF EXISTS agenda_item_id;
ALTER TABLE meeting_follow_ups DROP COLUMN IF EXISTS task_id;

ALTER TABLE meeting_decisions DROP COLUMN IF EXISTS rejected_alternative;
ALTER TABLE meeting_decisions DROP COLUMN IF EXISTS impact_text;
ALTER TABLE meeting_decisions DROP COLUMN IF EXISTS decision_type;
ALTER TABLE meeting_decisions DROP COLUMN IF EXISTS owner_user_id;

COMMIT;
