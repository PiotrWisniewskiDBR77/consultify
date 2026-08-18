-- AMD-PRT-ECONOMICS-002 (owner decision 2A)
-- Durable, immutable, tenant-bound, IDEMPOTENT telemetry for Partner
-- economic-policy denials.
--
-- WHY A SEPARATE TABLE AND NOT partner_legacy_usage_events.
-- That table's CHECK admits only legacy_read / legacy_uncovered_writer /
-- legacy_writer_blocked / rollback_writer. Recording a policy denial as
-- 'legacy_writer_blocked' would conflate "this writer moved to V8" with
-- "this operation is excluded by owner policy", and would corrupt the cutover
-- parity telemetry PRT-MVP-LEGACY-CUTOVER-001 depends on.
--
-- STRUCTURE: CATALOG-ONLY PREFLIGHT BEFORE ANY MUTATION.
-- An earlier revision of this migration created indexes and replaced the shared
-- trigger function BEFORE validating the table shape. On a database where a
-- partial, wrong, OR-true or superset version of this table already existed
-- (a "late" table), that ordering mutated the database first and only then
-- discovered the shape was wrong — leaving a half-converged schema behind. The
-- whole migration is therefore now: (1) a read-only catalog audit that raises
-- before touching anything, (2) mutation only on a database that is either
-- clean or already exactly correct.
--
-- NO FOREIGN KEYS BY DELIBERATE CHOICE. An append-only trigger plus an
-- ON DELETE CASCADE foreign key makes the PARENT row undeletable: the cascade
-- issues a DELETE against this table, the trigger refuses it, and the parent
-- delete fails.

