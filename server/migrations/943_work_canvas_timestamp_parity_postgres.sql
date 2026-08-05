-- Migration 943: work_canvas_drafts / work_canvas_proposals timestamp
-- columns -> canonical TEXT (M01-027c)
--
-- ROOT CAUSE: `760_work_canvas_runtime.sql` declares
-- `work_canvas_drafts.created_at`/`updated_at` and
-- `work_canvas_proposals.created_at`/`updated_at` as TEXT (ISO-8601
-- strings). `ensureStorage()` in `server/src/routes/work-canvas.routes.ts`
-- opportunistically runs `CREATE TABLE IF NOT EXISTS` for the same two
-- tables on the Canvas read paths (fail-soft, self-healing schema) and,
-- before this fix, declared the same four columns as TIMESTAMPTZ instead.
-- Whichever code path created the table FIRST won; on the live demo
-- database `760_work_canvas_runtime.sql` ran first, so demo has always
-- been TEXT (this migration is a no-op there — confirmed via read-only
-- `information_schema` inspection, see
-- `docs/ui-standards/evidence/final-acceptance-2026-08-04/01-chat/M01_SCHEMA_PARITY_SWEEP.md`).
--
-- On any OTHER environment where `ensureStorage()` created the table first
-- (a fresh branch/staging database that boots the app before running
-- `server/migrations`), the columns are TIMESTAMPTZ. `node-postgres` has no
-- type parser registered for OID 1184 in this codebase (same class of bug
-- documented in `server/src/services/financePeriodFormat.ts` for OID 1082
-- `DATE`), so every read of those columns hands the application a JS `Date`
-- object. `hasDraftConflict()`/`hasMissingOrStaleBaseToken()`
-- (`work-canvas.routes.ts`) then compare that `Date` against the client's
-- ISO-string `baseUpdatedAt` conflict token with strict `!==` — a `Date` is
-- never `===` a string, so the comparison is "stale" on every single save,
-- producing a false `CANVAS_DRAFT_CONFLICT` 409 on every draft write. The
-- user cannot save, even though nobody else touched the document.
--
-- This migration corrects any such environment by converting the columns
-- back to TEXT, using an explicit ISO-8601 (`YYYY-MM-DDTHH:MI:SS.MSSZ`)
-- cast so the resulting stored strings are byte-identical in FORMAT to what
-- `new Date().toISOString()` (the only value the application ever writes
-- to these columns) produces — a naive `::text` cast would instead produce
-- Postgres's own `YYYY-MM-DD HH:MI:SS.UUUUUU+00` representation, which
-- would not match a client-held `baseUpdatedAt` captured from a
-- pre-migration JSON response and cause one more round of spurious
-- conflicts immediately after this migration runs, for any row that
-- existed before the migration and has not been re-saved since.
--
-- `server/src/routes/work-canvas.routes.ts` (`ensureStorage()`) was fixed
-- alongside this migration to declare TEXT going forward, so a *fresh*
-- database created by `ensureStorage()` after this deploy no longer needs
-- this migration to reach the canonical type. `toDraft()` in the same file
-- also gained an independent, defense-in-depth coercion
-- (`normalizeTimestampToken`) so the CAS comparison is correct even in the
-- window before this migration has run on a given environment.
--
-- SCOPE: only `work_canvas_drafts` and `work_canvas_proposals`. The third
-- table `ensureStorage()` manages, `work_canvas_versions`, has no competing
-- migration-declared type (its only schema producer besides `ensureStorage()`
-- is the `20260719_baseline_gap.sql` snapshot, which itself captured the
-- table as TIMESTAMPTZ — i.e. TIMESTAMPTZ IS what that table already is
-- everywhere, migration and runtime agree) and `created_at` on that table is
-- never compared with strict string equality anywhere in `server/src`
-- (only ever wrapped in `new Date(...)`, which accepts a `Date` input
-- unchanged) — there is no M01-027c-shaped defect on that table, so it is
-- deliberately left untouched to keep this fix minimal and low-risk.
--
-- Idempotent + fail-soft, following the `903_expected_roi_to_text.sql`
-- precedent: each ALTER only fires if the column is still timestamp-typed,
-- and any failure is caught and logged rather than aborting the migration
-- run (this file's runner applies the whole file as one statement; a single
-- failed DO block must not take down unrelated migrations queued after it).
-- Safe to re-run: once a column is TEXT the guard condition is false and
-- the DO block is a no-op.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_canvas_drafts'
      AND column_name = 'created_at'
      AND data_type IN ('timestamp with time zone', 'timestamp without time zone')
  ) THEN
    ALTER TABLE work_canvas_drafts
      ALTER COLUMN created_at TYPE text
      USING to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    -- Drop any leftover `DEFAULT NOW()` from the old TIMESTAMPTZ
    -- declaration: it survives a bare ALTER COLUMN TYPE (Postgres keeps
    -- the default expression, casting it via assignment at INSERT time),
    -- and an un-cast `now()` writes Postgres's own
    -- `YYYY-MM-DD HH:MI:SS.UUUUUU+00` text form, not the ISO-8601 form
    -- this column's canonical writer (`new Date().toISOString()` in
    -- `server/src/routes/work-canvas.routes.ts`) always uses. The
    -- application never relies on this default (every INSERT supplies
    -- an explicit value), so dropping it is a no-op for real traffic
    -- and removes a landmine for any future caller that omits the column.
    ALTER TABLE work_canvas_drafts ALTER COLUMN created_at DROP DEFAULT;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'migration 943: work_canvas_drafts.created_at ALTER skipped/failed (ignored): %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_canvas_drafts'
      AND column_name = 'updated_at'
      AND data_type IN ('timestamp with time zone', 'timestamp without time zone')
  ) THEN
    ALTER TABLE work_canvas_drafts
      ALTER COLUMN updated_at TYPE text
      USING to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    -- Drop any leftover `DEFAULT NOW()` from the old TIMESTAMPTZ
    -- declaration: it survives a bare ALTER COLUMN TYPE (Postgres keeps
    -- the default expression, casting it via assignment at INSERT time),
    -- and an un-cast `now()` writes Postgres's own
    -- `YYYY-MM-DD HH:MI:SS.UUUUUU+00` text form, not the ISO-8601 form
    -- this column's canonical writer (`new Date().toISOString()` in
    -- `server/src/routes/work-canvas.routes.ts`) always uses. The
    -- application never relies on this default (every INSERT supplies
    -- an explicit value), so dropping it is a no-op for real traffic
    -- and removes a landmine for any future caller that omits the column.
    ALTER TABLE work_canvas_drafts ALTER COLUMN updated_at DROP DEFAULT;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'migration 943: work_canvas_drafts.updated_at ALTER skipped/failed (ignored): %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_canvas_proposals'
      AND column_name = 'created_at'
      AND data_type IN ('timestamp with time zone', 'timestamp without time zone')
  ) THEN
    ALTER TABLE work_canvas_proposals
      ALTER COLUMN created_at TYPE text
      USING to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    -- Drop any leftover `DEFAULT NOW()` from the old TIMESTAMPTZ
    -- declaration: it survives a bare ALTER COLUMN TYPE (Postgres keeps
    -- the default expression, casting it via assignment at INSERT time),
    -- and an un-cast `now()` writes Postgres's own
    -- `YYYY-MM-DD HH:MI:SS.UUUUUU+00` text form, not the ISO-8601 form
    -- this column's canonical writer (`new Date().toISOString()` in
    -- `server/src/routes/work-canvas.routes.ts`) always uses. The
    -- application never relies on this default (every INSERT supplies
    -- an explicit value), so dropping it is a no-op for real traffic
    -- and removes a landmine for any future caller that omits the column.
    ALTER TABLE work_canvas_proposals ALTER COLUMN created_at DROP DEFAULT;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'migration 943: work_canvas_proposals.created_at ALTER skipped/failed (ignored): %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_canvas_proposals'
      AND column_name = 'updated_at'
      AND data_type IN ('timestamp with time zone', 'timestamp without time zone')
  ) THEN
    ALTER TABLE work_canvas_proposals
      ALTER COLUMN updated_at TYPE text
      USING to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    -- Drop any leftover `DEFAULT NOW()` from the old TIMESTAMPTZ
    -- declaration: it survives a bare ALTER COLUMN TYPE (Postgres keeps
    -- the default expression, casting it via assignment at INSERT time),
    -- and an un-cast `now()` writes Postgres's own
    -- `YYYY-MM-DD HH:MI:SS.UUUUUU+00` text form, not the ISO-8601 form
    -- this column's canonical writer (`new Date().toISOString()` in
    -- `server/src/routes/work-canvas.routes.ts`) always uses. The
    -- application never relies on this default (every INSERT supplies
    -- an explicit value), so dropping it is a no-op for real traffic
    -- and removes a landmine for any future caller that omits the column.
    ALTER TABLE work_canvas_proposals ALTER COLUMN updated_at DROP DEFAULT;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'migration 943: work_canvas_proposals.updated_at ALTER skipped/failed (ignored): %', SQLERRM;
END $$;
