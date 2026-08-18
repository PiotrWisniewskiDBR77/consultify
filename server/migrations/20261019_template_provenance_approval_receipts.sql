-- MAT-POL / AMD-MAT-PROVENANCE-WRITER-002 (owner decision 3B): durable, append-only
-- receipt for a governed template-provenance approval.
--
-- Provenance approval is an attestation of rights, so it is recorded, not merely
-- performed. The receipt carries the tenant, the deciding human, that human's
-- tenant role at decision time, the exact registry/template it speaks for, the
-- provenance version and a fingerprint of the exact request that was approved.
--
-- The table is fully append-only: unlike the upload receipt in 20261016 there is
-- no legal state transition at all. An approval is terminal on write. Nothing in
-- this migration approves anything -- it creates the ledger a governed writer
-- must fill, and it fabricates no rights for any existing template.

DO $$
DECLARE
  actual_columns TEXT;
  actual_pk TEXT;
  actual_fks TEXT;
  actual_unique TEXT;
  actual_trigger TEXT;
  expected_trigger TEXT;
  actual_definition TEXT;
  expected_definition TEXT;
  check_pair TEXT[];
  check_pairs TEXT[][] := ARRAY[
    ['ck_template_provenance_receipt_key',         'm19_expected_key'],
    ['ck_template_provenance_receipt_fingerprint', 'm19_expected_fingerprint'],
    ['ck_template_provenance_receipt_registry',    'm19_expected_registry'],
    ['ck_template_provenance_receipt_role',        'm19_expected_role'],
    ['ck_template_provenance_receipt_actor',       'm19_expected_actor'],
    ['ck_template_provenance_receipt_template',    'm19_expected_template'],
    ['ck_template_provenance_receipt_version',     'm19_expected_version'],
    ['ck_template_provenance_receipt_evidence',    'm19_expected_evidence']
  ];