-- =============================================================================
-- PHASE 1 — CATALOG-ONLY PREFLIGHT. Reads pg_catalog / information_schema only.
-- Raises before any DDL. Never writes.
-- =============================================================================
DO $preflight$
DECLARE
  tbl_exists      boolean;
  col             record;
  expected        record;
  mismatch        text := NULL;
  fn_src          text;
  trg_count       integer;
  trg_disabled    integer;
  idx_missing     text := NULL;
  col_attnum      smallint;
  con_count       integer;
  actual_def      text;
  actual_norm     text;
  canonical_norm  text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname = 'partner_economics_policy_events'
       AND c.relkind = 'r'
       AND n.nspname = current_schema()
  ) INTO tbl_exists;

  IF NOT tbl_exists THEN
    -- Clean database. Phase 2 creates the canonical shape. Nothing to validate.
    RETURN;
  END IF;

  -- ---------------------------------------------------------------------
  -- The table pre-exists. It must match EXACTLY, or we refuse before any
  -- mutation. Partial, wrong-typed, superset and OR-true variants all fail.
  -- ---------------------------------------------------------------------
  FOR expected IN
    SELECT * FROM (VALUES
      ('id',                 'uuid',                        'NO' ),
      ('request_id',         'text',                        'YES'),
      ('user_id',            'text',                        'YES'),
      ('organization_id',    'text',                        'YES'),
      ('partner_org_id',     'text',                        'YES'),
      ('method',             'text',                        'NO' ),
      ('route_path',         'text',                        'NO' ),
      ('surface',            'text',                        'NO' ),
      ('operation',          'text',                        'NO' ),
      ('decision',           'text',                        'NO' ),
      ('denial_code',        'text',                        'NO' ),
      ('receipt_identity',   'text',                        'NO' ),
      ('request_fingerprint','text',                        'NO' ),
      ('observed_at',        'timestamp with time zone',    'NO' )
    ) AS t(column_name, data_type, is_nullable)
  LOOP
    SELECT c.data_type, c.is_nullable INTO col
      FROM information_schema.columns c
     WHERE c.table_name = 'partner_economics_policy_events'
       AND c.table_schema = current_schema()
       AND c.column_name = expected.column_name;

    IF NOT FOUND THEN
      mismatch := format('missing column %I', expected.column_name);
    ELSIF col.data_type <> expected.data_type THEN
      mismatch := format('column %I has type %s, expected %s',
                         expected.column_name, col.data_type, expected.data_type);
    ELSIF col.is_nullable <> expected.is_nullable THEN
      mismatch := format('column %I nullability %s, expected %s',
                         expected.column_name, col.is_nullable, expected.is_nullable);
    END IF;

    IF mismatch IS NOT NULL THEN
      RAISE EXCEPTION
        'AMD-PRT-ECONOMICS-002 preflight: partner_economics_policy_events exists with a non-canonical shape (%). Refusing before ANY mutation so the database is left byte-identical.',
        mismatch;
    END IF;
  END LOOP;

  -- SUPERSET rejection: an extra column means this is not our table.
  SELECT string_agg(c.column_name, ', ') INTO mismatch
    FROM information_schema.columns c
   WHERE c.table_name = 'partner_economics_policy_events'
     AND c.table_schema = current_schema()
     AND c.column_name NOT IN (
       'id','request_id','user_id','organization_id','partner_org_id','method',
       'route_path','surface','operation','decision','denial_code',
       'receipt_identity','request_fingerprint','observed_at');
  IF mismatch IS NOT NULL THEN
    RAISE EXCEPTION
      'AMD-PRT-ECONOMICS-002 preflight: partner_economics_policy_events has unexpected extra column(s) (%). Refusing before ANY mutation.',
      mismatch;
  END IF;

  -- Primary key must be exactly (id).
  IF NOT EXISTS (
    SELECT 1
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY (i.indkey)
     WHERE c.relname = 'partner_economics_policy_events'
       AND n.nspname = current_schema()
       AND i.indisprimary
       AND i.indnatts = 1
       AND a.attname = 'id'
  ) THEN
    RAISE EXCEPTION
      'AMD-PRT-ECONOMICS-002 preflight: primary key is not exactly (id). Refusing before ANY mutation.';
  END IF;

  -- ---------------------------------------------------------------------
  -- CHECK semantics, EXACT. For each target column we locate the single
  -- CHECK constraint that genuinely constrains it -- found by joining
  -- pg_constraint.conkey against that column's own attnum, NEVER by matching
  -- a constraint's definition TEXT against the column name -- and then
  -- compare pg_get_constraintdef(oid), whitespace-normalized, against the
  -- exact canonical definition string PostgreSQL itself produces for the
  -- CREATE TABLE in Phase 2 below.
  --
  -- PostgreSQL rewrites `col IN (v1, v2, ...)` into
  -- `col = ANY (ARRAY[v1::text, v2::text, ...])` at parse time, and that is
  -- the only string pg_get_constraintdef ever emits for it: ruleutils.c
  -- prints "= ANY (ARRAY[" from a fixed C string constant, not from the
  -- original source text, so that keyword casing cannot vary with the
  -- author's formatting or across PostgreSQL versions -- only the RUN
  -- LENGTH of whitespace can, and the normalizer below collapses that.
  -- A tautology widening (OR TRUE, OR 2=2, OR ('a'='a'),
  -- OR <col> IS NOT NULL, or any other spelling), a superset value, a
  -- subset value, a wrong type, or any other rewrite of the expression
  -- parses to a different tree and therefore deparses to a different
  -- pg_get_constraintdef string -- so every one of them fails this
  -- comparison automatically. No per-spelling detection logic is needed or
  -- present.
  --
  -- Literal string content (the actual enum values) is compared verbatim
  -- and case-sensitively, matching PostgreSQL's own `=` runtime semantics.
  -- Only whitespace is normalized here, deliberately never letter case:
  -- folding the whole string's case would let e.g. a CHECK admitting
  -- 'V8_Partner' pass as equal to the canonical 'v8_partner', even though
  -- PostgreSQL's text equality treats those as different values and the
  -- application would still be rejected at runtime.
  -- ---------------------------------------------------------------------
  FOR expected IN
    SELECT * FROM (VALUES
      ('surface',
       'CHECK ((surface = ANY (ARRAY[''v8_partner''::text, ''legacy_partner''::text, ''superadmin_partner_settlements''::text, ''superadmin_partner_config''::text, ''service''::text])))'),
      ('operation',
       'CHECK ((operation = ANY (ARRAY[''commission''::text, ''discount''::text, ''accrual''::text, ''payout''::text, ''payout_settings''::text, ''lifecycle_payout''::text])))'),
      ('decision',
       'CHECK ((decision = ''AMD-PRT-ECONOMICS-002''::text))'),
      ('denial_code',
       'CHECK ((denial_code = ''PARTNER_ECONOMICS_POLICY_DISABLED''::text))')
    ) AS t(col, canonical_def)
  LOOP
    SELECT a.attnum INTO col_attnum
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname = 'partner_economics_policy_events'
       AND n.nspname = current_schema()
       AND a.attname = expected.col
       AND NOT a.attisdropped;

    -- The column-shape loop above already proved this column exists with
    -- the canonical type, so col_attnum is always found at this point.

    SELECT count(*) INTO con_count
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname = 'partner_economics_policy_events'
       AND n.nspname = current_schema()
       AND con.contype = 'c'
       AND con.conkey = ARRAY[col_attnum]::smallint[];

    IF con_count = 0 THEN
      RAISE EXCEPTION
        'AMD-PRT-ECONOMICS-002 preflight: no single-column CHECK constrains %; malformed receipts would be storable. Refusing before ANY mutation.',
        expected.col;
    ELSIF con_count > 1 THEN
      RAISE EXCEPTION
        'AMD-PRT-ECONOMICS-002 preflight: % single-column CHECK constraint(s) found on %, expected exactly 1. Refusing before ANY mutation.',
        con_count, expected.col;
    END IF;

    SELECT pg_get_constraintdef(con.oid) INTO actual_def
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname = 'partner_economics_policy_events'
       AND n.nspname = current_schema()
       AND con.contype = 'c'
       AND con.conkey = ARRAY[col_attnum]::smallint[];

    actual_norm    := btrim(regexp_replace(actual_def, '\s+', ' ', 'g'));
    canonical_norm := btrim(regexp_replace(expected.canonical_def, '\s+', ' ', 'g'));

    IF actual_norm <> canonical_norm THEN
      RAISE EXCEPTION
        'AMD-PRT-ECONOMICS-002 preflight: CHECK on % is not byte-exact canonical. Found: [%]  Expected: [%]. Refusing before ANY mutation.',
        expected.col, actual_norm, canonical_norm;
    END IF;
  END LOOP;

  -- Idempotency identity must be UNIQUE, otherwise a replay stores a duplicate.
  IF NOT EXISTS (
    SELECT 1
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY (i.indkey)
     WHERE c.relname = 'partner_economics_policy_events'
       AND n.nspname = current_schema()
       AND i.indisunique
       AND i.indnatts = 1
       AND a.attname = 'receipt_identity'
  ) THEN
    RAISE EXCEPTION
      'AMD-PRT-ECONOMICS-002 preflight: receipt_identity lacks a UNIQUE index; replayed denials would duplicate. Refusing before ANY mutation.';
  END IF;

  -- Append-only function body must actually raise.
  SELECT prosrc INTO fn_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE p.proname = 'partner_economics_policy_events_deny_mutation'
     AND n.nspname = 'public';
  IF fn_src IS NULL OR fn_src !~* 'RAISE\s+EXCEPTION' THEN
    RAISE EXCEPTION
      'AMD-PRT-ECONOMICS-002 preflight: append-only function is absent or does not raise. Refusing before ANY mutation.';
  END IF;

  -- Exact trigger identities, both enabled ('O' = enabled, origin).
  SELECT count(*), count(*) FILTER (WHERE t.tgenabled <> 'O')
    INTO trg_count, trg_disabled
    FROM pg_trigger t
   WHERE t.tgrelid = 'partner_economics_policy_events'::regclass
     AND NOT t.tgisinternal
     AND t.tgname IN (
       'trg_partner_economics_policy_events_no_update',
       'trg_partner_economics_policy_events_no_delete');
  IF trg_count <> 2 THEN
    RAISE EXCEPTION
      'AMD-PRT-ECONOMICS-002 preflight: expected exactly 2 named append-only triggers, found %. Refusing before ANY mutation.',
      trg_count;
  END IF;
  IF trg_disabled > 0 THEN
    RAISE EXCEPTION
      'AMD-PRT-ECONOMICS-002 preflight: % append-only trigger(s) are not enabled (tgenabled <> O). Refusing before ANY mutation.',
      trg_disabled;
  END IF;

  -- Supporting indexes.
  FOR mismatch IN
    SELECT unnest(ARRAY[
      'idx_partner_economics_policy_observed',
      'idx_partner_economics_policy_operation',
      'idx_partner_economics_policy_org'])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c2
        JOIN pg_namespace n2 ON n2.oid = c2.relnamespace
       WHERE c2.relname = mismatch AND c2.relkind = 'i'
         AND n2.nspname = current_schema()
    ) THEN
      idx_missing := coalesce(idx_missing || ', ', '') || mismatch;
    END IF;
  END LOOP;
  IF idx_missing IS NOT NULL THEN
    RAISE EXCEPTION
      'AMD-PRT-ECONOMICS-002 preflight: missing index(es) %. Refusing before ANY mutation.',
      idx_missing;
  END IF;

  -- Already exactly canonical. Phase 2 is a no-op on this database.
