-- Migration: DP-3 shared idea maps — schema foundation (T1)
-- Adds the columns needed to promote ONE canonical `my_idea_maps` row per
-- idea_id (today: one row per idea_id+user_id, per-user copies).
--
-- Idempotent. Safe to run multiple times / re-apply.
--
-- Data migration (promoting a canonical row per idea, archiving the rest to
-- my_idea_map_snapshots, bumping version) is a SEPARATE task (T2) — this
-- migration only adds columns + the partial unique index and leaves existing
-- rows untouched (is_canonical defaults to TRUE for every row, so multiple
-- per-user rows for the same idea_id would violate the new unique index —
-- T2 must resolve that BEFORE this index can be enforced against rows that
-- pre-date it; CREATE UNIQUE INDEX IF NOT EXISTS below will fail on a table
-- with pre-existing duplicate idea_id rows until T2 has run).
--
-- See: Harvard/wdrozenie-100/_M06_DP3_MULTIPLAYER_PLAN_2026-07-04.md §1
-- Flag: ENABLE_SHARED_IDEA_MAPS (OFF = full rollback to per-user reads).

ALTER TABLE my_idea_maps ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN DEFAULT TRUE;
ALTER TABLE my_idea_maps ADD COLUMN IF NOT EXISTS last_editor_user_id TEXT;
ALTER TABLE my_idea_maps ADD COLUMN IF NOT EXISTS archived_from_user_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_idea_maps_canonical
  ON my_idea_maps (idea_id) WHERE is_canonical = TRUE;
