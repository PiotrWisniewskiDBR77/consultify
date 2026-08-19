-- PRT-W17 retained canonical public ingress: atomic click idempotency and abuse proof.
-- The historical referral migration is not in the strict fresh-PG ledger. Own
-- the two tables this retained ingress actually needs instead of relying on the
-- old route's lazy runtime DDL.
DO $$
DECLARE incompatible TEXT; constraint_count INTEGER; fk_definition TEXT; default_expression TEXT;
BEGIN
  IF to_regclass('public.partner_referral_clicks') IS NOT NULL THEN
    SELECT string_agg(required.name,',' ORDER BY required.name) INTO incompatible
      FROM (VALUES
        ('id','uuid'),('partner_org_id','uuid'),('referral_code','character varying'),
        ('clicked_at','timestamp with time zone'),('ip_hash','character varying'),
        ('user_agent','text'),('referer','character varying'),
        ('landing_page','character varying'),('utm_source','character varying'),
        ('utm_medium','character varying'),('utm_campaign','character varying'),
        ('utm_content','character varying'),('utm_term','character varying'),
        ('converted','boolean'),('converted_at','timestamp with time zone'),
        ('converted_organization_id','uuid'),('conversion_type','character varying'),
        ('session_id','character varying'),('cookie_id','character varying')
      ) required(name,data_type)
      LEFT JOIN information_schema.columns actual
        ON actual.table_schema='public' AND actual.table_name='partner_referral_clicks'
       AND actual.column_name=required.name AND actual.data_type=required.data_type
     WHERE actual.column_name IS NULL;
    IF incompatible IS NOT NULL THEN
      RAISE EXCEPTION 'partner_referral_clicks has incompatible required columns: %', incompatible;
    END IF;
    SELECT string_agg(required.name,',' ORDER BY required.name) INTO incompatible
      FROM (VALUES ('id'),('partner_org_id'),('referral_code')) required(name)
      JOIN information_schema.columns actual
        ON actual.table_schema='public' AND actual.table_name='partner_referral_clicks'
       AND actual.column_name=required.name
     WHERE actual.is_nullable <> 'NO';
    IF incompatible IS NOT NULL THEN
      RAISE EXCEPTION 'partner_referral_clicks has incompatible nullable columns: %', incompatible;
    END IF;
    SELECT count(*) INTO constraint_count FROM pg_constraint c
      WHERE c.conrelid='public.partner_referral_clicks'::regclass
        AND c.contype='p'
        AND lower(regexp_replace(pg_get_constraintdef(c.oid),'[[:space:]()]','','g'))='primarykeyid';
    IF constraint_count <> 1 THEN
      RAISE EXCEPTION 'partner_referral_clicks requires PRIMARY KEY(id)';
    END IF;
    SELECT lower(regexp_replace(pg_get_constraintdef(c.oid),'[[:space:]()]','','g'))
      INTO fk_definition FROM pg_constraint c
     WHERE c.conrelid='public.partner_referral_clicks'::regclass AND c.contype='f'
       AND pg_get_constraintdef(c.oid) ILIKE 'FOREIGN KEY (partner_org_id)%';
    IF fk_definition <> 'foreignkeypartner_org_idreferencespartner_organizationsidondeletecascade' THEN
      RAISE EXCEPTION 'partner_referral_clicks has incompatible Partner FK: %', fk_definition;
    END IF;
    SELECT column_default INTO default_expression FROM information_schema.columns
     WHERE table_schema='public' AND table_name='partner_referral_clicks' AND column_name='clicked_at';
    IF default_expression IS NULL THEN
      RAISE EXCEPTION 'partner_referral_clicks.clicked_at requires a server default';
    END IF;
  END IF;

  IF to_regclass('public.partner_campaign_links') IS NOT NULL THEN
    SELECT string_agg(required.name,',' ORDER BY required.name) INTO incompatible
      FROM (VALUES
        ('id','uuid'),('partner_org_id','uuid'),('name','character varying'),
        ('description','text'),('slug','character varying'),
        ('destination_url','character varying'),('utm_source','character varying'),
        ('utm_medium','character varying'),('utm_campaign','character varying'),
        ('utm_content','character varying'),('click_count','integer'),
        ('signup_count','integer'),('conversion_count','integer'),
        ('is_active','boolean'),('expires_at','timestamp with time zone'),
        ('created_at','timestamp with time zone'),
        ('updated_at','timestamp with time zone')
      ) required(name,data_type)
      LEFT JOIN information_schema.columns actual
        ON actual.table_schema='public' AND actual.table_name='partner_campaign_links'
       AND actual.column_name=required.name AND actual.data_type=required.data_type
     WHERE actual.column_name IS NULL;
    IF incompatible IS NOT NULL THEN
      RAISE EXCEPTION 'partner_campaign_links has incompatible required columns: %', incompatible;
    END IF;
    SELECT string_agg(required.name,',' ORDER BY required.name) INTO incompatible
      FROM (VALUES ('id'),('partner_org_id'),('name'),('slug')) required(name)
      JOIN information_schema.columns actual
        ON actual.table_schema='public' AND actual.table_name='partner_campaign_links'
       AND actual.column_name=required.name
     WHERE actual.is_nullable <> 'NO';
    IF incompatible IS NOT NULL THEN
      RAISE EXCEPTION 'partner_campaign_links has incompatible nullable columns: %', incompatible;
    END IF;
    SELECT count(*) INTO constraint_count FROM pg_constraint c
      WHERE c.conrelid='public.partner_campaign_links'::regclass
        AND c.contype='p'
        AND lower(regexp_replace(pg_get_constraintdef(c.oid),'[[:space:]()]','','g'))='primarykeyid';
    IF constraint_count <> 1 THEN
      RAISE EXCEPTION 'partner_campaign_links requires PRIMARY KEY(id)';
    END IF;
    SELECT lower(regexp_replace(pg_get_constraintdef(c.oid),'[[:space:]()]','','g'))
      INTO fk_definition FROM pg_constraint c
     WHERE c.conrelid='public.partner_campaign_links'::regclass AND c.contype='f'
       AND pg_get_constraintdef(c.oid) ILIKE 'FOREIGN KEY (partner_org_id)%';
    IF fk_definition <> 'foreignkeypartner_org_idreferencespartner_organizationsidondeletecascade' THEN
      RAISE EXCEPTION 'partner_campaign_links has incompatible Partner FK: %', fk_definition;
    END IF;
    SELECT column_default INTO default_expression FROM information_schema.columns
     WHERE table_schema='public' AND table_name='partner_campaign_links' AND column_name='click_count';
    IF default_expression IS NULL THEN
      RAISE EXCEPTION 'partner_campaign_links.click_count requires a server default';
    END IF;
    SELECT column_default INTO default_expression FROM information_schema.columns
     WHERE table_schema='public' AND table_name='partner_campaign_links' AND column_name='updated_at';
    IF default_expression IS NULL THEN
      RAISE EXCEPTION 'partner_campaign_links.updated_at requires a server default';
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS partner_referral_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
  referral_code VARCHAR(50) NOT NULL,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_hash VARCHAR(64),
  user_agent TEXT,
  referer VARCHAR(500),
  landing_page VARCHAR(500),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  utm_content VARCHAR(100),
  utm_term VARCHAR(100),
  converted BOOLEAN NOT NULL DEFAULT false,
  converted_at TIMESTAMPTZ,
  converted_organization_id UUID,
  conversion_type VARCHAR(30),
  session_id VARCHAR(100),
  cookie_id VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS partner_campaign_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  slug VARCHAR(100) NOT NULL,
  destination_url VARCHAR(500) DEFAULT '/',
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  utm_content VARCHAR(100),
  click_count INTEGER NOT NULL DEFAULT 0,
  signup_count INTEGER NOT NULL DEFAULT 0,
  conversion_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_partner_campaign_slug UNIQUE(partner_org_id,slug)
);