END
$preflight$;

-- =============================================================================
-- PHASE 2 — MUTATION. Only reached on a database that preflight proved is
-- either clean or already exactly canonical. Every statement is idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_economics_policy_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT,
    user_id TEXT,
    -- Tenant binding. Nullable because a denial must still be recorded when the
    -- caller never resolved a tenant. See the honesty note in
    -- partnerEconomicsPolicy.ts: on /api/v8/partner the refusal is deliberately
    -- ahead of partner-org resolution, so partner_org_id is NULL there and this
    -- table is NOT evidence of ACTIVE membership.
    organization_id TEXT,
    partner_org_id TEXT,
    method TEXT NOT NULL,
    route_path TEXT NOT NULL,
    surface TEXT NOT NULL CHECK (surface IN (
      'v8_partner',
      'legacy_partner',
      'superadmin_partner_settlements',
      'superadmin_partner_config',
      'service'
    )),
    operation TEXT NOT NULL CHECK (operation IN (
      'commission',
      'discount',
      'accrual',
      'payout',
      'payout_settings',
      'lifecycle_payout'
    )),
    decision TEXT NOT NULL CHECK (decision = 'AMD-PRT-ECONOMICS-002'),
    denial_code TEXT NOT NULL CHECK (denial_code = 'PARTNER_ECONOMICS_POLICY_DISABLED'),
    -- Deterministic, tenant-bound replay identity. Computed by the service from
    -- request_id + surface + operation + method + route_path + organization_id
    -- + user_id. UNIQUE, so a replayed request yields exactly one receipt and
    -- an altered request with a colliding identity fails closed instead of
    -- silently overwriting evidence.
    receipt_identity TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_economics_policy_fingerprint
  ON partner_economics_policy_events(receipt_identity);
