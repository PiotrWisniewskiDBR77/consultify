-- 953_organizations_trial_tokens_used_gap.sql
--
-- P0 gap discovered 2026-08-18 while tracing why `POST /api/ai/chat/stream`
-- fails closed with `ACCESS_POLICY_UNAVAILABLE` on a genuinely fresh,
-- strictly-migrated database.
--
-- `server/src/services/access/AccessUsageService.ts` reads and writes
-- `organizations.trial_tokens_used` directly:
--   trackTokenUsage() (~L109): `UPDATE organizations SET trial_tokens_used =
--     COALESCE(trial_tokens_used, 0) + ? WHERE id = ?`
--   getTrialUsage()   (~L120): `SELECT trial_tokens_used FROM organizations
--     WHERE id = ?`
-- No migration in the strict run set ever adds that column to
-- `organizations`. Traced every migration that mentions the column name:
--   - `000_z_core_baseline.sql` (L71, L103) adds `trial_tokens_used` to
--     `users`, not `organizations`.
--   - `20260813_repair_c1_core_identity_columns.sql` (L14-18) ALTERs
--     `organizations` with active_llm_provider_id/billing_currency/
--     billing_country/tax_exempt only; its `users` ALTER two lines below
--     (L23) is the one that carries `trial_tokens_used` — same column name,
--     wrong table.
--   - `223_billing_mock_seed.sql` is excluded from the strict run by the
--     `f.includes('mock')` rule in `isSqliteOnlyMigration()`
--     (server/scripts/migrate.postgres.ts) — seed data, not schema.
--   - `000_initdb_core_tables.sql` is excluded by the
--     `f.startsWith('000_initdb_')` rule — legacy pre-baseline SQLite
--     snapshot, superseded by `000_z_core_baseline.sql`.
--   - `never-ran/016_add_trial_token_tracking.sql.sql` (the one file that DID
--     target the right table) sits in the `never-ran/` subdirectory, which
--     `getAllMigrations()` never even walks into (KNOWN_EXCLUDED_MIGRATIONS_SUBDIRS),
--     AND its `.sql.sql` double extension would separately exclude it via
--     `f.endsWith('.sql.sql')` even if it were promoted out of that directory.
--
-- `server/src/database/PostgresDatabase.ts` `initDb()` also self-heals this
-- exact column at application-boot time via a guarded `information_schema`
-- check (~L3440-3442) — but that runtime path is explicitly disabled for the
-- strict/canonical test posture this program is closing out under
-- (`playwright.config.ts` sets `DB_MANAGED_SCHEMA=off` and
-- `POSTGRES_SKIP_INIT_IN_TEST=1` for every E2E backend, including the G4
-- suite). Migrations are the only schema source of truth there, so the gap
-- is real and reachable, independent of that runtime escape hatch.
--
-- FAIL-CLOSED CATALOG PREFLIGHT (owner ruling 2026-08-18, revised same day
-- after a second review): a bare `ADD COLUMN IF NOT EXISTS` would silently
-- accept a same-named column in the WRONG shape — exactly the class of
-- defect this packet exists to close. This migration inspects
-- `information_schema.columns` first, everything schema-qualified to
-- `public.organizations` on both the read side (`table_schema = 'public'`)
-- and the write side (`ALTER TABLE public.organizations`) so a non-default
-- `search_path` can never make the preflight validate one relation while
-- the mutation lands on another:
--   - TABLE `public.organizations` ABSENT -> RAISE EXCEPTION, do NOT
--     no-op and do NOT use `ALTER TABLE IF EXISTS`. A missing base table is
--     an unrepaired environment, not a state this migration is allowed to
--     record as successfully applied. Per the runner's own contract
--     (server/scripts/migrate.postgres.ts `applyOneMigration`), a RAISE
--     here makes the run exit non-zero and records this file 'failed' —
--     and because "pending" is computed as "no ledger row OR status !=
--     'success'", THIS FILE STAYS PENDING and is retried automatically the
--     next time migrations run, with no separate remediation step needed
--     once `organizations` exists. Returning success (or silently
--     no-op'ing) instead would burn a 'success' ledger row for work that
--     was never actually performed, and nothing would ever replay it.
--   - column ABSENT (table present)  -> add it (INTEGER, nullable,
--                                default 0 — mirrors the sibling
--                                `users.trial_tokens_used` column added in
--                                `20260813_repair_c1_core_identity_columns.sql`).
--   - column PRESENT, correct shape (data_type=integer, is_nullable=YES,
--     default normalises to 0) -> no-op. "Normalises to 0" means the
--     `column_default` text with any trailing `::type` cast and any
--     wrapping parens stripped equals `0` — `0`, `0::integer`, `(0)::integer`
--     all match; nothing else does.
--   - column PRESENT, wrong type / wrong or missing default / NOT NULL
--     -> RAISE EXCEPTION before any mutation, naming the column and both
--        the expected and observed shape. No coercion, no ALTER TYPE, no
--        silent accept.
-- Idempotent and replay-safe: a second run over a correctly-shaped column
-- (or a correctly-repaired, still-missing table — see above) takes the
-- appropriate branch and changes nothing beyond what that branch already
-- describes.

DO $trial_tokens_used_gap$
DECLARE
  existing_type      text;
  existing_nullable  text;
  existing_default   text;
  normalized_default text;
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION
      '953_organizations_trial_tokens_used_gap: public.organizations does not exist — refusing to '
      'record this migration as applied (fail closed). This is an unrepaired environment, not a '
      'no-op condition; once public.organizations exists this migration will apply automatically '
      'on the next run (it stays pending: no success ledger row is written here).';
  END IF;

  SELECT data_type, is_nullable, column_default
    INTO existing_type, existing_nullable, existing_default
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'organizations'
     AND column_name = 'trial_tokens_used';

  IF existing_type IS NULL THEN
    -- Column absent, table present: safe to add.
    ALTER TABLE public.organizations
      ADD COLUMN IF NOT EXISTS trial_tokens_used INTEGER DEFAULT 0;
    RETURN;
  END IF;

  -- Normalise the observed default expression: strip one trailing explicit
  -- type cast (`::integer`, `::int4`, ...) and any wrapping parens, so
  -- `0`, `0::integer`, `(0)::integer` all reduce to `0` without accepting a
  -- genuinely different value.
  normalized_default := existing_default;
  normalized_default := regexp_replace(normalized_default, '::[a-zA-Z0-9_ ]+$', '');
  normalized_default := regexp_replace(normalized_default, '^\(+|\)+$', '', 'g');
  normalized_default := trim(normalized_default);

  IF existing_type <> 'integer'
     OR existing_nullable <> 'YES'
     OR normalized_default IS DISTINCT FROM '0' THEN
    RAISE EXCEPTION
      '953_organizations_trial_tokens_used_gap: public.organizations.trial_tokens_used already '
      'exists with an unexpected shape — refusing to mutate (fail closed). '
      'Expected: data_type=integer, is_nullable=YES, default normalises to 0. '
      'Observed: data_type=%, is_nullable=%, default=% (normalized=%).',
      existing_type,
      existing_nullable,
      COALESCE(existing_default, '<none>'),
      COALESCE(normalized_default, '<none>');
  END IF;

  -- Column already exists with exactly the expected shape: no-op.
END
$trial_tokens_used_gap$;
