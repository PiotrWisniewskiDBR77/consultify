-- IDEA-DOCUMENT-HANDOFF-SUBPACKET-001 — immutable legacy conversion receipts.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('idempotency_key'::text, 'text'::text),
    ('source_content_hash', 'text'),
    ('response_json', 'text')
  ) AS required(name, data_type)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='my_idea_conversions'
         AND column_name=c.name
         AND (data_type<>c.data_type OR is_nullable<>'YES' OR column_default IS NOT NULL)
    ) THEN RAISE EXCEPTION 'incompatible my_idea_conversions.%', c.name; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='my_idea_conversions' AND column_name=c.name
    ) THEN
      EXECUTE format('ALTER TABLE public.my_idea_conversions ADD COLUMN %I TEXT', c.name);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='my_idea_conversion_receipt_shape_check') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname='my_idea_conversion_receipt_shape_check'
         AND conrelid='public.my_idea_conversions'::regclass
         AND regexp_replace(pg_get_constraintdef(oid), '\s+', '', 'g') = regexp_replace(
           'CHECK ((((idempotency_key IS NULL) AND (source_content_hash IS NULL) AND (response_json IS NULL)) OR ((btrim(idempotency_key) <> ''''::text) AND (source_content_hash ~ ''^[0-9a-f]{64}$''::text) AND (jsonb_typeof((response_json)::jsonb) = ''object''::text))))',
           '\s+', '', 'g'
         )
    ) THEN RAISE EXCEPTION 'hostile my_idea_conversion_receipt_shape_check'; END IF;
  ELSE
    ALTER TABLE public.my_idea_conversions
      ADD CONSTRAINT my_idea_conversion_receipt_shape_check CHECK (
        (idempotency_key IS NULL AND source_content_hash IS NULL AND response_json IS NULL)
        OR (btrim(idempotency_key) <> '' AND source_content_hash ~ '^[0-9a-f]{64}$'
            AND jsonb_typeof(response_json::jsonb) = 'object')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname='uq_my_idea_conversions_org_idempotency') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_index i JOIN pg_class idx ON idx.oid=i.indexrelid
       WHERE idx.relnamespace='public'::regnamespace
         AND idx.relname='uq_my_idea_conversions_org_idempotency'
         AND i.indisunique AND i.indisvalid AND i.indisready
         AND i.indrelid='public.my_idea_conversions'::regclass
         AND i.indkey::text = (
           SELECT string_agg(attnum::text, ' ' ORDER BY ord)
             FROM unnest(ARRAY['organization_id','idempotency_key']) WITH ORDINALITY n(name,ord)
             JOIN pg_attribute a ON a.attrelid='public.my_idea_conversions'::regclass AND a.attname=n.name
         )
         AND pg_get_expr(i.indpred, i.indrelid)='(idempotency_key IS NOT NULL)'
    ) THEN RAISE EXCEPTION 'hostile uq_my_idea_conversions_org_idempotency'; END IF;
  ELSE
    CREATE UNIQUE INDEX uq_my_idea_conversions_org_idempotency
      ON public.my_idea_conversions (organization_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL;
  END IF;
END $$;

DO $$
DECLARE expected_body text := regexp_replace(
  'BEGIN IF OLD.idempotency_key IS DISTINCT FROM NEW.idempotency_key OR OLD.source_content_hash IS DISTINCT FROM NEW.source_content_hash OR OLD.response_json IS DISTINCT FROM NEW.response_json THEN RAISE EXCEPTION ''idea conversion receipt fields are immutable''; END IF; RETURN NEW; END',
  '\s+', '', 'g'
);
BEGIN
  IF to_regprocedure('public.protect_my_idea_conversion_receipt()') IS NULL THEN
    EXECUTE $fn$
      CREATE FUNCTION public.protect_my_idea_conversion_receipt()
      RETURNS trigger LANGUAGE plpgsql AS $body$
      BEGIN
        IF OLD.idempotency_key IS DISTINCT FROM NEW.idempotency_key
           OR OLD.source_content_hash IS DISTINCT FROM NEW.source_content_hash
           OR OLD.response_json IS DISTINCT FROM NEW.response_json THEN
          RAISE EXCEPTION 'idea conversion receipt fields are immutable';
        END IF;
        RETURN NEW;
      END
      $body$
    $fn$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE p.oid=to_regprocedure('public.protect_my_idea_conversion_receipt()')
       AND n.nspname='public' AND p.prorettype='trigger'::regtype
       AND p.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')
       AND NOT p.prosecdef AND NOT p.proisstrict AND p.provolatile='v'
       AND regexp_replace(p.prosrc, '\s+', '', 'g')=expected_body
  ) THEN RAISE EXCEPTION 'hostile protect_my_idea_conversion_receipt function'; END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid='public.my_idea_conversions'::regclass
       AND tgname='protect_my_idea_conversion_receipt' AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER protect_my_idea_conversion_receipt
    BEFORE UPDATE ON public.my_idea_conversions
    FOR EACH ROW EXECUTE FUNCTION public.protect_my_idea_conversion_receipt();
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid='public.my_idea_conversions'::regclass
       AND tgname='protect_my_idea_conversion_receipt' AND NOT tgisinternal
       AND tgtype=19
       AND tgfoid=to_regprocedure('public.protect_my_idea_conversion_receipt()')
  ) THEN RAISE EXCEPTION 'hostile protect_my_idea_conversion_receipt trigger'; END IF;
END $$;