CREATE INDEX IF NOT EXISTS idx_partner_economics_policy_observed
  ON partner_economics_policy_events(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_economics_policy_operation
  ON partner_economics_policy_events(operation, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_economics_policy_org
  ON partner_economics_policy_events(organization_id, observed_at DESC);

-- Append-only at the DATABASE level, not by service discipline. There is
-- deliberately NO GUC / SET LOCAL escape hatch: a session variable a caller can
-- set is not an authorization boundary, since anything able to run the UPDATE
-- can also run the SET LOCAL. Corrections are new rows.
CREATE OR REPLACE FUNCTION public.partner_economics_policy_events_deny_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'partner_economics_policy_events is append-only under AMD-PRT-ECONOMICS-002; % not permitted (row %) -- a policy-denial receipt is evidence, corrections must be new rows',
    TG_OP, COALESCE(OLD.id, NEW.id);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_partner_economics_policy_events_no_update
  ON partner_economics_policy_events;
CREATE TRIGGER trg_partner_economics_policy_events_no_update
  BEFORE UPDATE ON partner_economics_policy_events
  FOR EACH ROW EXECUTE FUNCTION public.partner_economics_policy_events_deny_mutation();

DROP TRIGGER IF EXISTS trg_partner_economics_policy_events_no_delete
  ON partner_economics_policy_events;
CREATE TRIGGER trg_partner_economics_policy_events_no_delete
  BEFORE DELETE ON partner_economics_policy_events
  FOR EACH ROW EXECUTE FUNCTION public.partner_economics_policy_events_deny_mutation();

-- =============================================================================
-- PHASE 3 — POST-CONDITION. Refuse to report success on a database where the
-- protection provably protects nothing.
-- =============================================================================
DO $post$
DECLARE
  trg_ok integer;
  uq_ok  integer;
BEGIN
  SELECT count(*) INTO trg_ok
    FROM pg_trigger
   WHERE tgrelid = 'partner_economics_policy_events'::regclass
     AND NOT tgisinternal
     AND tgenabled = 'O';
  IF trg_ok < 2 THEN
    RAISE EXCEPTION 'AMD-PRT-ECONOMICS-002: append-only triggers missing or disabled after migration (found %)', trg_ok;
  END IF;

  SELECT count(*) INTO uq_ok
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY (i.indkey)
   WHERE c.relname = 'partner_economics_policy_events'
     AND i.indisunique
     AND a.attname = 'receipt_identity';
  IF uq_ok < 1 THEN
    RAISE EXCEPTION 'AMD-PRT-ECONOMICS-002: receipt_identity UNIQUE index missing after migration';
  END IF;
END
$post$;
