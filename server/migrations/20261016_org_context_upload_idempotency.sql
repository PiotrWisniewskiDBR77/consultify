-- ORG-UI-CANON: durable idempotency receipt for attachment -> governed claim.
-- The reservation and the document/chunks/context source are committed in one
-- pinned transaction, so a rolled-back request leaves neither business rows
-- nor an orphan reservation.

DO $$
DECLARE
  actual_columns TEXT;
  actual_pk TEXT;
  actual_check TEXT;
  actual_fks TEXT;
  actual_trigger TEXT;
  actual_function TEXT;
BEGIN
  IF to_regclass('public.organization_context_upload_receipts') IS NULL THEN
    RETURN;
  END IF;

  SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable || ':' ||
                    coalesce(lower(regexp_replace(column_default, '[[:space:]()]|::[a-z ]+', '', 'g')), '<null>'),
                    ',' ORDER BY ordinal_position)
    INTO actual_columns
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'organization_context_upload_receipts';
  IF actual_columns <> 'organization_id:text:NO:<null>,idempotency_key:text:NO:<null>,request_hash:text:NO:<null>,status:text:NO:''processing'',document_id:text:YES:<null>,response_json:jsonb:YES:<null>,created_at:timestamp with time zone:NO:current_timestamp,completed_at:timestamp with time zone:YES:<null>' THEN
    RAISE EXCEPTION 'organization_context_upload_receipts has incompatible columns: %', actual_columns;
  END IF;

  SELECT string_agg(lower(regexp_replace(pg_get_constraintdef(c.oid), '[[:space:]()]', '', 'g')), ',' ORDER BY a.attname)
    INTO actual_fks
    FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    JOIN unnest(c.conkey) WITH ORDINALITY k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum
   WHERE n.nspname='public' AND t.relname='organization_context_upload_receipts' AND c.contype='f';
  IF actual_fks <> 'foreignkeydocument_idreferencesknowledge_docsidondeleterestrict,foreignkeyorganization_idreferencesorganizationsidondeleterestrict' THEN
    RAISE EXCEPTION 'organization_context_upload_receipts has incompatible foreign keys: %', actual_fks;
  END IF;

  SELECT lower(regexp_replace(pg_get_constraintdef(c.oid), '[[:space:]]', '', 'g'))
    INTO actual_pk
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'public' AND t.relname = 'organization_context_upload_receipts' AND c.contype = 'p';
  IF actual_pk <> 'primarykey(organization_id,idempotency_key)' THEN
    RAISE EXCEPTION 'organization_context_upload_receipts has incompatible primary key: %', actual_pk;
  END IF;

  SELECT lower(regexp_replace(pg_get_constraintdef(c.oid), '[[:space:]()]', '', 'g'))
    INTO actual_check
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'public' AND t.relname = 'organization_context_upload_receipts'
     AND c.conname = 'ck_org_context_upload_receipt_key';
  actual_check := replace(actual_check, '::text', '');
  IF actual_check <> 'checklengthbtrimidempotency_key>=1andlengthbtrimidempotency_key<=200' THEN
    RAISE EXCEPTION 'organization_context_upload_receipts has incompatible key check: %', actual_check;
  END IF;

  SELECT lower(regexp_replace(pg_get_constraintdef(c.oid), '[[:space:]()]', '', 'g'))
    INTO actual_check
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
   WHERE n.nspname='public' AND t.relname='organization_context_upload_receipts'
     AND c.conname='ck_org_context_upload_receipt_hash';
  actual_check := replace(actual_check, '::text', '');
  IF actual_check <> 'checkrequest_hash~''^[0-9a-f]{64}$''' THEN
    RAISE EXCEPTION 'organization_context_upload_receipts has incompatible hash check: %', actual_check;
  END IF;

  SELECT lower(regexp_replace(pg_get_constraintdef(c.oid), '[[:space:]()]', '', 'g'))
    INTO actual_check
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
   WHERE n.nspname='public' AND t.relname='organization_context_upload_receipts'
     AND c.conname='ck_org_context_upload_receipt_status';
  actual_check := replace(actual_check, '::text', '');
  IF actual_check NOT IN ('checkstatus=anyarray[''processing'',''completed'']', 'checkstatusin''processing'',''completed''') THEN
    RAISE EXCEPTION 'organization_context_upload_receipts has incompatible status check: %', actual_check;
  END IF;

  SELECT lower(regexp_replace(pg_get_constraintdef(c.oid), '[[:space:]()]', '', 'g'))
    INTO actual_check
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
   WHERE n.nspname='public' AND t.relname='organization_context_upload_receipts'
     AND c.conname='ck_org_context_upload_receipt_completion';
  actual_check := replace(actual_check, '::text', '');
  IF actual_check <> 'checkstatus=''processing''anddocument_idisnullandresponse_jsonisnullandcompleted_atisnullorstatus=''completed''anddocument_idisnotnullandresponse_jsonisnotnullandcompleted_atisnotnull' THEN
    RAISE EXCEPTION 'organization_context_upload_receipts has incompatible completion check: %', actual_check;
  END IF;

  SELECT lower(regexp_replace(pg_get_triggerdef(g.oid), '[[:space:]()]', '', 'g'))
    INTO actual_trigger
    FROM pg_trigger g JOIN pg_class t ON t.oid=g.tgrelid JOIN pg_namespace n ON n.oid=t.relnamespace
   WHERE n.nspname='public' AND t.relname='organization_context_upload_receipts'
     AND g.tgname='trg_org_context_upload_receipt_immutable' AND NOT g.tgisinternal;
  IF actual_trigger IS NOT NULL AND actual_trigger !~
    '^createtriggertrg_org_context_upload_receipt_immutablebeforedeleteorupdateon([a-z0-9_]+\.)?organization_context_upload_receiptsforeachrowexecutefunctionguard_org_context_upload_receipt_immutability$' THEN
    RAISE EXCEPTION 'organization_context_upload_receipts has incompatible trigger: %', actual_trigger;
  END IF;

  IF actual_trigger IS NOT NULL THEN
    SELECT lower(regexp_replace(pg_get_functiondef(p.oid), '[[:space:]]', '', 'g')) INTO actual_function
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='guard_org_context_upload_receipt_immutability';
    IF actual_function IS NULL OR actual_function NOT LIKE '%tg_op=''delete''%old.organization_idisdistinctfromnew.organization_id%old.status<>''processing''ornew.status<>''completed''%returnnew;%' THEN
      RAISE EXCEPTION 'organization_context_upload_receipts has incompatible trigger function';
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS organization_context_upload_receipts (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROCESSING',
  document_id TEXT REFERENCES knowledge_docs(id) ON DELETE RESTRICT,
  response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (organization_id, idempotency_key),
  CONSTRAINT ck_org_context_upload_receipt_key
    CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  CONSTRAINT ck_org_context_upload_receipt_hash
    CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_org_context_upload_receipt_status
    CHECK (status IN ('PROCESSING', 'COMPLETED')),
  CONSTRAINT ck_org_context_upload_receipt_completion
    CHECK (
      (status = 'PROCESSING' AND document_id IS NULL AND response_json IS NULL AND completed_at IS NULL)
      OR
      (status = 'COMPLETED' AND document_id IS NOT NULL AND response_json IS NOT NULL AND completed_at IS NOT NULL)
    )
);

CREATE OR REPLACE FUNCTION guard_org_context_upload_receipt_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'organization context upload receipts are immutable';
  END IF;
  IF OLD.organization_id IS DISTINCT FROM NEW.organization_id
     OR OLD.idempotency_key IS DISTINCT FROM NEW.idempotency_key
     OR OLD.request_hash IS DISTINCT FROM NEW.request_hash
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'organization context upload receipt identity is immutable';
  END IF;
  IF OLD.status <> 'PROCESSING' OR NEW.status <> 'COMPLETED'
     OR OLD.document_id IS NOT NULL OR OLD.response_json IS NOT NULL OR OLD.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'organization context upload receipt is terminal';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_context_upload_receipt_immutable
  ON organization_context_upload_receipts;
CREATE TRIGGER trg_org_context_upload_receipt_immutable
BEFORE UPDATE OR DELETE ON organization_context_upload_receipts
FOR EACH ROW EXECUTE FUNCTION guard_org_context_upload_receipt_immutability();
