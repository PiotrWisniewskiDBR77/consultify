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
  check_src       text;
  fn_src          text;
  trg_count       integer;
  trg_disabled    integer;
  idx_missing     text := NULL;
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
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY (i.indkey)
     WHERE c.relname = 'partner_economics_policy_events'
       AND i.indisprimary
       AND i.indnatts = 1
       AND a.attname = 'id'
  ) THEN
    RAISE EXCEPTION
      'AMD-PRT-ECONOMICS-002 preflight: primary key is not exactly (id). Refusing before ANY mutation.';
  END IF;

  -- ---------------------------------------------------------------------
  -- CHECK semantics. A missing CHECK, a widened OR-true CHECK and a superset
  -- value list are all rejected: the receipt vocabulary must be exact.
  -- ---------------------------------------------------------------------
  FOR expected IN
    SELECT * FROM (VALUES
      ('surface',     ARRAY['v8_partner','legacy_partner','superadmin_partner_settlements','superadmin_partner_config','service']),
      ('operation',   ARRAY['commission','discount','accrual','payout','payout_settings','lifecycle_payout'])
    ) AS t(col, vals)
  LOOP
    SELECT string_agg(pg_get_constraintdef(con.oid), ' ') INTO check_src
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
     WHERE c.relname = 'partner_economics_policy_events'
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) LIKE '%' || expected.col || '%';

    IF check_src IS NULL THEN
      RAISE EXCEPTION
        'AMD-PRT-ECONOMICS-002 preflight: CHECK on % is missing; malformed receipts would be storable. Refusing before ANY mutation.',
        expected.col;
    END IF;

    -- OR-true widening (e.g. "... OR true", "OR 1=1") defeats the CHECK.
    IF check_src ~* '\mor\M\s+(true|\(?1\s*=\s*1)' THEN
      RAISE EXCEPTION
        'AMD-PRT-ECONOMICS-002 preflight: CHECK on % is widened with an OR-true term (%). Refusing before ANY mutation.',
        expected.col, check_src;
    END IF;

    -- Every canonical value must be present...
    FOR mismatch IN SELECT unnest(expected.vals) LOOP
      IF position(quote_literal(mismatch) in check_src) = 0 THEN
        RAISE EXCEPTION
          'AMD-PRT-ECONOMICS-002 preflight: CHECK on % does not admit canonical value %. Refusing before ANY mutation.',
          expected.col, mismatch;
      END IF;
    END LOOP;

    -- ...and the count of quoted literals must not exceed the canonical set,
    -- which rejects a superset that admits extra values.
    IF (length(check_src) - length(replace(check_src, '''', ''))) / 2
       > array_length(expected.vals, 1) THEN
      RAISE EXCEPTION
        'AMD-PRT-ECONOMICS-002 preflight: CHECK on % admits a SUPERSET of the canonical values (%). Refusing before ANY mutation.',
        expected.col, check_src;
    END IF;
  END LOOP;

  -- Pinned-literal CHECKs on decision / denial_code.
  FOR expected IN
    SELECT * FROM (VALUES
      ('decision',    'AMD-PRT-ECONOMICS-002'),
      ('denial_code', 'PARTNER_ECONOMICS_POLICY_DISABLED')
    ) AS t(col, val)
  LOOP
    SELECT string_agg(pg_get_constraintdef(con.oid), ' ') INTO check_src
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
     WHERE c.relname = 'partner_economics_policy_events'
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) LIKE '%' || expected.col || '%';

    IF check_src IS NULL OR position(quote_literal(expected.val) in check_src) = 0 THEN
      RAISE EXCEPTION
        'AMD-PRT-ECONOMICS-002 preflight: CHECK pinning % to % is missing or altered. Refusing before ANY mutation.',
        expected.col, expected.val;
    END IF;
  END LOOP;

  -- Idempotency identity must be UNIQUE, otherwise a replay stores a duplicate.
  IF NOT EXISTS (
    SELECT 1
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY (i.indkey)
     WHERE c.relname = 'partner_economics_policy_events'
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
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = mismatch AND relkind = 'i') THEN
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
