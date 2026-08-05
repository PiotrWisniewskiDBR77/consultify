-- 942_ideas_collaboration_tool_sessions.sql
--
-- Deterministic, active, idempotent producer of the Ideas collaboration schema:
-- `tool_sessions` + `tool_session_presence` (+ their indexes and primary keys).
--
-- WHY THIS FILE EXISTS
-- Until now these two tables had exactly one producer in the active migration
-- set: `20260719_baseline_gap.sql`. That file aborts on a genuinely fresh
-- database (it fails earlier, on an unrelated `organization_id` reference), so
-- on any brand-new environment the tables were simply never created. Demo does
-- not show the problem only because the tables pre-date the failure there.
-- The visible symptom on a fresh schema: every call to
-- `/api/realtime-v4/tool-sessions/:id/{presence,heartbeat,disconnect}` returns
-- HTTP 500 (`relation "tool_session_presence" does not exist`), i.e. Ideas
-- collaboration is dead in the water.
--
-- The other places the schema appears are NOT usable as producers:
--   * `server/migrations/never-ran/660_v4_realtime_platform.sql` and
--     `.../641_v4_tool_runtime_contract.sql` — excluded from the run by folder;
--   * `PostgresDatabase.initDb()` runtime DDL — does not create these tables at
--     all, and runtime DDL is not a schema contract;
--   * the historical state of the demo database — not reproducible.
--
-- ORDERING
-- The filename is NUMBERED, so `migrate.postgres.ts` sorts it into phase 0,
-- which runs in full before every DATED migration. That puts it ahead of both
-- `20260719_baseline_gap.sql` (whose `create table if not exists` then becomes
-- a no-op) and `20260802_swot_proposals.sql` (whose
-- `ALTER TABLE tool_sessions ADD COLUMN ... version` previously failed with
-- `relation "tool_sessions" does not exist`).
--
-- SHAPE
-- Column list, types, defaults, nullability and indexes are taken from the
-- live demo catalog (read-only `information_schema` / `pg_indexes` dump), so a
-- fresh database and an upgraded database converge on the same schema.
-- `tool_sessions.version` is included here as well: it is otherwise added only
-- by the dated `20260802_swot_proposals.sql`, and this file must not depend on
-- a later phase to be complete.
--
-- IDEMPOTENCY
-- Every statement is guarded (`IF NOT EXISTS` / catalog-checked `DO` blocks),
-- so re-running the migration on an already-migrated database is a no-op, and
-- running it against a partially-created table adds only what is missing.

-- ---------------------------------------------------------------------------
-- tool_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tool_sessions (
    id                       TEXT NOT NULL,
    organization_id          TEXT NOT NULL,
    project_id               TEXT,
    tool_type                TEXT NOT NULL,
    name                     TEXT NOT NULL,
    status                   TEXT DEFAULT 'DRAFT',
    completion_percent       INTEGER DEFAULT 0,
    confidence_avg           REAL DEFAULT 0,
    answers_json             TEXT DEFAULT '{}',
    context_snapshot         TEXT DEFAULT '{}',
    review_requested_at      TIMESTAMP WITHOUT TIME ZONE,
    approved_at              TIMESTAMP WITHOUT TIME ZONE,
    created_by               TEXT NOT NULL,
    updated_by               TEXT,
    created_at               TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    runtime_contract_json    TEXT,
    dod_status               TEXT DEFAULT 'pending',
    wizard_state_json        TEXT,
    missing_items_json       TEXT,
    failure_reason           TEXT,
    last_generation_batch_id TEXT,
    output_json              TEXT,
    version                  INTEGER NOT NULL DEFAULT 1
);

