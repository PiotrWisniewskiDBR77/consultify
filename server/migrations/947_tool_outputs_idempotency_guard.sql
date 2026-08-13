-- 947_tool_outputs_idempotency_guard.sql
--
-- Closes a race gap that 946 left open by design (mirrors the ALREADY
-- DOCUMENTED gap on `tool_initiative_links`: idempotency there is
-- SELECT-then-INSERT with no DB-level guarantee — see
-- tests/integration/tools-promote-characterization.realdb.test.ts C15/C16,
-- which prove a concurrent duplicate is possible).
--
-- For `tool_outputs` we do NOT want to repeat that gap: promotion is meant to
-- be the CANONICAL, immutable snapshot boundary, so two concurrent promote
-- requests for the same tool_session_id must never produce two non-superseded
-- snapshots. A partial UNIQUE index lets Postgres itself reject the race,
-- with the application falling back to SELECT (see toolOutputSnapshotService)
-- when it hits the conflict — no polling, no lock timeout tuning needed.
--
-- Additive only: CREATE UNIQUE INDEX IF NOT EXISTS, no DROP/ALTER/DELETE.
--
-- Scope of the guarantee: at most one row per tool_session_id with
-- status <> 'superseded' at any time. Multiple SUPERSEDED rows (revision
-- history) are explicitly allowed and expected.

CREATE UNIQUE INDEX IF NOT EXISTS uq_tool_outputs_active_snapshot_per_session
  ON tool_outputs (tool_session_id)
  WHERE status <> 'superseded';
