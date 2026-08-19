-- Immutable receipts for explicit historical Partner -> tenant binding runs.
-- Every governed object is catalog-checked before IF NOT EXISTS may reuse it.
DO $$
DECLARE actual TEXT; pk_ok BOOLEAN; actor_fk_ok BOOLEAN; apply_fk_ok BOOLEAN; checks_ok BOOLEAN;
BEGIN
  IF to_regclass('public.partner_owner_binding_receipts') IS NULL THEN RETURN; END IF;
  SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable || ':' ||
    CASE WHEN column_default IS NULL THEN 'NONE'
         WHEN column_name='executed_at' AND lower(regexp_replace(column_default,'[[:space:]]','','g')) IN ('now()','current_timestamp') THEN 'NOW'
         ELSE 'OTHER' END, ',' ORDER BY ordinal_position)
    INTO actual FROM information_schema.columns
   WHERE table_schema='public' AND table_name='partner_owner_binding_receipts';
  IF actual <> 'run_id:text:NO:NONE,operation:text:NO:NONE,apply_run_id:text:YES:NONE,input_sha256:text:NO:NONE,signature_key_id:text:NO:NONE,actor_user_id:text:NO:NONE,manifest_issued_at:timestamp with time zone:NO:NONE,executed_at:timestamp with time zone:NO:NOW,mapping_count:integer:NO:NONE,mappings_json:jsonb:NO:NONE,result_sha256:text:NO:NONE' THEN
    RAISE EXCEPTION 'partner_owner_binding_receipts has incompatible columns: %', actual;
  END IF;
  SELECT count(*)=1 AND bool_and(pg_get_constraintdef(c.oid)='PRIMARY KEY (run_id)') INTO pk_ok
    FROM pg_constraint c WHERE c.conrelid='public.partner_owner_binding_receipts'::regclass AND c.contype='p';
  SELECT count(*)=1 AND bool_and(lower(regexp_replace(pg_get_constraintdef(c.oid),'[[:space:]()]','','g'))='foreignkeyactor_user_idreferencesusersidondeleterestrict') INTO actor_fk_ok
    FROM pg_constraint c WHERE c.conrelid='public.partner_owner_binding_receipts'::regclass AND c.contype='f' AND pg_get_constraintdef(c.oid) ILIKE '%actor_user_id%';
  SELECT count(*)=1 AND bool_and(lower(regexp_replace(pg_get_constraintdef(c.oid),'[[:space:]()]','','g'))='foreignkeyapply_run_idreferencespartner_owner_binding_receiptsrun_idondeleterestrict') INTO apply_fk_ok
    FROM pg_constraint c WHERE c.conrelid='public.partner_owner_binding_receipts'::regclass AND c.contype='f' AND pg_get_constraintdef(c.oid) ILIKE '%apply_run_id%';
  SELECT string_agg(c.conname || ':' || lower(regexp_replace(pg_get_constraintdef(c.oid),'[[:space:]()]','','g')), ',' ORDER BY c.conname)=
    'ck_partner_owner_binding_receipt_operation:checkoperation=''apply''::textandapply_run_idisnulloroperation=''rollback''::textandapply_run_idisnotnull,' ||
    'partner_owner_binding_receipts_input_sha256_check:checkinput_sha256~''^[0-9a-f]{64}$''::text,' ||
    'partner_owner_binding_receipts_mapping_count_check:checkmapping_count>0,' ||
    'partner_owner_binding_receipts_operation_check:checkoperation=anyarray[''apply''::text,''rollback''::text],' ||
    'partner_owner_binding_receipts_result_sha256_check:checkresult_sha256~''^[0-9a-f]{64}$''::text,' ||
    'partner_owner_binding_receipts_signature_key_id_check:checklengthbtrimsignature_key_id>=1andlengthbtrimsignature_key_id<=100'
    INTO checks_ok FROM pg_constraint c
   WHERE c.conrelid='public.partner_owner_binding_receipts'::regclass AND c.contype='c';
  IF NOT coalesce(pk_ok,false) OR NOT coalesce(actor_fk_ok,false) OR NOT coalesce(apply_fk_ok,false) OR NOT coalesce(checks_ok,false) THEN
    RAISE EXCEPTION 'partner_owner_binding_receipts has incompatible constraints';
  END IF;
END $$;

