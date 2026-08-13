-- 950_initiatives_priority_order_gap.sql
-- (renumbered from 948 on 2026-08-13 to make room for the C14 migration at
-- 949, per coordinator's renumbering to avoid a cross-agent collision at 947)
--
-- P0 gap discovered 2026-08-13 while proving the clean-database bootstrap
-- for `promoteToOutput` (see docs/program/METHOD_TOOLS_2026-08-13/CLEAN_BOOTSTRAP.md).
--
-- `initiatives.priority_order` is written by the LIVE (non-funnel) raw
-- INSERT path in `server/src/controllers/ToolController.ts` promoteToOutput
-- (INITIATIVE_FUNNEL_ENABLED != 'true', which is the default/current-prod
-- posture) on every single tool -> initiative promotion. The column was
-- originally added by `247_initiative_enhancements.sql`, but that file is a
-- pre-baseline, SQLite-first migration (unguarded `ALTER TABLE ... ADD
-- COLUMN` with no `IF NOT EXISTS`, plus SQLite-only `INSERT OR IGNORE`
-- syntax that is invalid Postgres). `server/scripts/migrate.postgres.ts`
-- `isSqliteOnlyMigration()` correctly excludes every numbered migration
-- < 500 from the strict Postgres run as "superseded by baseline" — but
-- `000_z_core_baseline.sql` never actually re-created `priority_order`, so
-- on a fresh, fully strict-migrated database the column silently never
-- exists. `promoteToOutput(outputType='initiative')` then fails with
-- SQLSTATE 42703 `column "priority_order" of relation "initiatives" does
-- not exist` — a different failure mode than the reported 42P01, but the
-- same class of bug (schema bootstrap gap), and it blocks promotion on an
-- otherwise fully migrated database. Confirmed empirically against a real
-- Postgres container running the full strict migration set (580 files,
-- exit 0) before this fix.
--
-- This does NOT resurrect the rest of 247_initiative_enhancements.sql
-- (initiative_completion_checks / initiative_history / tasks.blocked_*
-- etc.) — only the one column `promoteToOutput` actually depends on today.
-- Purely additive: guarded ADD COLUMN IF NOT EXISTS + guarded index, no
-- DROP, no DELETE, no ALTER of any existing column.

ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS priority_order INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_initiatives_priority_order ON initiatives(priority_order);
