-- 20260604_collab_sessions_duration.sql
-- Idempotent hotfix for schema drift: some Postgres deployments are missing
-- collab_sessions.duration_seconds (error 42703 on IdeaCollabWs leave-persist),
-- even though 648_v4_collab_sessions.sql declares it. Re-assert the column.
-- Type matches the writer in server/src/gateways/ideaCollabWs.gateway.ts
--   (EXTRACT(EPOCH FROM (NOW() - joined_at))::integer).

-- FRESH-DB GUARD (2026-07-14): collab_sessions is created by
-- 648_v4_collab_sessions.sql, which sorts AFTER this file on a fresh replay and
-- already declares duration_seconds — no parity needed. Skip when the table
-- does not exist yet; unchanged behaviour on already-migrated DBs.
DO $$ BEGIN
  IF to_regclass('public.collab_sessions') IS NOT NULL THEN
    ALTER TABLE collab_sessions ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
  END IF;
END $$;
