-- OWNER DECISION: the connector runtime shape is authoritative for MVP.
--
-- server/migrations/256_integrations_system.sql declared `integrations` with
-- CREATE TABLE IF NOT EXISTS using provider_id as the required identity
-- column (NOT NULL, UNIQUE(organization_id, provider_id), FK to
-- integration_providers). That is the shape a fresh, from-scratch migration
-- run actually produces.
--
-- server/src/database/DatabaseInitializer.ts's ensureIntegrationRuntimeTables()
-- (Postgres branch, ~lines 1226-1335) converges `integrations` onto a second,
-- incompatible shape keyed by connector_id at every boot, and every live
-- consumer -- Settings routes (the production INSERT at
-- server/src/routes/settings.routes.ts:1761), integrations routes, V8 sync,
-- inventory, syncHub, superadmin -- reads and writes that connector_id shape,
-- not provider_id. Because CREATE TABLE IF NOT EXISTS means "first writer
-- wins", a database that only ever ran the migration ledger (never booted the
-- app process that runs DatabaseInitializer) is stuck on the provider_id
-- shape and the production INSERT fails with:
--   column "connector_id" of relation "integrations" does not exist
-- Verified by hand against a freshly migrated database.
--
-- This migration puts that runtime convergence into the ledger itself, so the
-- migration history is sufficient on its own (no dependency on boot-time
-- self-heal running first). It is a literal mirror of
-- ensureIntegrationRuntimeTables()'s Postgres branch: same column
-- names/types/defaults, same two NOT NULLs relaxed, same backfill, same two
-- indexes. It does NOT rewrite anything onto provider_id, does NOT drop
-- provider_id or any other legacy column, and does NOT invent a new
-- organization+connector uniqueness constraint -- none of those exist in the
-- runtime convergence being mirrored, so none are added here.
--
-- One deliberate divergence from the JS source, not a mirroring gap: the JS
-- computes a `configExpr` (COALESCE(config, settings, '{}')) but never uses it
-- in the UPDATE's SET list -- it is dead code in DatabaseInitializer.ts. That
-- turns out not to matter: `config` is declared with DEFAULT '{}' in both the
-- CREATE TABLE and the ADD COLUMN IF NOT EXISTS below, and Postgres populates
-- a non-volatile column default for every pre-existing row at ADD COLUMN time
-- (no table rewrite needed since PG 11), so `config` is already '{}' for every
-- legacy row before the backfill UPDATE below even runs -- the UPDATE's
-- `config IS NULL` guard clause never actually fires for that reason. This
-- migration reproduces that same omission (no `config = ...` in the backfill
-- SET list) rather than "fixing" behaviour the runtime code does not have.
--
-- Idempotency/safety design (house style per 20261019_template_provenance_
-- approval_receipts.sql): a preflight runs BEFORE any mutation.
--   1) If integrations does not exist yet, nothing to check -- the CREATE
--      TABLE IF NOT EXISTS below establishes the converged shape directly.
--   2) If it exists, every column this migration is about to touch is checked
--      against its expected type via information_schema (already a canonical,
--      single rendering from Postgres -- same technique 20261019 uses for its
--      own column-list check). A legacy column with an unexpected type
--      refuses the whole migration before any ALTER/UPDATE/CREATE INDEX runs.
--   3) The two indexes this migration owns (idx_integrations_org,
--      idx_integrations_connector) are checked, when already present, against
--      a canonical twin built in pg_temp and rendered via pg_get_indexdef --
--      not a hardcoded literal -- because index/constraint DDL rendering is
--      not stable across equivalent-but-differently-written source SQL, only
--      simple type names are. migration 256 already creates
--      idx_integrations_org with this exact definition, so on the legacy
--      shape this check is expected to PASS, not fail.
-- Every mutating statement below is itself idempotent (ADD COLUMN IF NOT
-- EXISTS, ALTER COLUMN ... DROP NOT NULL is a no-op when already nullable,
-- CREATE INDEX IF NOT EXISTS, and the backfill UPDATE's WHERE clause is false
-- for every row it already touched), so re-applying this file after a
-- successful run is a byte-identical no-op. The whole file runs inside the
-- single transaction the migration runner wraps every file in (BEGIN ...
-- COMMIT/ROLLBACK in DatabaseInitializer.ts's migration loop), so a preflight
-- RAISE EXCEPTION rolls back any statement that ran earlier in this same
-- file and leaves the table exactly as it was.

-- ==========================================
-- PREFLIGHT (read-only until the final RAISE, if any)
-- ==========================================

-- UPDATE (post-review, measured against the REAL 766-migration baseline
-- rather than the legacy fixture this preflight was first validated
-- against): scopes is JSONB on a genuinely fresh database --
-- 566_sync_hub_guardrails_t086_t008.sql adds it as JSONB when absent, and
-- 20260719_baseline_gap.sql's convergence dump explicitly
-- `ALTER COLUMN scopes SET DATA TYPE jsonb` -- confirmed by querying
-- information_schema on a live 766-migration database, not asserted from
-- reading migration source alone. JSONB is authoritative and compatible; it
-- is not a rewrite target. A bare TEXT scopes column (an even older,
-- pre-566 shape) round-trips the same JSON-shaped string values and is also
-- accepted. Every other column in this list was re-measured the same way
-- against the real baseline and matched the single expected type already
-- recorded here -- scopes was the only divergence. A genuinely foreign type
-- (e.g. integer) on any column, scopes included, still refuses.
DO $$
DECLARE
  rec RECORD;
  actual_type TEXT;
BEGIN
  IF to_regclass('public.integrations') IS NULL THEN
    RETURN;
  END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      ('connector_id',             ARRAY['text']),
      ('name',                     ARRAY['text']),
      ('category',                 ARRAY['text']),
      ('status',                   ARRAY['text']),
      ('config',                   ARRAY['text']),
      ('capabilities',             ARRAY['text']),
      ('auth_type',                ARRAY['text']),
      ('scopes',                   ARRAY['text', 'jsonb']),
      ('field_mappings',           ARRAY['text']),
      ('sync_settings',            ARRAY['text']),
      ('sync_schedule',            ARRAY['text']),
      ('is_paused',                ARRAY['boolean']),
      ('paused_at',                ARRAY['timestamp without time zone']),
      ('workflow_policy',          ARRAY['text']),
      ('workflow_policy_reason',   ARRAY['text']),
      ('workflow_policy_set_by',   ARRAY['text']),
      ('workflow_policy_set_at',   ARRAY['timestamp with time zone']),
      ('last_sync_at',             ARRAY['timestamp without time zone']),
      ('last_error',               ARRAY['text']),
      ('created_at',               ARRAY['timestamp without time zone']),
      ('updated_at',               ARRAY['timestamp without time zone']),
      -- Not columns this migration adds or backfills into a default -- but the
      -- backfill's dynamic COALESCE below (connector_expr/name_expr) reads
      -- these two conditionally, exactly like it reads connector_id/name
      -- themselves. A wrong-typed provider_id or provider would otherwise
      -- reach that COALESCE unchecked and fail with a raw
      -- "COALESCE types ... cannot be matched" error instead of this clean
      -- refusal -- the same class of guard-ordering gap connector_id itself
      -- is already protected against above. `id` (the third unconditional
      -- COALESCE fallback) is intentionally not listed here: it is the
      -- table's TEXT PRIMARY KEY, declared identically by every producer of
      -- this table and never touched by ADD COLUMN, so its type cannot drift
      -- the way an optional legacy column's can.
      ('provider_id',              ARRAY['text']),
      ('provider',                 ARRAY['text'])
    ) AS v(col_name, expected_types)
  LOOP
    SELECT data_type INTO actual_type
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'integrations' AND column_name = rec.col_name;

    IF actual_type IS NOT NULL AND NOT (actual_type = ANY(rec.expected_types)) THEN
      RAISE EXCEPTION
        'integrations.% has incompatible type % (expected one of: %); refusing to converge onto a third, unrecognised shape',
        rec.col_name, actual_type, array_to_string(rec.expected_types, ' | ');
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  pair RECORD;
  expected_def TEXT;
  actual_def TEXT;