BEGIN
  IF to_regclass('template_provenance_approval_receipts') IS NULL THEN
    RETURN;
  END IF;

  SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable || ':' ||
                    coalesce(lower(regexp_replace(column_default, '[[:space:]()]|::[a-z ]+', '', 'g')), '<null>'),
                    ',' ORDER BY ordinal_position)
    INTO actual_columns
    FROM information_schema.columns
   WHERE table_name = 'template_provenance_approval_receipts'
     AND table_schema = (SELECT nspname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                          WHERE c.oid = to_regclass('template_provenance_approval_receipts'));
  IF actual_columns <> 'organization_id:text:NO:<null>,idempotency_key:text:NO:<null>,registry:text:NO:<null>,template_id:text:NO:<null>,request_fingerprint:text:NO:<null>,provenance_version:text:NO:<null>,approved_by:text:NO:<null>,approved_by_role:text:NO:<null>,provenance_json:jsonb:NO:<null>,created_at:timestamp with time zone:NO:current_timestamp' THEN
    RAISE EXCEPTION 'template_provenance_approval_receipts has incompatible columns: %', actual_columns;
  END IF;

  SELECT string_agg(lower(regexp_replace(pg_get_constraintdef(c.oid), '[[:space:]()]', '', 'g')), ',' ORDER BY a.attname)
    INTO actual_fks
    FROM pg_constraint c
    JOIN unnest(c.conkey) WITH ORDINALITY k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum
   WHERE c.conrelid = to_regclass('template_provenance_approval_receipts') AND c.contype='f';
  IF actual_fks IS NULL OR actual_fks <> 'foreignkeyorganization_idreferencesorganizationsidondeleterestrict' THEN
    RAISE EXCEPTION 'template_provenance_approval_receipts has incompatible foreign keys: %', actual_fks;
  END IF;

  SELECT lower(regexp_replace(pg_get_constraintdef(oid), '[[:space:]]', '', 'g')) INTO actual_pk
    FROM pg_constraint WHERE conrelid = to_regclass('template_provenance_approval_receipts') AND contype='p';
  IF actual_pk IS DISTINCT FROM 'primarykey(organization_id,idempotency_key)' THEN
    RAISE EXCEPTION 'template_provenance_approval_receipts has incompatible primary key: %', actual_pk;
  END IF;

  -- One approval per registry target. A second actor must not be able to
  -- re-attest rights over an already approved template under a fresh key.
  SELECT lower(regexp_replace(pg_get_constraintdef(oid), '[[:space:]]', '', 'g')) INTO actual_unique
    FROM pg_constraint WHERE conrelid = to_regclass('template_provenance_approval_receipts')
     AND conname = 'uq_template_provenance_receipt_target';
  IF actual_unique IS DISTINCT FROM 'unique(organization_id,registry,template_id)' THEN
    RAISE EXCEPTION 'template_provenance_approval_receipts has incompatible target uniqueness: %', actual_unique;
  END IF;

  -- EXACT semantics for ALL EIGHT named CHECKs, not a subset and not substring
  -- presence. Postgres renders a canonical twin and both sides are compared, so
  -- a missing, nullable, OR-TRUE or superset CHECK cannot pass. Same technique
  -- as m17 (20261017_material_export_policy_provenance.sql:96-121).
  CREATE TEMP TABLE m19_expected_checks (
    idempotency_key TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL,
    registry TEXT NOT NULL,
    approved_by_role TEXT NOT NULL,
    approved_by TEXT NOT NULL,
    template_id TEXT NOT NULL,
    provenance_version TEXT NOT NULL,
    provenance_json JSONB NOT NULL,
    CONSTRAINT m19_expected_key CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 200),
    CONSTRAINT m19_expected_fingerprint CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT m19_expected_registry CHECK (
      registry IN ('document_studio_templates', 'presentation_templates', 'tp_base_templates')
    ),
    CONSTRAINT m19_expected_role CHECK (approved_by_role IN ('OWNER', 'ADMIN')),
    CONSTRAINT m19_expected_actor CHECK (length(btrim(approved_by)) BETWEEN 1 AND 200),
    CONSTRAINT m19_expected_template CHECK (length(btrim(template_id)) BETWEEN 1 AND 200),
    CONSTRAINT m19_expected_version CHECK (length(btrim(provenance_version)) BETWEEN 1 AND 200),
    CONSTRAINT m19_expected_evidence CHECK (
      jsonb_typeof(provenance_json) = 'object'
      AND length(btrim(provenance_json->>'source')) BETWEEN 1 AND 2000
      AND length(btrim(provenance_json->>'licenseBasis')) BETWEEN 1 AND 2000
      AND length(btrim(provenance_json->>'authority')) BETWEEN 1 AND 2000
      AND length(btrim(provenance_json->>'actor')) BETWEEN 1 AND 200
      AND length(btrim(provenance_json->>'version')) BETWEEN 1 AND 200
      AND length(btrim(provenance_json->>'evidence')) BETWEEN 1 AND 2000
    )
  ) ON COMMIT DROP;

  FOREACH check_pair SLICE 1 IN ARRAY check_pairs LOOP
    SELECT regexp_replace(lower(pg_get_constraintdef(oid)), '\s+', '', 'g') INTO expected_definition
      FROM pg_constraint WHERE conrelid='pg_temp.m19_expected_checks'::regclass AND conname=check_pair[2];
    SELECT regexp_replace(lower(pg_get_constraintdef(oid)), '\s+', '', 'g') INTO actual_definition
      FROM pg_constraint WHERE conrelid=to_regclass('template_provenance_approval_receipts')
       AND conname=check_pair[1];
    IF actual_definition IS NULL OR actual_definition IS DISTINCT FROM expected_definition THEN
      RAISE EXCEPTION 'template_provenance_approval_receipts has incompatible % : % (expected %)',
        check_pair[1], coalesce(actual_definition, '<missing>'), expected_definition;
    END IF;
  END LOOP;

  DROP TABLE m19_expected_checks;

  -- EXACT guard-function body. Both sides are rendered by Postgres and then have
  -- their own name AND any schema qualifier erased, so the comparison holds in a
  -- disposable non-public schema exactly as it does in public — the throwaway
  -- schema technique every sibling migration test uses depends on that.
  CREATE FUNCTION pg_temp.m19_expected_guard()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $guard$
  BEGIN
    RAISE EXCEPTION 'template provenance approval receipts are immutable';
    RETURN NULL;
  END;
  $guard$;

  -- The schema qualifier is stripped while whitespace still provides word
  -- boundaries, and only then is whitespace collapsed. Doing it the other way
  -- round lets a greedy [a-z0-9_]+ swallow everything up to the dot.
  SELECT regexp_replace(
           replace(regexp_replace(lower(pg_get_functiondef(p.oid)),
                                  'function\s+[a-z0-9_]+\.', 'function ', 'g'),
                   'm19_expected_guard', '<guard>'),
           '\s+', '', 'g')
    INTO expected_definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname LIKE 'pg_temp%' AND p.proname = 'm19_expected_guard';

  SELECT regexp_replace(
           replace(regexp_replace(lower(pg_get_functiondef(p.oid)),
                                  'function\s+[a-z0-9_]+\.', 'function ', 'g'),
                   'guard_template_provenance_receipt_immutability', '<guard>'),
           '\s+', '', 'g')
    INTO actual_definition
    FROM pg_proc p
   WHERE p.oid = to_regprocedure('guard_template_provenance_receipt_immutability()');

  IF actual_definition IS NULL OR actual_definition IS DISTINCT FROM expected_definition THEN
    RAISE EXCEPTION 'guard_template_provenance_receipt_immutability has incompatible definition: %',
      coalesce(actual_definition, '<missing>');
  END IF;

  -- EXACT trigger semantics: name, enabled state, timing and BOTH events. A
  -- trigger narrowed to UPDATE would leave DELETE unguarded. Like the CHECKs,
  -- the canonical form is rendered by Postgres from a throwaway twin rather than
  -- hardcoded -- pg_get_triggerdef canonicalizes event order (BEFORE UPDATE OR
  -- DELETE comes back as BEFORE DELETE OR UPDATE), and a literal would encode
  -- that rendering detail as if it were the contract.
  CREATE TEMP TABLE m19_expected_trigger_host (x INT) ON COMMIT DROP;
  EXECUTE 'CREATE TRIGGER trg_template_provenance_receipt_immutable '
       || 'BEFORE UPDATE OR DELETE ON pg_temp.m19_expected_trigger_host '
       || 'FOR EACH ROW EXECUTE FUNCTION guard_template_provenance_receipt_immutability()';

  SELECT tgname::text || ':' || tgenabled::text || ':' ||
         regexp_replace(
           replace(regexp_replace(lower(pg_get_triggerdef(oid)),
                                  '(\son|\sfunction)\s+[a-z0-9_]+\.', '\1 ', 'g'),
                   'm19_expected_trigger_host', '<tbl>'),
           '\s+', '', 'g')
    INTO expected_trigger
    FROM pg_trigger
   WHERE tgrelid = 'pg_temp.m19_expected_trigger_host'::regclass AND NOT tgisinternal;

  SELECT string_agg(tgname::text || ':' || tgenabled::text || ':' ||
           regexp_replace(
             replace(regexp_replace(lower(pg_get_triggerdef(oid)),
                                    '(\son|\sfunction)\s+[a-z0-9_]+\.', '\1 ', 'g'),
                     'template_provenance_approval_receipts', '<tbl>'),
             '\s+', '', 'g'),
           ',' ORDER BY tgname)
    INTO actual_trigger
    FROM pg_trigger
   WHERE tgrelid = to_regclass('template_provenance_approval_receipts') AND NOT tgisinternal;

  DROP TABLE m19_expected_trigger_host;

  IF actual_trigger IS NULL OR actual_trigger IS DISTINCT FROM expected_trigger THEN
    RAISE EXCEPTION 'template_provenance_approval_receipts has incompatible immutability trigger: % (expected %)',
      coalesce(actual_trigger, '<missing>'), expected_trigger;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS template_provenance_approval_receipts (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  registry TEXT NOT NULL,
  template_id TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  provenance_version TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  approved_by_role TEXT NOT NULL,
  provenance_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, idempotency_key),
  CONSTRAINT uq_template_provenance_receipt_target
    UNIQUE (organization_id, registry, template_id),
  CONSTRAINT ck_template_provenance_receipt_key
    CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  CONSTRAINT ck_template_provenance_receipt_fingerprint
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  -- Only the three canonical registries are approvable. report_builder_templates
  -- is legacy (MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md:158) and is
  -- deliberately absent, so an unsupported type fails closed at the database.
  CONSTRAINT ck_template_provenance_receipt_registry
    CHECK (registry IN ('document_studio_templates', 'presentation_templates', 'tp_base_templates')),
  CONSTRAINT ck_template_provenance_receipt_role
    CHECK (approved_by_role IN ('OWNER', 'ADMIN')),
  CONSTRAINT ck_template_provenance_receipt_actor
    CHECK (length(btrim(approved_by)) BETWEEN 1 AND 200),
  CONSTRAINT ck_template_provenance_receipt_template
    CHECK (length(btrim(template_id)) BETWEEN 1 AND 200),
  CONSTRAINT ck_template_provenance_receipt_version
    CHECK (length(btrim(provenance_version)) BETWEEN 1 AND 200),
  -- The rights basis is mandatory in the ledger itself, not only in the caller.
  -- An approval that cannot name its source and licence basis cannot be recorded.
  --
  -- Bounded as well as mandatory: this row can never be UPDATEd or DELETEd, and
  -- organization_id is ON DELETE RESTRICT, so an unbounded free-text field would
  -- be permanent, unreclaimable growth that also blocks deleting the tenant.
  -- Non-empty alone is not a sufficient constraint on an append-only ledger.
  CONSTRAINT ck_template_provenance_receipt_evidence
    CHECK (
      jsonb_typeof(provenance_json) = 'object'
      AND length(btrim(provenance_json->>'source')) BETWEEN 1 AND 2000
      AND length(btrim(provenance_json->>'licenseBasis')) BETWEEN 1 AND 2000
      AND length(btrim(provenance_json->>'authority')) BETWEEN 1 AND 2000
      AND length(btrim(provenance_json->>'actor')) BETWEEN 1 AND 200
      AND length(btrim(provenance_json->>'version')) BETWEEN 1 AND 200
      AND length(btrim(provenance_json->>'evidence')) BETWEEN 1 AND 2000
    )
);

-- An approval receipt has no legal successor state. Both UPDATE and DELETE are
-- rejected outright, so a recorded rights attestation can never be edited away
-- or quietly retracted.
--
-- The body is kept comment-free ON PURPOSE: pg_get_functiondef returns prosrc
-- verbatim, so any comment inside the body becomes part of the compared
-- definition and would have to be duplicated byte-for-byte in the preflight
-- twin. Design commentary lives here, outside the body, where it cannot drift
-- into the equality check.
CREATE OR REPLACE FUNCTION guard_template_provenance_receipt_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'template provenance approval receipts are immutable';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_template_provenance_receipt_immutable
  ON template_provenance_approval_receipts;
CREATE TRIGGER trg_template_provenance_receipt_immutable
BEFORE UPDATE OR DELETE ON template_provenance_approval_receipts
FOR EACH ROW EXECUTE FUNCTION guard_template_provenance_receipt_immutability();
