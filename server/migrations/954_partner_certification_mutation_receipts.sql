-- Durable idempotency receipts for V8 Partner certification mutations.
DO $$
DECLARE actual TEXT; fk_count INTEGER;
BEGIN
  IF to_regclass('public.partner_certification_mutation_receipts') IS NULL THEN RETURN; END IF;
  SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable, ',' ORDER BY ordinal_position)
    INTO actual FROM information_schema.columns
   WHERE table_schema='public' AND table_name='partner_certification_mutation_receipts';
  IF actual <> 'partner_org_id:uuid:NO,user_id:text:NO,operation:text:NO,idempotency_key:text:NO,request_hash:text:NO,status:text:NO,response_json:jsonb:YES,created_at:timestamp with time zone:NO,completed_at:timestamp with time zone:YES' THEN
    RAISE EXCEPTION 'partner_certification_mutation_receipts has incompatible columns: %', actual;
  END IF;
  SELECT count(*) INTO fk_count FROM pg_constraint c
   JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
   WHERE n.nspname='public' AND t.relname='partner_certification_mutation_receipts' AND c.contype='f';
  IF fk_count <> 2 THEN
    RAISE EXCEPTION 'partner_certification_mutation_receipts has incompatible foreign keys';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS partner_certification_mutation_receipts (
  partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROCESSING',
  response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY(partner_org_id,user_id,operation,idempotency_key),
  CONSTRAINT ck_partner_cert_receipt_key CHECK(length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  CONSTRAINT ck_partner_cert_receipt_hash CHECK(request_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_partner_cert_receipt_status CHECK(status IN ('PROCESSING','COMPLETED')),
  CONSTRAINT ck_partner_cert_receipt_completion CHECK(
    (status='PROCESSING' AND response_json IS NULL AND completed_at IS NULL) OR
    (status='COMPLETED' AND response_json IS NOT NULL AND completed_at IS NOT NULL)
  )
);