DO $$ DECLARE index_ok BOOLEAN;
BEGIN
  IF to_regclass('public.uq_partner_owner_binding_apply_input') IS NOT NULL THEN
    SELECT count(*)=1 AND bool_and(i.indisunique AND i.indisvalid AND i.indisready AND i.indnkeyatts=1 AND i.indnatts=1)
      AND bool_and(a.attname='input_sha256')
      AND bool_and(lower(regexp_replace(pg_get_expr(i.indpred,i.indrelid),'[[:space:]()]','','g'))='operation=''apply''::text') INTO index_ok
      FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0]
     WHERE i.indexrelid='public.uq_partner_owner_binding_apply_input'::regclass
       AND i.indrelid='public.partner_owner_binding_receipts'::regclass;
    IF NOT coalesce(index_ok,false) THEN
      RAISE EXCEPTION 'uq_partner_owner_binding_apply_input is incompatible';
    END IF;
  END IF;
  IF to_regclass('public.uq_partner_owner_binding_rollback') IS NOT NULL THEN
    SELECT count(*)=1 AND bool_and(i.indisunique AND i.indisvalid AND i.indisready AND i.indnkeyatts=1 AND i.indnatts=1)
      AND bool_and(a.attname='apply_run_id')
      AND bool_and(lower(regexp_replace(pg_get_expr(i.indpred,i.indrelid),'[[:space:]()]','','g'))='operation=''rollback''::text') INTO index_ok
      FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0]
     WHERE i.indexrelid='public.uq_partner_owner_binding_rollback'::regclass
       AND i.indrelid='public.partner_owner_binding_receipts'::regclass;
    IF NOT coalesce(index_ok,false) THEN
      RAISE EXCEPTION 'uq_partner_owner_binding_rollback is incompatible';
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS partner_owner_binding_receipts (
  run_id TEXT PRIMARY KEY,
  operation TEXT NOT NULL CHECK (operation IN ('APPLY', 'ROLLBACK')),
  apply_run_id TEXT REFERENCES partner_owner_binding_receipts(run_id) ON DELETE RESTRICT,
  input_sha256 TEXT NOT NULL CHECK (input_sha256 ~ '^[0-9a-f]{64}$'),
  signature_key_id TEXT NOT NULL CHECK (length(btrim(signature_key_id)) BETWEEN 1 AND 100),
  actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  manifest_issued_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mapping_count INTEGER NOT NULL CHECK (mapping_count > 0),
  mappings_json JSONB NOT NULL,
  result_sha256 TEXT NOT NULL CHECK (result_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_partner_owner_binding_receipt_operation CHECK (
    (operation='APPLY' AND apply_run_id IS NULL) OR (operation='ROLLBACK' AND apply_run_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_owner_binding_apply_input ON partner_owner_binding_receipts(input_sha256) WHERE operation='APPLY';
CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_owner_binding_rollback ON partner_owner_binding_receipts(apply_run_id) WHERE operation='ROLLBACK';

DO $$ DECLARE function_ok BOOLEAN;
BEGIN
  IF to_regprocedure('public.protect_partner_owner_binding_receipts()') IS NOT NULL THEN
    SELECT count(*)=1
      AND bool_and(l.lanname='plpgsql' AND p.pronargs=0 AND p.prorettype='trigger'::regtype)
      AND bool_and(p.provolatile='v' AND NOT p.prosecdef AND NOT p.proleakproof AND p.proconfig IS NULL)
      AND bool_and(lower(regexp_replace(p.prosrc,'[[:space:]]','','g'))=
        'beginraiseexception''partner_owner_binding_receiptsareappend-only'';end')
      INTO function_ok
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
     WHERE n.nspname='public' AND p.proname='protect_partner_owner_binding_receipts' AND p.pronargs=0;
    IF NOT coalesce(function_ok,false) THEN
      RAISE EXCEPTION 'protect_partner_owner_binding_receipts() is incompatible';
    END IF;
  ELSE
    EXECUTE 'CREATE FUNCTION protect_partner_owner_binding_receipts() RETURNS trigger LANGUAGE plpgsql AS $body$
      BEGIN RAISE EXCEPTION ''partner_owner_binding_receipts are append-only''; END $body$';
  END IF;
END $$;

DO $$ DECLARE trigger_ok BOOLEAN;
BEGIN
  SELECT count(*)=1 AND bool_and(t.tgenabled='O')
    AND bool_and(t.tgtype=27)
    AND bool_and(t.tgfoid='public.protect_partner_owner_binding_receipts()'::regprocedure) INTO trigger_ok
    FROM pg_trigger t
   WHERE t.tgrelid='public.partner_owner_binding_receipts'::regclass AND t.tgname='trg_partner_owner_binding_receipts_append_only' AND NOT t.tgisinternal;
  IF NOT coalesce(trigger_ok,false) THEN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.partner_owner_binding_receipts'::regclass AND tgname='trg_partner_owner_binding_receipts_append_only') THEN
      RAISE EXCEPTION 'trg_partner_owner_binding_receipts_append_only is incompatible';
    END IF;
    CREATE TRIGGER trg_partner_owner_binding_receipts_append_only BEFORE UPDATE OR DELETE ON partner_owner_binding_receipts
      FOR EACH ROW EXECUTE FUNCTION protect_partner_owner_binding_receipts();
  END IF;
END $$;