-- Upgrade path for databases where the table already exists in an older shape.
ALTER TABLE public.tool_sessions ADD COLUMN IF NOT EXISTS project_id               TEXT;
ALTER TABLE public.tool_sessions ADD COLUMN IF NOT EXISTS status                   TEXT DEFAULT 'DRAFT';
ALTER TABLE public.tool_sessions ADD COLUMN IF NOT EXISTS completion_percent       INTEGER DEFAULT 0;
ALTER TABLE public.tool_sessions ADD COLUMN IF NOT EXISTS confidence_avg           REAL DEFAULT 0;
ALTER TABLE public.tool_sessions ADD COLUMN IF NOT EXISTS answers_json             TEXT DEFAULT '{}';
ALTER TABLE public.tool_sessions ADD COLUMN IF NOT EXISTS context_snapshot         TEXT DEFAULT '{}';
ALTER TABLE public.tool_sessions ADD COLUMN IF NOT EXISTS review_requested_at      TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE public.tool_sessions ADD COLUMN IF NOT EXISTS approved_at              TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE public.tool_sessions ADD COLUMN IF NOT EXISTS updated_by               TEXT;
ALTER TABLE public.tool_sessions ADD COLUMN IF NOT EXISTS created_at               TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.tool_sessions ADD COLUMN IF NOT EXISTS updated_at               TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.tool_sessions ADD COLUMN IF NOT EXISTS runtime_contract_json    TEXT;
ALTER TABLE public.tool_sessions ADD COLUMN IF NOT EXISTS dod_status               TEXT DEFAULT 'pending';
ALTER TABLE public.tool_sessions ADD COLUMN IF NOT EXISTS wizard_state_json        TEXT;
ALTER TABLE public.tool_sessions ADD COLUMN IF NOT EXISTS missing_items_json       TEXT;
ALTER TABLE public.tool_sessions ADD COLUMN IF NOT EXISTS failure_reason           TEXT;
ALTER TABLE public.tool_sessions ADD COLUMN IF NOT EXISTS last_generation_batch_id TEXT;
ALTER TABLE public.tool_sessions ADD COLUMN IF NOT EXISTS output_json              TEXT;
ALTER TABLE public.tool_sessions ADD COLUMN IF NOT EXISTS version                  INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tool_sessions'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.tool_sessions ADD CONSTRAINT tool_sessions_pkey PRIMARY KEY (id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_tool_sessions_org    ON public.tool_sessions USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_tool_sessions_tool   ON public.tool_sessions USING btree (tool_type);
CREATE INDEX IF NOT EXISTS idx_tool_sessions_status ON public.tool_sessions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_tool_sessions_dod    ON public.tool_sessions USING btree (dod_status);

-- ---------------------------------------------------------------------------
-- tool_session_presence
--
-- Read/write pattern (server/src/services/realtimePlatformService.ts):
--   SELECT id            ... WHERE organization_id=? AND tool_session_id=? AND user_id=?
--   INSERT               (id, organization_id, tool_session_id, user_id, user_name,
--                         user_color, cursor_state, active_block_id, editing_field,
--                         is_connected, last_heartbeat_at)
--   UPDATE heartbeat     ... SET last_heartbeat_at=CURRENT_TIMESTAMP[, cursor_state=?]
--   UPDATE disconnect    ... SET is_connected=0, disconnected_at=CURRENT_TIMESTAMP
--   SELECT list          ... WHERE ... AND is_connected=1
--                            AND last_heartbeat_at > NOW() - INTERVAL '30 seconds'
--                        ORDER BY connected_at
-- Every column below is on that path; `is_connected` is an INTEGER flag (0/1),
-- not a boolean, because that is what the service compares against.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tool_session_presence (
    id                TEXT NOT NULL,
    organization_id   TEXT NOT NULL,
    tool_session_id   TEXT NOT NULL,
    user_id           TEXT NOT NULL,
    user_name         TEXT,
    user_color        TEXT,
    cursor_state      TEXT DEFAULT '{}',
    active_block_id   TEXT,
    editing_field     TEXT,
    is_connected      INTEGER DEFAULT 1,
    connected_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    disconnected_at   TIMESTAMP WITHOUT TIME ZONE
);

ALTER TABLE public.tool_session_presence ADD COLUMN IF NOT EXISTS user_name         TEXT;
ALTER TABLE public.tool_session_presence ADD COLUMN IF NOT EXISTS user_color        TEXT;
ALTER TABLE public.tool_session_presence ADD COLUMN IF NOT EXISTS cursor_state      TEXT DEFAULT '{}';
ALTER TABLE public.tool_session_presence ADD COLUMN IF NOT EXISTS active_block_id   TEXT;
ALTER TABLE public.tool_session_presence ADD COLUMN IF NOT EXISTS editing_field     TEXT;
ALTER TABLE public.tool_session_presence ADD COLUMN IF NOT EXISTS is_connected      INTEGER DEFAULT 1;
ALTER TABLE public.tool_session_presence ADD COLUMN IF NOT EXISTS connected_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.tool_session_presence ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.tool_session_presence ADD COLUMN IF NOT EXISTS disconnected_at   TIMESTAMP WITHOUT TIME ZONE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tool_session_presence'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.tool_session_presence ADD CONSTRAINT tool_session_presence_pkey PRIMARY KEY (id);
  END IF;
END
$$;

-- Covers the tenant-scoped "who is currently connected to this session" read.
CREATE INDEX IF NOT EXISTS idx_tsp_session
  ON public.tool_session_presence USING btree (organization_id, tool_session_id, is_connected);