DO $$
DECLARE actual TEXT; fk_count INTEGER; fk_definition TEXT; actual_constraints TEXT; index_definition TEXT;
BEGIN
  IF to_regclass('public.partner_referral_click_receipts') IS NOT NULL THEN
    SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable, ',' ORDER BY ordinal_position)
      INTO actual FROM information_schema.columns
     WHERE table_schema='public' AND table_name='partner_referral_click_receipts';
    IF actual <> 'partner_org_id:uuid:NO,idempotency_key:text:NO,request_hash:text:NO,server_request_id:uuid:NO,click_id:uuid:NO,status:text:NO,response_json:jsonb:YES,created_at:timestamp with time zone:NO,completed_at:timestamp with time zone:YES' THEN
      RAISE EXCEPTION 'partner_referral_click_receipts has incompatible columns: %', actual;
    END IF;
    SELECT count(*) INTO fk_count FROM pg_constraint c
      JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
     WHERE n.nspname='public' AND t.relname='partner_referral_click_receipts' AND c.contype='f';
    IF fk_count <> 1 THEN
      RAISE EXCEPTION 'partner_referral_click_receipts has incompatible foreign keys: %', fk_count;
    END IF;
    SELECT lower(regexp_replace(pg_get_constraintdef(c.oid),'[[:space:]()]','','g')) INTO fk_definition
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
     WHERE n.nspname='public' AND t.relname='partner_referral_click_receipts' AND c.contype='f';
    IF fk_definition <> 'foreignkeypartner_org_idreferencespartner_organizationsidondeleterestrict' THEN
      RAISE EXCEPTION 'partner_referral_click_receipts has incompatible Partner FK: %', fk_definition;
    END IF;
    SELECT string_agg(c.conname,',' ORDER BY c.conname) INTO actual_constraints
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
     WHERE n.nspname='public' AND t.relname='partner_referral_click_receipts';
    IF actual_constraints <> 'ck_partner_referral_click_receipt_completion,ck_partner_referral_click_receipt_hash,ck_partner_referral_click_receipt_key,ck_partner_referral_click_receipt_status,partner_referral_click_receipts_partner_org_id_fkey,partner_referral_click_receipts_pkey' THEN
      RAISE EXCEPTION 'partner_referral_click_receipts has incompatible constraints: %', actual_constraints;
    END IF;
  END IF;

  IF to_regclass('public.idx_partner_clicks_abuse_window') IS NOT NULL THEN
    SELECT lower(regexp_replace(pg_get_indexdef(indexrelid),'[[:space:]()]','','g')) INTO index_definition
      FROM pg_index WHERE indexrelid='public.idx_partner_clicks_abuse_window'::regclass;
    IF index_definition NOT LIKE 'createindexidx_partner_clicks_abuse_windowonpublic.partner_referral_clicksusingbtreepartner_org_id,ip_hash,clicked_atdesc%' THEN
      RAISE EXCEPTION 'idx_partner_clicks_abuse_window is incompatible: %', index_definition;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS partner_referral_click_receipts (
  partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  server_request_id UUID NOT NULL,
  click_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROCESSING',
  response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY(partner_org_id,idempotency_key),
  CONSTRAINT ck_partner_referral_click_receipt_key CHECK(length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  CONSTRAINT ck_partner_referral_click_receipt_hash CHECK(request_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_partner_referral_click_receipt_status CHECK(status IN ('PROCESSING','COMPLETED')),
  CONSTRAINT ck_partner_referral_click_receipt_completion CHECK(
    (status='PROCESSING' AND response_json IS NULL AND completed_at IS NULL) OR
    (status='COMPLETED' AND response_json IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_partner_clicks_abuse_window
  ON partner_referral_clicks(partner_org_id,ip_hash,clicked_at DESC);
