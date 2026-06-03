-- 20260604_collab_sessions_duration.sql
-- Idempotent hotfix for schema drift: some Postgres deployments are missing
-- collab_sessions.duration_seconds (error 42703 on IdeaCollabWs leave-persist),
-- even though 648_v4_collab_sessions.sql declares it. Re-assert the column.
-- Type matches the writer in server/src/gateways/ideaCollabWs.gateway.ts
--   (EXTRACT(EPOCH FROM (NOW() - joined_at))::integer).

ALTER TABLE collab_sessions ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
