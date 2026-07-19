-- T9-1: Facilitation shared timer — durable end_at column.
--
-- Until now the per-phase countdown lived only inside tool_facilitation_sessions.timer_state
-- (a free-form JSON blob), so the server had no first-class, queryable notion of "when does
-- the running timer end". This makes the shared timer's deadline a real, indexed column so
-- late joiners and the WS broadcast can resolve it without parsing JSON, and so an ended
-- session's frozen deadline is inspectable.
--
-- Additive + idempotent. Named 79x so the app's own migrationRunner (regex /^(7\d{2}|\d{8})_/)
-- autoruns it on demo/staging; the acceptance schema loader applies every server/migrations/*.sql.

ALTER TABLE tool_facilitation_sessions
  ADD COLUMN IF NOT EXISTS timer_ends_at TIMESTAMP;
