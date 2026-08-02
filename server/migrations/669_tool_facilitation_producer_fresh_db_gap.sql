-- Migration: 669_tool_facilitation_producer_fresh_db_gap.sql
-- Purpose: strict-schema repair (2026-08).
--
-- `tool_facilitation_sessions` / `_outcomes` / `_roles` / `_votes` (shared
-- facilitation timer + live voting for tool sessions) are used live by
-- server/src/services/realtimePlatformService.ts,
-- server/src/routes/realtime-platform.routes.ts, server/src/routes/my-work.routes.ts.
--
-- No CREATE TABLE for any of the four exists anywhere under server/migrations/
-- (the strict runner's scope). The only place they are defined is
-- server/migrations-v2/001_baseline_20260413.sql — a separate pg_dump-style
-- schema-only snapshot directory that `server/scripts/migrate.postgres.ts`
-- never reads (it only scans `server/migrations/`) — and the excluded
-- server/migrations/never-ran/660_v4_realtime_platform.sql. Consumer:
-- 790_facilitation_timer_endsat.sql (`ALTER TABLE tool_facilitation_sessions
-- ADD COLUMN IF NOT EXISTS timer_ends_at ...`), whose own header comment says
-- "Named 79x so the app's own migrationRunner ... autoruns it" — i.e. it
-- assumed the table already existed via some other bootstrap path, which is
-- not true for a genuinely fresh DB driven only by the strict migration path.
--
-- Content below is copied verbatim (columns + indexes + primary keys, PK
-- inlined instead of a separate pg_dump-style ALTER TABLE ADD CONSTRAINT —
-- equivalent, just fewer statements) from migrations-v2/001_baseline_20260413.sql
-- — not invented. Fully additive/idempotent (IF NOT EXISTS throughout), no
-- external FK, so this is a safe no-op on any DB where these tables already
-- exist (including live demo/staging, bootstrapped via migrations-v2 or a
-- manual run historically).
--
-- Numbered 669 (free slot, close to the retired 660_v4_realtime_platform.sql
-- this content descends from) so it sorts, in phase 0 numeric order, well
-- before its only strict-path consumer, 790_facilitation_timer_endsat.sql.

CREATE TABLE IF NOT EXISTS tool_facilitation_sessions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    tool_session_id TEXT NOT NULL,
    facilitator_id TEXT NOT NULL,
    status TEXT DEFAULT 'active' NOT NULL,
    timer_state TEXT DEFAULT '{}',
    current_phase TEXT,
    settings TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tfs_tool ON tool_facilitation_sessions(organization_id, tool_session_id);

CREATE TABLE IF NOT EXISTS tool_facilitation_outcomes (
    id TEXT PRIMARY KEY,
    facilitation_session_id TEXT NOT NULL,
    outcome_type TEXT DEFAULT 'decision' NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    vote_summary TEXT DEFAULT '{}',
    exported_to_type TEXT,
    exported_to_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tfo_session ON tool_facilitation_outcomes(facilitation_session_id);

CREATE TABLE IF NOT EXISTS tool_facilitation_roles (
    id TEXT PRIMARY KEY,
    facilitation_session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role_name TEXT DEFAULT 'participant' NOT NULL,
    permissions TEXT DEFAULT '[]',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tfr_session ON tool_facilitation_roles(facilitation_session_id);

CREATE TABLE IF NOT EXISTS tool_facilitation_votes (
    id TEXT PRIMARY KEY,
    facilitation_session_id TEXT NOT NULL,
    voter_id TEXT NOT NULL,
    voter_name TEXT,
    vote_target_id TEXT NOT NULL,
    vote_type TEXT DEFAULT 'upvote' NOT NULL,
    vote_value INTEGER DEFAULT 1,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tfv_session ON tool_facilitation_votes(facilitation_session_id);