BEGIN
  IF to_regclass('public.integrations') IS NULL THEN
    RETURN;
  END IF;

  FOR pair IN
    SELECT * FROM (VALUES
      ('idx_integrations_org',       'organization_id'),
      ('idx_integrations_connector', 'connector_id')
    ) AS v(idx_name, idx_col)
  LOOP
    CONTINUE WHEN to_regclass('public.' || pair.idx_name) IS NULL;

    -- Canonical twin: build the index this migration WOULD create, on a
    -- throwaway pg_temp table, and let Postgres render it the same way it
    -- rendered the real one -- rather than encoding a hand-written literal as
    -- if it were the contract (that mistake cost real time on 20261019).
    EXECUTE format('CREATE TEMP TABLE m21_idx_twin (%I TEXT) ON COMMIT DROP', pair.idx_col);
    EXECUTE format('CREATE INDEX %I ON pg_temp.m21_idx_twin (%I)', pair.idx_name, pair.idx_col);

    -- The table reference is replaced only inside the "ON ... USING" clause
    -- (anchored between the literal keywords "on" and "using"), never by a
    -- blind substring replace of the table name -- both index names here
    -- happen to CONTAIN the word "integrations" (idx_integrations_org,
    -- idx_integrations_connector), and a blind replace() would mangle the
    -- index name itself, not just the table reference, producing a false
    -- mismatch between two textually-identical definitions.
    SELECT regexp_replace(
             regexp_replace(
               lower(pg_get_indexdef(i.indexrelid)),
               '\son\s+(pg_temp(_[0-9]+)?\.|public\.)?[a-z0-9_]+\s+using', ' on <tbl> using'
             ),
             '\s+', '', 'g'
           )
      INTO expected_def
      FROM pg_index i
     WHERE i.indrelid = 'pg_temp.m21_idx_twin'::regclass;

    SELECT regexp_replace(
             regexp_replace(
               lower(pg_get_indexdef(c.oid)),
               '\son\s+(pg_temp(_[0-9]+)?\.|public\.)?[a-z0-9_]+\s+using', ' on <tbl> using'
             ),
             '\s+', '', 'g'
           )
      INTO actual_def
      FROM pg_class c
     WHERE c.oid = to_regclass('public.' || pair.idx_name);

    DROP TABLE pg_temp.m21_idx_twin;

    IF actual_def IS DISTINCT FROM expected_def THEN
      RAISE EXCEPTION 'integrations index % has incompatible definition: % (expected %)',
        pair.idx_name, actual_def, expected_def;
    END IF;
  END LOOP;
