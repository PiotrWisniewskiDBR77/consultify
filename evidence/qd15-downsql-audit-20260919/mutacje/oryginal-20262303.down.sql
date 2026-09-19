-- Explicit rollback for MTG-2a / DEC-607 migration 20262303.
-- Drops only what 20262303 added: the meeting_protocols table and its indexes.
-- Destructive by nature (published protocol snapshots are removed); kept out of
-- the forward chain by KNOWN_EXCLUDED_MIGRATIONS_SUBDIRS.
-- Rollback order is reverse-chronological: 20262303 (this) BEFORE 20262302.

BEGIN;

DROP INDEX IF EXISTS idx_meeting_protocols_meeting;
DROP INDEX IF EXISTS idx_meeting_protocols_org;
DROP INDEX IF EXISTS uq_meeting_protocols_meeting_version;
DROP TABLE IF EXISTS meeting_protocols;

COMMIT;
