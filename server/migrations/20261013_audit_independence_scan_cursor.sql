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
DO $migration$
DECLARE
  v_relid              oid;
  v_pk_columns         text[];
  v_missing_columns    text[];
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

  -- Column-type divergence on the columns that carry meaning is likewise not
  -- auto-repairable: widening/narrowing a populated fence or cursor column is
  -- a data decision, not a schema detail.
  IF EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = v_relid AND attname = 'lease_fence' AND NOT attisdropped
       AND atttypid <> 'bigint'::regtype
  ) THEN
    RAISE EXCEPTION
      'AUD13_FENCE_TYPE_MISMATCH: audit_independence_scan_cursor.lease_fence exists with a non-bigint type; refusing to converge. No changes were applied.'
      USING ERRCODE = 'invalid_table_definition';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = v_relid AND attname = 'last_program_id' AND NOT attisdropped
       AND atttypid <> 'text'::regtype
  ) THEN
    RAISE EXCEPTION
      'AUD13_CURSOR_TYPE_MISMATCH: audit_independence_scan_cursor.last_program_id exists with a non-text type; refusing to converge. No changes were applied.'
      USING ERRCODE = 'invalid_table_definition';
  END IF;

  -- ---------------------------------------------------------------------
  -- Converge: add only what is missing. Existing rows keep their cursor,
  -- fence and progress; new columns arrive with the same defaults a clean
  -- install would have given them, so a historical row stays valid.
  -- ---------------------------------------------------------------------
  SELECT array_agg(expected)
    INTO v_missing_columns
    FROM unnest(v_expected_columns) AS expected
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_attribute
      WHERE attrelid = v_relid AND attname = expected AND NOT attisdropped
   );

  IF v_missing_columns IS NOT NULL THEN
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
