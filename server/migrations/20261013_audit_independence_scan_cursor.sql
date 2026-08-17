-- AUD-POL-001 / AMD-AUD-RIGHTS-001: durable checkpoint + fenced lease for the
-- audit independence detector sweep.
--
-- Why a cursor at all: the detector must eventually visit EVERY audit_programs
-- row. A "newest-updated, top N" query can never do that — once the table
-- exceeds N, rows outside the freshest window are starved permanently, which
-- is a systematic defect, not an edge case. Ordering by `id` (a stable primary
-- key that is never rewritten) gives every row a fixed, permanent position in
-- a cycle that always completes and then wraps.
--
-- Why a FENCED lease: `leased_until` alone prevents two workers from claiming
-- concurrently, but it does NOT stop a stalled worker whose lease has since
-- expired (and been taken over) from later writing its stale progress and
-- rewinding or skipping the cursor. `lease_fence` is a monotonically
-- increasing token: a claim increments it and the claimant remembers the
-- value; every progress write is conditioned on the fence still matching, so
-- a superseded worker's write matches zero rows and is discarded.
--
-- This table holds one global row: the sweep walks audit_programs across all
-- organizations, so the checkpoint is not per-tenant. It carries no policy and
-- no tenant data — only scan position and lease bookkeeping.
--
-- LATE-APPLY SAFETY
-- -----------------
-- A bare `CREATE TABLE IF NOT EXISTS` is NOT late-safe: on an environment where
-- a partial or divergent version of this table already exists (an earlier hand
-- -rolled attempt, a restored snapshot, a half-applied run), it silently does
-- nothing and leaves the application reading a table without `lease_fence` —
-- the fencing guarantee would be quietly absent rather than loudly missing.
--
-- So this migration inspects what is actually there and then either
-- CONVERGES (adding only what is missing, preserving every existing cursor,
-- fence and progress value) or FAILS CLOSED with an explicit code, before
-- performing any mutation. Structural checks resolve by `conrelid`/`regclass`,
-- never by constraint name alone: a same-named constraint on a different table
-- must not be accepted as proof about this one.
--
-- PREFLIGHT
-- The full expected shape — every column, its type, its nullability and its
-- default — is verified BEFORE the first mutation. A divergence anywhere in
-- that set aborts the whole DO block, so a rejected environment is left exactly
-- as it was rather than half-converged. Adding columns only happens after the
-- entire preflight has passed.
DO $migration$
DECLARE
  v_relid              oid;
  v_pk_columns         text[];
  v_missing_columns    text[] := ARRAY[]::text[];
  v_spec               RECORD;
  v_actual             RECORD;
  v_expected_columns   text[] := ARRAY[
    'id', 'last_program_id', 'cycles_completed', 'lease_fence',
    'leased_by', 'leased_until', 'last_tick_at', 'updated_at'
  ];