END $$;

-- Column DEFAULTS -- a two-class matrix, not one rule.
--
-- SHARED/LEGACY columns already exist, with their own defaults, on the shape
-- a fresh migration-only run actually produces (256_integrations_system.sql
-- for status/sync_settings/scopes/field_mappings/config-adjacent columns;
-- 566_sync_hub_guardrails_t086_t008.sql for is_paused/paused_at;
-- 20260411_p01_workflow_policy.sql for workflow_policy and its
-- reason/set_by/set_at siblings). ADD COLUMN IF NOT EXISTS below PRESERVES
-- whichever default is already there -- that is correct post-convergence
-- state, not drift to "fix". So for these columns BOTH the canonical
-- DatabaseInitializer default and the legacy default are accepted.
--
-- CONNECTOR-EXCLUSIVE columns (connector_id, name, category, config,
-- capabilities) are never declared by any pre-convergence migration, so there
-- is only one legitimate default for each -- the canonical one this migration
-- itself is about to add. If one of these is ALREADY present with a
-- different default, that is a third, unrecognised shape and must refuse
-- before any mutation, exactly like the type and index checks above.
--
-- The comparison uses pg_get_expr(adbin, adrelid) against pg_attrdef for the
-- live column, and a canonical twin built in pg_temp for each accepted
-- candidate -- not a hardcoded rendering of the expected text. Postgres
-- canonicalises default expressions ('active' renders as 'active'::text,
-- '{}' as '{}'::text) and a hardcoded literal would encode a rendering detail
-- as if it were the contract, the same mistake the trigger-def comparison in
-- 20261019 was written to avoid.
-- UPDATE (post-review, measured against the REAL 766-migration baseline):
-- sync_schedule's live default is 'manual' -- set by
-- 566_sync_hub_guardrails_t086_t008.sql when the column is added, and
-- reasserted by 20260719_baseline_gap.sql's convergence dump. This
-- migration's own ADD COLUMN IF NOT EXISTS for sync_schedule (below) carries
-- no default at all, but that branch never actually fires in practice --
-- sync_schedule already exists with the 'manual' default on every database
-- that reaches this migration, so there is no competing "canonical" default
-- to also accept; 'manual' is the only legitimate state for an EXISTING
-- sync_schedule column. Every other column's accepted-default list below was
-- re-checked the same way against the real baseline and held; sync_schedule
-- was the only divergence.
--
-- Also: the twin used to canonicalise each candidate default is now built
-- with the column's ACTUAL measured type (via information_schema), not a
-- type this migration guessed ahead of time. A hardcoded 'TEXT' twin for
-- scopes would have rendered '[]'::text and never matched the real column's
-- '[]'::jsonb default -- same class of fixture-vs-reality mistake as the
-- type-compatibility check above, fixed the same way: measure, don't assume.
DO $$
DECLARE
  m RECORD;
  cand TEXT;
  actual_default TEXT;
  actual_col_type TEXT;
  canonical_candidate TEXT;
  matched BOOLEAN;
