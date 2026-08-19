-- Durable idempotency receipts for the V8 Partner self-connect command.
DO $$
DECLARE column_type TEXT; nullable TEXT; fk_definition TEXT; index_definition TEXT;
BEGIN
  SELECT data_type,is_nullable INTO column_type,nullable
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='partner_organizations'
     AND column_name='owner_organization_id';
  IF column_type IS NOT NULL AND (column_type <> 'text' OR nullable <> 'YES') THEN
    RAISE EXCEPTION 'partner_organizations.owner_organization_id has incompatible shape: %/%', column_type,nullable;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='partner_organizations_owner_organization_id_fkey') THEN
    SELECT lower(regexp_replace(pg_get_constraintdef(oid),'[[:space:]()]','','g')) INTO fk_definition
      FROM pg_constraint WHERE conname='partner_organizations_owner_organization_id_fkey';
    IF fk_definition <> 'foreignkeyowner_organization_idreferencesorganizationsidondeleterestrict' THEN
      RAISE EXCEPTION 'partner owner tenant FK is incompatible: %', fk_definition;
    END IF;
  END IF;
  IF to_regclass('public.uq_partner_organizations_active_owner_tenant') IS NOT NULL THEN
    SELECT lower(regexp_replace(pg_get_indexdef(indexrelid),'[[:space:]()]','','g')) INTO index_definition
      FROM pg_index WHERE indexrelid='public.uq_partner_organizations_active_owner_tenant'::regclass;
    IF index_definition NOT LIKE 'createuniqueindexuq_partner_organizations_active_owner_tenantonpublic.partner_organizationsusingbtreeowner_organization_idwhere%'
       OR index_definition NOT LIKE '%owner_organization_idisnotnull%'
       OR index_definition NOT LIKE '%lowerstatus%=''active''%' THEN
      RAISE EXCEPTION 'partner owner tenant index is incompatible: %', index_definition;
    END IF;
  END IF;
END $$;

ALTER TABLE partner_organizations ADD COLUMN IF NOT EXISTS owner_organization_id TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='partner_organizations_owner_organization_id_fkey') THEN
    ALTER TABLE partner_organizations ADD CONSTRAINT partner_organizations_owner_organization_id_fkey
      FOREIGN KEY(owner_organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_organizations_active_owner_tenant
  ON partner_organizations(owner_organization_id)
  WHERE owner_organization_id IS NOT NULL AND lower(status)='active';

DO $$
DECLARE actual TEXT; fk_count INTEGER; actual_constraints TEXT;
BEGIN
  IF to_regclass('public.partner_connection_receipts') IS NULL THEN RETURN; END IF;
  SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable, ',' ORDER BY ordinal_position)
    INTO actual FROM information_schema.columns
   WHERE table_schema='public' AND table_name='partner_connection_receipts';
  IF actual <> 'organization_id:text:NO,user_id:text:NO,idempotency_key:text:NO,request_hash:text:NO,status:text:NO,response_status:integer:YES,response_json:jsonb:YES,created_at:timestamp with time zone:NO,completed_at:timestamp with time zone:YES' THEN
    RAISE EXCEPTION 'partner_connection_receipts has incompatible columns: %', actual;
  END IF;
  SELECT count(*) INTO fk_count FROM pg_constraint c
   JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
   WHERE n.nspname='public' AND t.relname='partner_connection_receipts' AND c.contype='f';
  IF fk_count <> 2 THEN RAISE EXCEPTION 'partner_connection_receipts has incompatible foreign keys'; END IF;
  SELECT string_agg(c.conname,',' ORDER BY c.conname) INTO actual_constraints
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
   WHERE n.nspname='public' AND t.relname='partner_connection_receipts';
  IF actual_constraints <> 'ck_partner_connection_receipt_completion,ck_partner_connection_receipt_hash,ck_partner_connection_receipt_key,ck_partner_connection_receipt_status,partner_connection_receipts_organization_id_fkey,partner_connection_receipts_pkey,partner_connection_receipts_user_id_fkey' THEN
    RAISE EXCEPTION 'partner_connection_receipts has incompatible constraints: %', actual_constraints;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS partner_connection_receipts (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROCESSING',
  response_status INTEGER,
  response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY(organization_id,user_id,idempotency_key),
  CONSTRAINT ck_partner_connection_receipt_key CHECK(length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  CONSTRAINT ck_partner_connection_receipt_hash CHECK(request_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_partner_connection_receipt_status CHECK(status IN ('PROCESSING','COMPLETED')),
  CONSTRAINT ck_partner_connection_receipt_completion CHECK(
    (status='PROCESSING' AND response_status IS NULL AND response_json IS NULL AND completed_at IS NULL) OR
    (status='COMPLETED' AND response_status IN (200,201) AND response_json IS NOT NULL AND completed_at IS NOT NULL)
  )
);