BEGIN
  v_relid := to_regclass('public.audit_independence_scan_cursor');

  IF v_relid IS NULL THEN
    -- Clean install: create the table in its final shape.
    CREATE TABLE public.audit_independence_scan_cursor (
      id TEXT PRIMARY KEY DEFAULT 'global',
      last_program_id TEXT NOT NULL DEFAULT '',
      cycles_completed BIGINT NOT NULL DEFAULT 0,
      lease_fence BIGINT NOT NULL DEFAULT 0,
      leased_by TEXT,
      leased_until TIMESTAMPTZ,
      last_tick_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    RETURN;
  END IF;

  -- ---------------------------------------------------------------------
  -- The table pre-exists. Verify the parts that CANNOT be repaired safely
  -- BEFORE mutating anything, so a rejected environment is left untouched.
  -- ---------------------------------------------------------------------

  -- Primary key, resolved for THIS relation and in ordinal order. A cursor
  -- keyed by anything other than exactly (id) would make the singleton row
  -- ambiguous, and silently "fixing" a primary key on populated data is not
  -- something a migration should decide on its own.
  SELECT array_agg(a.attname ORDER BY k.ord)
    INTO v_pk_columns
    FROM pg_constraint c
    JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON TRUE
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
   WHERE c.conrelid = v_relid
     AND c.contype = 'p';

  IF v_pk_columns IS NULL THEN
    RAISE EXCEPTION
      'AUD13_PK_MISSING: audit_independence_scan_cursor exists without a primary key; refusing to converge (expected exactly (id)). No changes were applied.'
      USING ERRCODE = 'invalid_table_definition';
  END IF;

  IF v_pk_columns <> ARRAY['id'] THEN
    RAISE EXCEPTION
      'AUD13_PK_MISMATCH: audit_independence_scan_cursor primary key is (%), expected exactly (id); refusing to converge. No changes were applied.',
      array_to_string(v_pk_columns, ', ')
      USING ERRCODE = 'invalid_table_definition';
  END IF;

  -- Full per-column preflight: type, nullability and default for ALL EIGHT
  -- columns. A column that is absent is recorded for convergence; a column that
  -- is PRESENT but shaped differently aborts, because silently re-typing,
  -- re-nulling or re-defaulting a populated column is a data decision a
  -- migration may not take on its own. Every check runs before any ALTER.
  FOR v_spec IN
    SELECT *
      FROM (VALUES
        -- Defaults are compared against pg_get_expr() output. They are built
        -- with quote_literal() rather than hand-escaped, so the expectation
        -- cannot drift from what Postgres actually renders.
        ('id',               'text',        TRUE,  quote_literal('global') || '::text'),
        ('last_program_id',  'text',        TRUE,  quote_literal('')       || '::text'),
        ('cycles_completed', 'bigint',      TRUE,  '0'),
        ('lease_fence',      'bigint',      TRUE,  '0'),
        ('leased_by',        'text',        FALSE, NULL),
        ('leased_until',     'timestamptz', FALSE, NULL),
        ('last_tick_at',     'timestamptz', FALSE, NULL),
        ('updated_at',       'timestamptz', TRUE,  'now()')
      ) AS s(col, expected_type, expected_notnull, expected_default)
  LOOP
    SELECT a.attname,
           a.atttypid                    AS actual_typid,
           format_type(a.atttypid, NULL) AS actual_type,
           a.attnotnull                  AS actual_notnull,
           pg_get_expr(d.adbin, d.adrelid) AS actual_default
      INTO v_actual
      FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE a.attrelid = v_relid AND a.attname = v_spec.col AND NOT a.attisdropped;

    IF NOT FOUND THEN
      v_missing_columns := v_missing_columns || v_spec.col;
      CONTINUE;
    END IF;

    -- Compare by regtype OID, not by rendered name: `timestamptz` and
    -- `timestamp with time zone` are the same type, and a string comparison
    -- would reject the migration's own output.
    IF v_actual.actual_typid <> v_spec.expected_type::regtype THEN
      RAISE EXCEPTION
        'AUD13_COLUMN_TYPE_MISMATCH: audit_independence_scan_cursor.% has type % but % is required; refusing to converge. No changes were applied.',
        v_spec.col, v_actual.actual_type, v_spec.expected_type
        USING ERRCODE = 'invalid_table_definition';
    END IF;

    IF v_actual.actual_notnull <> v_spec.expected_notnull THEN
      RAISE EXCEPTION
        'AUD13_COLUMN_NULLABILITY_MISMATCH: audit_independence_scan_cursor.% is %, expected %; refusing to converge. No changes were applied.',
        v_spec.col,
        CASE WHEN v_actual.actual_notnull THEN 'NOT NULL' ELSE 'NULLABLE' END,
        CASE WHEN v_spec.expected_notnull THEN 'NOT NULL' ELSE 'NULLABLE' END
        USING ERRCODE = 'invalid_table_definition';
    END IF;

    IF v_spec.expected_default IS NULL THEN
      IF v_actual.actual_default IS NOT NULL THEN
        RAISE EXCEPTION
          'AUD13_COLUMN_DEFAULT_MISMATCH: audit_independence_scan_cursor.% has default % but must have none; refusing to converge. No changes were applied.',
          v_spec.col, v_actual.actual_default
          USING ERRCODE = 'invalid_table_definition';
      END IF;
    ELSIF v_actual.actual_default IS DISTINCT FROM v_spec.expected_default THEN
      RAISE EXCEPTION
        'AUD13_COLUMN_DEFAULT_MISMATCH: audit_independence_scan_cursor.% has default % but % is required; refusing to converge. No changes were applied.',
        v_spec.col, coalesce(v_actual.actual_default, '<none>'), v_spec.expected_default
        USING ERRCODE = 'invalid_table_definition';
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------------
  -- Converge: add only what is missing. Existing rows keep their cursor,
  -- fence and progress; new columns arrive with the same defaults a clean
  -- install would have given them, so a historical row stays valid.
  -- ---------------------------------------------------------------------
  IF array_length(v_missing_columns, 1) IS NOT NULL THEN
    IF 'id' = ANY(v_missing_columns) THEN
      RAISE EXCEPTION
        'AUD13_ID_COLUMN_MISSING: audit_independence_scan_cursor exists without an id column; refusing to converge. No changes were applied.'
        USING ERRCODE = 'invalid_table_definition';
    END IF;

    ALTER TABLE public.audit_independence_scan_cursor
      ADD COLUMN IF NOT EXISTS last_program_id  TEXT        NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS cycles_completed BIGINT      NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS lease_fence      BIGINT      NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS leased_by        TEXT,
      ADD COLUMN IF NOT EXISTS leased_until     TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_tick_at     TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END
$migration$;