BEGIN
  IF to_regclass('public.integrations') IS NULL THEN
    RETURN;
  END IF;

  CREATE TEMP TABLE m21_default_matrix (col_name TEXT, accepted TEXT[]) ON COMMIT DROP;
  INSERT INTO m21_default_matrix (col_name, accepted) VALUES
    -- shared/legacy: canonical default OR the legacy default(s) below
    ('status',                  ARRAY['''pending''', '''active''']),
    ('sync_settings',           ARRAY['''{}''', '''{"direction":"bidirectional","frequency":"realtime"}''']),
    ('workflow_policy',         ARRAY['''active''']),
    ('scopes',                  ARRAY['''[]''']),
    ('field_mappings',          ARRAY['''[]''']),
    ('is_paused',               ARRAY['FALSE']),
    ('created_at',              ARRAY['CURRENT_TIMESTAMP']),
    ('updated_at',              ARRAY['CURRENT_TIMESTAMP']),
    ('sync_schedule',           ARRAY['''manual''']),
    ('auth_type',               ARRAY[]::TEXT[]),
    ('paused_at',               ARRAY[]::TEXT[]),
    ('last_sync_at',            ARRAY[]::TEXT[]),
    ('last_error',              ARRAY[]::TEXT[]),
    ('workflow_policy_reason',  ARRAY[]::TEXT[]),
    ('workflow_policy_set_by',  ARRAY[]::TEXT[]),
    ('workflow_policy_set_at',  ARRAY[]::TEXT[]),
    -- connector-exclusive: exactly one accepted shape, canonical only
    ('config',                  ARRAY['''{}''']),
    ('capabilities',            ARRAY['''[]''']),
    ('connector_id',            ARRAY[]::TEXT[]),
    ('name',                    ARRAY[]::TEXT[]),
    ('category',                ARRAY[]::TEXT[]);

  FOR m IN SELECT * FROM m21_default_matrix LOOP
    -- A column this migration is about to ADD has no pre-existing default to
    -- validate -- it gets the canonical one fresh, below.
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'integrations' AND column_name = m.col_name
    );

    SELECT data_type INTO actual_col_type
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'integrations' AND column_name = m.col_name;

    SELECT pg_get_expr(d.adbin, d.adrelid) INTO actual_default
      FROM pg_attrdef d
      JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
     WHERE d.adrelid = to_regclass('public.integrations') AND a.attname = m.col_name;

    IF array_length(m.accepted, 1) IS NULL THEN
      -- Empty accepted set: "no default at all" is the only acceptable state.
      matched := actual_default IS NULL;
    ELSE
      matched := FALSE;
      IF actual_default IS NOT NULL THEN
        FOREACH cand IN ARRAY m.accepted LOOP
          EXECUTE format('CREATE TEMP TABLE m21_default_twin (c %s DEFAULT %s) ON COMMIT DROP', actual_col_type, cand);
          SELECT pg_get_expr(d.adbin, d.adrelid) INTO canonical_candidate
            FROM pg_attrdef d
            JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
           WHERE d.adrelid = 'pg_temp.m21_default_twin'::regclass AND a.attname = 'c';
          DROP TABLE pg_temp.m21_default_twin;

          IF actual_default = canonical_candidate THEN
            matched := TRUE;
            EXIT;
          END IF;
        END LOOP;
      END IF;
    END IF;

    IF NOT matched THEN
      RAISE EXCEPTION
        'integrations.% has incompatible default % (accepted: %); refusing to converge onto an unrecognised shape',
        m.col_name, coalesce(actual_default, '<none>'), coalesce(array_to_string(m.accepted, ' | '), '<none>');
    END IF;
  END LOOP;

  DROP TABLE m21_default_matrix;
END $$;

-- ==========================================
-- CONVERGE (mirrors ensureIntegrationRuntimeTables(), Postgres branch)
-- ==========================================

