-- Migration: drop my_idea_map_versions (split-brain retirement — L-07 / D-02)
--
-- Why: `my_idea_map_versions` (created by 622_my_idea_map_versions.sql) was the
-- original idea-map versioning store but shipped with ZERO runtime readers/writers.
-- The active versioning canon is `my_idea_map_snapshots` + `my_idea_activity`
-- (20260611_my_idea_map_snapshots_and_activity.sql), read/written by
-- server/src/routes/my-work.routes.ts. This forward DROP retires the dead table.
--
-- Convention: the Postgres runner (server/scripts/migrate.postgres.ts) is
-- forward-only and applied migrations are never rewritten. 622 stays in history;
-- this migration sorts AFTER it (901 > 622 > all 6xx/7xx), so on a fresh DB the
-- table is created by 622 then dropped here, and on existing DBs it is simply
-- dropped. verify-schema-vs-migrations.ts treats a created-then-dropped table as
-- transient, so it will no longer be expected in the live schema.
--
-- Idempotent: safe to run regardless of whether the table currently exists on a
-- given DB. CASCADE clears the dependent indexes/FK automatically.

DROP TABLE IF EXISTS my_idea_map_versions CASCADE;
