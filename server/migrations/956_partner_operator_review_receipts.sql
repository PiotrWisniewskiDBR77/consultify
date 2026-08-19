-- Durable idempotency and reviewer audit for global Partner operator reviews.
DO $$
DECLARE actual TEXT; fk_count INTEGER; fk_definition TEXT; pk_definition TEXT; actual_constraints TEXT;
BEGIN
  IF to_regclass('public.partner_operator_review_receipts') IS NULL THEN RETURN; END IF;
  SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable, ',' ORDER BY ordinal_position)
    INTO actual FROM information_schema.columns
   WHERE table_schema='public' AND table_name='partner_operator_review_receipts';
  IF actual <> 'actor_user_id:text:NO,operation:text:NO,target_id:text:NO,idempotency_key:text:NO,request_hash:text:NO,status:text:NO,response_status:integer:YES,response_json:jsonb:YES,created_at:timestamp with time zone:NO,completed_at:timestamp with time zone:YES' THEN
    RAISE EXCEPTION 'partner_operator_review_receipts has incompatible columns: %', actual;
  END IF;
  SELECT count(*) INTO fk_count FROM pg_constraint c
   JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
   WHERE n.nspname='public' AND t.relname='partner_operator_review_receipts' AND c.contype='f';
  IF fk_count <> 1 THEN
    RAISE EXCEPTION 'partner_operator_review_receipts has incompatible foreign keys: %', fk_count;
  END IF;
  SELECT lower(regexp_replace(pg_get_constraintdef(c.oid),'[[:space:]()]','','g')) INTO fk_definition
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
   WHERE n.nspname='public' AND t.relname='partner_operator_review_receipts' AND c.contype='f';
  IF fk_definition <> 'foreignkeyactor_user_idreferencesusersidondeleterestrict' THEN
    RAISE EXCEPTION 'partner_operator_review_receipts has incompatible actor FK: %', fk_definition;
  END IF;
  SELECT lower(regexp_replace(pg_get_constraintdef(c.oid),'[[:space:]()]','','g')) INTO pk_definition
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
   WHERE n.nspname='public' AND t.relname='partner_operator_review_receipts' AND c.contype='p';
  IF pk_definition <> 'primarykeyactor_user_id,operation,idempotency_key' THEN
    RAISE EXCEPTION 'partner_operator_review_receipts has incompatible primary key: %', pk_definition;
  END IF;
  SELECT string_agg(c.conname,',' ORDER BY c.conname) INTO actual_constraints
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
   WHERE n.nspname='public' AND t.relname='partner_operator_review_receipts';
  IF actual_constraints <> 'ck_partner_operator_review_completion,ck_partner_operator_review_hash,ck_partner_operator_review_key,ck_partner_operator_review_operation,ck_partner_operator_review_status,ck_partner_operator_review_target,partner_operator_review_receipts_actor_user_id_fkey,partner_operator_review_receipts_pkey' THEN
    RAISE EXCEPTION 'partner_operator_review_receipts has incompatible constraints: %', actual_constraints;
  END IF;
END $$;

DO $$
DECLARE actual TEXT;
BEGIN
  IF to_regclass('public.public_partner_applications') IS NULL THEN RETURN; END IF;
  SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable, ',' ORDER BY ordinal_position)
    INTO actual FROM information_schema.columns
   WHERE table_schema='public' AND table_name='public_partner_applications';
  IF actual <> 'id:text:NO,full_name:text:NO,email:text:NO,company:text:NO,website:text:YES,country:text:YES,role:text:YES,team_size:text:YES,focus_area:text:YES,message:text:YES,locale:text:YES,status:text:NO,review_note:text:YES,reviewed_by:text:YES,reviewed_at:timestamp without time zone:YES,created_at:timestamp without time zone:YES' THEN
    RAISE EXCEPTION 'public_partner_applications has incompatible columns: %', actual;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public_partner_applications (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  website TEXT,
  country TEXT,
  role TEXT,
  team_size TEXT,
  focus_area TEXT,
  message TEXT,
  locale TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  review_note TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partner_operator_review_receipts (
  actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  operation TEXT NOT NULL,
  target_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROCESSING',
  response_status INTEGER,
  response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY(actor_user_id,operation,idempotency_key),
  CONSTRAINT ck_partner_operator_review_operation CHECK(operation IN ('certification_review','application_review')),
  CONSTRAINT ck_partner_operator_review_target CHECK(length(btrim(target_id)) BETWEEN 1 AND 256),
  CONSTRAINT ck_partner_operator_review_key CHECK(length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  CONSTRAINT ck_partner_operator_review_hash CHECK(request_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_partner_operator_review_status CHECK(status IN ('PROCESSING','COMPLETED')),
  CONSTRAINT ck_partner_operator_review_completion CHECK(
    (status='PROCESSING' AND response_status IS NULL AND response_json IS NULL AND completed_at IS NULL) OR
    (status='COMPLETED' AND response_status=200 AND response_json IS NOT NULL AND completed_at IS NOT NULL)
  )
);
