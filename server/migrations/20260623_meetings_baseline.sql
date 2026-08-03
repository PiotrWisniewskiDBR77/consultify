-- FRESH-DB GUARD (2026-08-02, MW-07 Codex review finding): `meetings` is not
-- declared by any migration `isSqliteOnlyMigration()` accepts. The only place
-- that creates it today is `ensureMeetingTables()` in
-- server/src/services/meetingService.ts, called lazily on first use from
-- meeting-service functions/routes -- not from `initDb()`/DatabaseInitializer,
-- and not part of the migration replay path at all. On staging/prod this stays
-- invisible because that lazy bootstrap runs the first time any meeting
-- endpoint is hit -- but a genuinely fresh `db:migrate:strict` replay (no app
-- code involved) never creates the table, so MW-07's meeting-provider-honesty
-- flow (server/src/routes/v8/my-work.routes.ts) has nothing to query.
-- `20260719_baseline_gap.sql` DOES declare `meetings` (line ~5878), but that
-- file sorts far too late to matter: a real strict replay already stops at
-- the pre-existing, unrelated `20260624_initiative_status_normalize.sql` gap
-- (`initiatives.title` missing from baseline) long before reaching it. This
-- file is dated `20260623` specifically so it sorts before that `20260624`
-- migration, and after `20260623_distribution_delivery.sql` (its own
-- status_reports fresh-DB guard) -- so a strict replay creates `meetings`
-- before the unrelated stop point, same proven pattern as that fix.
--
-- Shape copied verbatim from the real `ensureMeetingTables()` DDL (the actual,
-- currently-running production schema), with the same SQLite->Postgres
-- TEXT-default correction already used elsewhere in this file
-- (`datetime('now')` -> `(now()::text)`). CREATE IF NOT EXISTS = no-op on DBs
-- where the table already exists via the lazy bootstrap (staging/demo/prod).
CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    title TEXT NOT NULL,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    location TEXT DEFAULT '',
    attendees_json TEXT DEFAULT '[]',
    pre_read_json TEXT DEFAULT '[]',
    agenda_json TEXT DEFAULT '[]',
    decisions_json TEXT DEFAULT '[]',
    status TEXT DEFAULT 'scheduled',
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT (now()::text),
    updated_at TEXT DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS meeting_follow_ups (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    title TEXT NOT NULL,
    owner TEXT DEFAULT '',
    status TEXT DEFAULT 'open',
    created_at TEXT DEFAULT (now()::text),
    updated_at TEXT DEFAULT (now()::text),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meetings_org ON meetings(organization_id, start_at);
CREATE INDEX IF NOT EXISTS idx_meetings_project ON meetings(project_id, start_at);
CREATE INDEX IF NOT EXISTS idx_meeting_follow_ups_meeting ON meeting_follow_ups(meeting_id);