-- 1) Establishes the converged shape directly when integrations does not
--    exist yet at all. No-op (IF NOT EXISTS) on both the legacy shape and the
--    already-converged shape.
CREATE TABLE IF NOT EXISTS public.integrations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  connector_id TEXT,
  name TEXT,
  category TEXT,
  status TEXT DEFAULT 'pending',
  config TEXT DEFAULT '{}',
  capabilities TEXT DEFAULT '[]',
  auth_type TEXT,
  scopes TEXT DEFAULT '[]',
  field_mappings TEXT DEFAULT '[]',
  sync_settings TEXT DEFAULT '{}',
  sync_schedule TEXT,
  is_paused BOOLEAN DEFAULT FALSE,
  paused_at TIMESTAMP,
  workflow_policy TEXT DEFAULT 'active',
  workflow_policy_reason TEXT,
  workflow_policy_set_by TEXT,
  workflow_policy_set_at TIMESTAMPTZ,
  last_sync_at TIMESTAMP,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2) Add whatever the legacy (or any older partially-converged) shape is
--    still missing. IF NOT EXISTS leaves an already-present column's type
--    and default untouched -- several of these already exist in the legacy
--    shape (auth_type, field_mappings, sync_settings, last_sync_at,
--    last_error, updated_at) with their own legacy defaults, and this must
--    not disturb them.
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS connector_id TEXT;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS config TEXT DEFAULT '{}';
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS capabilities TEXT DEFAULT '[]';
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS auth_type TEXT;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS scopes TEXT DEFAULT '[]';
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS field_mappings TEXT DEFAULT '[]';
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS sync_settings TEXT DEFAULT '{}';
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS sync_schedule TEXT;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS workflow_policy TEXT DEFAULT 'active';
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS workflow_policy_reason TEXT;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS workflow_policy_set_by TEXT;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS workflow_policy_set_at TIMESTAMPTZ;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 3) Legacy integration tables used provider_id (and, transitively,
--    auth_type) as required identity columns. V8 sync owns connector_id, so
--    old NOT NULL constraints must not block new connections. provider_id
--    does not exist at all on an already-converged/freshly-created table
--    (the CREATE TABLE above never declares it), so this is guarded rather
--    than left to error.
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.integrations ALTER COLUMN provider_id DROP NOT NULL;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;
  BEGIN
    ALTER TABLE public.integrations ALTER COLUMN auth_type DROP NOT NULL;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;
END $$;

-- 4) Backfill the V8 connector fields from earlier integration schemas
--    without referencing columns that may not exist on a given database --
--    same dynamic COALESCE the JS builds from `cols.has(...)`, reproduced in
--    SQL via a DO block that assembles and EXECUTEs the UPDATE text.
DO $$
DECLARE
  has_provider_id BOOLEAN;
  has_provider BOOLEAN;
  connector_expr TEXT;
  name_expr TEXT;
BEGIN
  IF to_regclass('public.integrations') IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'integrations' AND column_name = 'provider_id'
  ) INTO has_provider_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'integrations' AND column_name = 'provider'
  ) INTO has_provider;

  connector_expr := 'COALESCE(connector_id'
    || CASE WHEN has_provider_id THEN ', provider_id' ELSE '' END
    || CASE WHEN has_provider THEN ', provider' ELSE '' END
    || ', id)';

  name_expr := 'COALESCE(name'
    || CASE WHEN has_provider_id THEN ', provider_id' ELSE '' END
    || CASE WHEN has_provider THEN ', provider' ELSE '' END
    || ', connector_id, id)';

  -- NOTE: deliberately no `config = ...` here -- see header comment. The JS
  -- source computes a configExpr and never uses it; config is already
  -- backfilled to '{}' for every pre-existing row by the ADD COLUMN ...
  -- DEFAULT '{}' above, so mirroring the JS's omission here is correct, not
  -- an oversight.
  EXECUTE format(
    'UPDATE public.integrations SET connector_id = %s, name = %s, '
    || 'category = COALESCE(category, ''productivity''), '
    || 'status = COALESCE(status, ''pending''), '
    || 'is_paused = COALESCE(is_paused, FALSE) '
    || 'WHERE connector_id IS NULL OR name IS NULL OR category IS NULL OR config IS NULL',
    connector_expr, name_expr
  );
END $$;

-- 5) Indexes the runtime relies on for org-scoped and connector-scoped
--    lookups. idx_integrations_org already exists, with this exact
--    definition, on the legacy shape (created by 256_integrations_system.sql)
--    -- IF NOT EXISTS makes this a no-op there, and the preflight above
--    already confirmed the two definitions match before any mutation ran.
CREATE INDEX IF NOT EXISTS idx_integrations_org ON public.integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_integrations_connector ON public.integrations(connector_id);
