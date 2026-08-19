-- DATA-DR-001: durable backup/restore receipts and hostile catalog validation.
CREATE TABLE IF NOT EXISTS public.backup_source_change_clock (
  id TEXT CONSTRAINT backup_source_change_clock_pkey PRIMARY KEY,
  version BIGINT NOT NULL DEFAULT 0 CONSTRAINT backup_source_change_clock_version_nonnegative CHECK (version >= 0),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.backup_source_change_clock(id,version,changed_at)
VALUES('canonical-owner-graph',0,NOW()) ON CONFLICT(id) DO NOTHING;

DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='backup_source_change_clock')<>3 THEN
    RAISE EXCEPTION 'backup_source_change_clock has incompatible columns';
  END IF;
  IF EXISTS (
    WITH expected(name,data_type,nullable,column_default) AS (VALUES
      ('id','text','NO',NULL::text),('version','bigint','NO','0'),('changed_at','timestamp with time zone','NO','now()'))
    SELECT 1 FROM expected e LEFT JOIN information_schema.columns c
      ON c.table_schema='public' AND c.table_name='backup_source_change_clock' AND c.column_name=e.name
    WHERE c.column_name IS NULL OR c.data_type<>e.data_type OR c.is_nullable<>e.nullable
      OR coalesce(c.column_default,'')<>coalesce(e.column_default,'')
  ) THEN RAISE EXCEPTION 'backup_source_change_clock column contract is incompatible'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.backup_source_change_clock'::regclass
      AND c.contype='p' AND c.conname='backup_source_change_clock_pkey'
      AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='id')]::smallint[]
  ) THEN RAISE EXCEPTION 'backup_source_change_clock primary key is incompatible'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.backup_source_change_clock'::regclass
      AND c.contype='c' AND c.conname='backup_source_change_clock_version_nonnegative'
      AND pg_get_expr(c.conbin,c.conrelid)='(version >= 0)'::text
  ) OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.backup_source_change_clock'::regclass AND contype='c')<>1 THEN
    RAISE EXCEPTION 'backup_source_change_clock check is incompatible';
  END IF;
  IF (SELECT count(*) FROM public.backup_source_change_clock)<>1 OR
     NOT EXISTS (SELECT 1 FROM public.backup_source_change_clock WHERE id='canonical-owner-graph') THEN
    RAISE EXCEPTION 'backup_source_change_clock singleton is incompatible';
  END IF;
  IF to_regprocedure('public.bump_backup_source_change_clock()') IS NULL THEN
    EXECUTE $fn$CREATE FUNCTION public.bump_backup_source_change_clock() RETURNS trigger LANGUAGE plpgsql VOLATILE AS $body$
      BEGIN
        UPDATE public.backup_source_change_clock SET version=version+1,changed_at=clock_timestamp() WHERE id='canonical-owner-graph';
        RETURN NULL;
      END
    $body$ $fn$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
    WHERE n.nspname='public' AND p.proname='bump_backup_source_change_clock' AND p.pronargs=0
      AND p.prorettype='trigger'::regtype AND l.lanname='plpgsql' AND p.provolatile='v' AND p.prosecdef=false
      AND p.proleakproof=false AND p.proisstrict=false AND p.proparallel='u'
      AND trim(regexp_replace(p.prosrc,'\s+',' ','g'))=
        'BEGIN UPDATE public.backup_source_change_clock SET version=version+1,changed_at=clock_timestamp() WHERE id=''canonical-owner-graph''; RETURN NULL; END'
  ) THEN RAISE EXCEPTION 'backup source clock function is incompatible'; END IF;
END $$;

DO $$
DECLARE table_name text; trigger_row record;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['organizations','users','organization_members'] LOOP
    SELECT t.oid,t.tgtype,t.tgenabled,t.tgisinternal,t.tgfoid INTO trigger_row
    FROM pg_trigger t WHERE t.tgrelid=format('public.%I',table_name)::regclass
      AND t.tgname=('backup_source_clock_'||table_name);
    IF trigger_row.oid IS NULL THEN
      EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.bump_backup_source_change_clock()',
        'backup_source_clock_'||table_name,table_name);
    ELSIF trigger_row.tgtype<>28 OR trigger_row.tgenabled<>'O' OR trigger_row.tgisinternal
      OR trigger_row.tgfoid<>'public.bump_backup_source_change_clock()'::regprocedure THEN
      RAISE EXCEPTION 'backup source clock trigger is incompatible for %',table_name;
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.backup_run_receipts') IS NULL THEN
    CREATE TABLE public.backup_run_receipts (
      id TEXT CONSTRAINT backup_run_receipts_pkey PRIMARY KEY,
      schedule_name TEXT NOT NULL,
      scheduled_for TIMESTAMPTZ NOT NULL,
      lease_token TEXT NOT NULL,
      fence BIGINT NOT NULL DEFAULT 1 CONSTRAINT backup_run_receipts_fence_positive CHECK (fence > 0),
      lease_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '20 minutes'),
      status TEXT NOT NULL CONSTRAINT backup_run_receipts_status_check CHECK (status IN ('CLAIMED','COMPLETED','FAILED','MISSED')),
      backup_id TEXT,
      source_watermark TIMESTAMPTZ,
      source_observed_at TIMESTAMPTZ,
      rpo_seconds INTEGER CONSTRAINT backup_run_receipts_rpo_nonnegative CHECK (rpo_seconds IS NULL OR rpo_seconds >= 0),
      rpo_threshold_seconds INTEGER NOT NULL DEFAULT 900 CONSTRAINT backup_run_receipts_threshold_positive CHECK (rpo_threshold_seconds > 0),
      artifact_sha256 TEXT CONSTRAINT backup_run_receipts_sha_check CHECK (artifact_sha256 IS NULL OR artifact_sha256 ~ '^[0-9a-f]{64}$'),
      plaintext_sha256 TEXT CONSTRAINT backup_run_receipts_plaintext_sha_check CHECK (plaintext_sha256 IS NULL OR plaintext_sha256 ~ '^[0-9a-f]{64}$'),
      source_sha256 TEXT CONSTRAINT backup_run_receipts_source_sha_check CHECK (source_sha256 IS NULL OR source_sha256 ~ '^[0-9a-f]{64}$'),
      key_id TEXT NOT NULL CONSTRAINT backup_run_receipts_key_id_check CHECK (length(trim(key_id)) BETWEEN 1 AND 128),
      error_code TEXT,
      claimed_at TIMESTAMPTZ NOT NULL,
      completed_at TIMESTAMPTZ,
      CONSTRAINT backup_run_receipts_terminal_shape_check CHECK (
        (status='CLAIMED' AND completed_at IS NULL AND backup_id IS NULL) OR
        (status IN ('COMPLETED','MISSED') AND completed_at IS NOT NULL AND backup_id IS NOT NULL AND source_watermark IS NOT NULL
          AND source_observed_at IS NOT NULL AND rpo_seconds IS NOT NULL AND artifact_sha256 IS NOT NULL
          AND plaintext_sha256 IS NOT NULL AND source_sha256 IS NOT NULL) OR
        (status='FAILED' AND completed_at IS NOT NULL)
      )
    );
  END IF;

  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='backup_run_receipts') <> 19 THEN
    RAISE EXCEPTION 'backup_run_receipts has incompatible columns';
  END IF;
  IF EXISTS (
    WITH expected(name,data_type,nullable,column_default) AS (VALUES
      ('id','text','NO',NULL::text),('schedule_name','text','NO',NULL),('scheduled_for','timestamp with time zone','NO',NULL),
      ('lease_token','text','NO',NULL),('fence','bigint','NO','1'),('lease_expires_at','timestamp with time zone','NO','(now() + ''00:20:00''::interval)'),
      ('status','text','NO',NULL),('backup_id','text','YES',NULL),('source_watermark','timestamp with time zone','YES',NULL),
      ('source_observed_at','timestamp with time zone','YES',NULL),('rpo_seconds','integer','YES',NULL),('rpo_threshold_seconds','integer','NO','900'),
      ('artifact_sha256','text','YES',NULL),('plaintext_sha256','text','YES',NULL),('source_sha256','text','YES',NULL),('key_id','text','NO',NULL),('error_code','text','YES',NULL),
      ('claimed_at','timestamp with time zone','NO',NULL),('completed_at','timestamp with time zone','YES',NULL))
    SELECT 1 FROM expected e LEFT JOIN information_schema.columns c
      ON c.table_schema='public' AND c.table_name='backup_run_receipts' AND c.column_name=e.name
    WHERE c.column_name IS NULL OR c.data_type<>e.data_type OR c.is_nullable<>e.nullable
      OR coalesce(c.column_default,'')<>coalesce(e.column_default,'')
  ) THEN RAISE EXCEPTION 'backup_run_receipts has incompatible column contract'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.backup_run_receipts'::regclass AND c.contype='p' AND c.conname='backup_run_receipts_pkey'
      AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='id')]::smallint[]
  ) THEN RAISE EXCEPTION 'backup_run_receipts primary key is incompatible'; END IF;

  CREATE TEMP TABLE data_dr_expected_run_checks (
    fence BIGINT CONSTRAINT expected_fence CHECK (fence > 0),
    status TEXT CONSTRAINT expected_status CHECK (status IN ('CLAIMED','COMPLETED','FAILED','MISSED')),
    source_watermark TIMESTAMPTZ, source_observed_at TIMESTAMPTZ,
    rpo_seconds INTEGER CONSTRAINT expected_rpo CHECK (rpo_seconds IS NULL OR rpo_seconds >= 0),
    rpo_threshold_seconds INTEGER CONSTRAINT expected_threshold CHECK (rpo_threshold_seconds > 0),
    artifact_sha256 TEXT CONSTRAINT expected_artifact_sha CHECK (artifact_sha256 IS NULL OR artifact_sha256 ~ '^[0-9a-f]{64}$'),
    plaintext_sha256 TEXT CONSTRAINT expected_plaintext_sha CHECK (plaintext_sha256 IS NULL OR plaintext_sha256 ~ '^[0-9a-f]{64}$'),
    source_sha256 TEXT CONSTRAINT expected_source_sha CHECK (source_sha256 IS NULL OR source_sha256 ~ '^[0-9a-f]{64}$'),
    key_id TEXT CONSTRAINT expected_key_id CHECK (length(trim(key_id)) BETWEEN 1 AND 128),
    backup_id TEXT, completed_at TIMESTAMPTZ,
    CONSTRAINT expected_terminal CHECK (
      (status='CLAIMED' AND completed_at IS NULL AND backup_id IS NULL) OR
      (status IN ('COMPLETED','MISSED') AND completed_at IS NOT NULL AND backup_id IS NOT NULL AND source_watermark IS NOT NULL
        AND source_observed_at IS NOT NULL AND rpo_seconds IS NOT NULL AND artifact_sha256 IS NOT NULL
        AND plaintext_sha256 IS NOT NULL AND source_sha256 IS NOT NULL) OR
      (status='FAILED' AND completed_at IS NOT NULL)
    )
  ) ON COMMIT DROP;
  IF EXISTS (
    WITH mapping(actual_name,expected_name) AS (VALUES
      ('backup_run_receipts_fence_positive','expected_fence'),('backup_run_receipts_status_check','expected_status'),
      ('backup_run_receipts_rpo_nonnegative','expected_rpo'),('backup_run_receipts_threshold_positive','expected_threshold'),
      ('backup_run_receipts_sha_check','expected_artifact_sha'),('backup_run_receipts_plaintext_sha_check','expected_plaintext_sha'),
      ('backup_run_receipts_source_sha_check','expected_source_sha'),('backup_run_receipts_key_id_check','expected_key_id'),
      ('backup_run_receipts_terminal_shape_check','expected_terminal'))
    SELECT 1 FROM mapping m
    LEFT JOIN pg_constraint a ON a.conrelid='public.backup_run_receipts'::regclass AND a.conname=m.actual_name AND a.contype='c'
    LEFT JOIN pg_constraint e ON e.conrelid='data_dr_expected_run_checks'::regclass AND e.conname=m.expected_name AND e.contype='c'
    WHERE a.oid IS NULL OR e.oid IS NULL OR pg_get_expr(a.conbin,a.conrelid)<>pg_get_expr(e.conbin,e.conrelid)
  ) THEN RAISE EXCEPTION 'backup_run_receipts checks are incompatible'; END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.backup_run_receipts'::regclass AND contype='c')<>9 THEN
    RAISE EXCEPTION 'backup_run_receipts has extra checks';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS backup_run_receipts_schedule_slot_uidx ON public.backup_run_receipts(schedule_name, scheduled_for);
CREATE INDEX IF NOT EXISTS backup_run_receipts_status_lease_idx ON public.backup_run_receipts(status, lease_expires_at);

DO $$
BEGIN
  IF to_regprocedure('public.protect_backup_run_receipt_terminal()') IS NULL THEN
    EXECUTE $fn$CREATE FUNCTION public.protect_backup_run_receipt_terminal() RETURNS trigger LANGUAGE plpgsql VOLATILE AS $body$
      BEGIN
        IF OLD.status IN ('COMPLETED','FAILED','MISSED') THEN RAISE EXCEPTION 'backup_run_receipts terminal rows are immutable'; END IF;
        IF TG_OP='DELETE' THEN RAISE EXCEPTION 'backup_run_receipts rows are append-only'; END IF;
        RETURN NEW;
      END
    $body$ $fn$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
    WHERE n.nspname='public' AND p.proname='protect_backup_run_receipt_terminal' AND p.pronargs=0
      AND p.prorettype='trigger'::regtype AND l.lanname='plpgsql' AND p.provolatile='v' AND p.prosecdef=false
      AND p.proleakproof=false AND p.proisstrict=false AND p.proparallel='u'
      AND trim(regexp_replace(p.prosrc, '\s+', ' ', 'g')) =
        'BEGIN IF OLD.status IN (''COMPLETED'',''FAILED'',''MISSED'') THEN RAISE EXCEPTION ''backup_run_receipts terminal rows are immutable''; END IF; IF TG_OP=''DELETE'' THEN RAISE EXCEPTION ''backup_run_receipts rows are append-only''; END IF; RETURN NEW; END'
  ) THEN RAISE EXCEPTION 'protect_backup_run_receipt_terminal has incompatible definition'; END IF;
END $$;

DO $$
DECLARE trigger_row record;
BEGIN
  SELECT t.oid,t.tgtype,t.tgenabled,t.tgisinternal,t.tgfoid INTO trigger_row
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='backup_run_receipts' AND t.tgname='backup_run_receipts_terminal_immutable';
  IF trigger_row.oid IS NULL THEN
    CREATE TRIGGER backup_run_receipts_terminal_immutable BEFORE UPDATE OR DELETE ON public.backup_run_receipts
      FOR EACH ROW EXECUTE FUNCTION public.protect_backup_run_receipt_terminal();
  ELSIF trigger_row.tgtype<>27 OR trigger_row.tgenabled<>'O' OR trigger_row.tgisinternal
    OR trigger_row.tgfoid<>'public.protect_backup_run_receipt_terminal()'::regprocedure THEN
    RAISE EXCEPTION 'backup_run_receipts immutable trigger is incompatible';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='backup_run_receipts_schedule_slot_uidx' AND i.indisunique AND i.indisvalid AND i.indisready
      AND pg_get_expr(i.indpred,i.indrelid) IS NULL AND i.indnkeyatts=2
      AND i.indoption::text='0 0'
      AND i.indkey::text=(SELECT string_agg(attnum::text,' ' ORDER BY ord) FROM unnest(ARRAY['schedule_name','scheduled_for']) WITH ORDINALITY x(name,ord)
        JOIN pg_attribute a ON a.attrelid='public.backup_run_receipts'::regclass AND a.attname=x.name)
  ) THEN RAISE EXCEPTION 'backup_run_receipts slot index is incompatible'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='backup_run_receipts_status_lease_idx' AND NOT i.indisunique AND i.indisvalid AND i.indisready
      AND pg_get_expr(i.indpred,i.indrelid) IS NULL AND i.indnkeyatts=2
      AND i.indoption::text='0 0'
      AND i.indkey::text=(SELECT string_agg(attnum::text,' ' ORDER BY ord) FROM unnest(ARRAY['status','lease_expires_at']) WITH ORDINALITY x(name,ord)
        JOIN pg_attribute a ON a.attrelid='public.backup_run_receipts'::regclass AND a.attname=x.name)
  ) THEN RAISE EXCEPTION 'backup_run_receipts lease index is incompatible'; END IF;
  IF (SELECT count(*) FROM pg_index WHERE indrelid='public.backup_run_receipts'::regclass)<>3 THEN
    RAISE EXCEPTION 'backup_run_receipts has extra indexes';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.backup_restore_receipts (
  id TEXT CONSTRAINT backup_restore_receipts_pkey PRIMARY KEY,
  backup_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  source_database TEXT NOT NULL,
  target_database TEXT NOT NULL,
  status TEXT NOT NULL CONSTRAINT backup_restore_receipts_status_check CHECK (status IN ('STARTED','COMPLETED','FAILED','COMMITTED_UNVERIFIED')),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  rto_seconds INTEGER CONSTRAINT backup_restore_receipts_rto_nonnegative CHECK (rto_seconds IS NULL OR rto_seconds >= 0),
  rto_threshold_seconds INTEGER NOT NULL DEFAULT 3600 CONSTRAINT backup_restore_receipts_threshold_positive CHECK (rto_threshold_seconds > 0),
  rto_met BOOLEAN,
  restored_rows INTEGER CONSTRAINT backup_restore_receipts_rows_nonnegative CHECK (restored_rows IS NULL OR restored_rows >= 0),
  source_sha256 TEXT CONSTRAINT backup_restore_receipts_source_sha_check CHECK (source_sha256 IS NULL OR source_sha256 ~ '^[0-9a-f]{64}$'),
  error_code TEXT,
  CONSTRAINT backup_restore_receipts_terminal_shape_check CHECK (
    (status='STARTED' AND completed_at IS NULL) OR
    (status='COMPLETED' AND completed_at IS NOT NULL AND rto_seconds IS NOT NULL AND rto_met IS NOT NULL AND restored_rows IS NOT NULL AND source_sha256 IS NOT NULL) OR
    (status IN ('FAILED','COMMITTED_UNVERIFIED') AND completed_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS backup_restore_receipts_backup_started_idx ON public.backup_restore_receipts(backup_id, started_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='backup_restore_receipts_backup_started_idx' AND NOT i.indisunique
      AND i.indisvalid AND i.indisready AND pg_get_expr(i.indpred,i.indrelid) IS NULL AND i.indnkeyatts=2
      AND i.indoption::text='0 3'
      AND i.indkey::text=(SELECT string_agg(attnum::text,' ' ORDER BY ord) FROM unnest(ARRAY['backup_id','started_at']) WITH ORDINALITY x(name,ord)
        JOIN pg_attribute a ON a.attrelid='public.backup_restore_receipts'::regclass AND a.attname=x.name)
  ) THEN RAISE EXCEPTION 'backup_restore_receipts index is incompatible'; END IF;
  IF (SELECT count(*) FROM pg_index WHERE indrelid='public.backup_restore_receipts'::regclass)<>2 THEN
    RAISE EXCEPTION 'backup_restore_receipts has extra indexes';
  END IF;
END $$;

DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='backup_restore_receipts')<>14 THEN
    RAISE EXCEPTION 'backup_restore_receipts has incompatible columns';
  END IF;
  IF EXISTS (
    WITH expected(name,data_type,nullable,column_default) AS (VALUES
      ('id','text','NO',NULL::text),('backup_id','text','NO',NULL),('actor_id','text','NO',NULL),
      ('source_database','text','NO',NULL),('target_database','text','NO',NULL),('status','text','NO',NULL),
      ('started_at','timestamp with time zone','NO',NULL),('completed_at','timestamp with time zone','YES',NULL),
      ('rto_seconds','integer','YES',NULL),('rto_threshold_seconds','integer','NO','3600'),('rto_met','boolean','YES',NULL),
      ('restored_rows','integer','YES',NULL),('source_sha256','text','YES',NULL),('error_code','text','YES',NULL))
    SELECT 1 FROM expected e LEFT JOIN information_schema.columns c
      ON c.table_schema='public' AND c.table_name='backup_restore_receipts' AND c.column_name=e.name
    WHERE c.column_name IS NULL OR c.data_type<>e.data_type OR c.is_nullable<>e.nullable
      OR coalesce(c.column_default,'')<>coalesce(e.column_default,'')
  ) THEN RAISE EXCEPTION 'backup_restore_receipts has incompatible column contract'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.backup_restore_receipts'::regclass
      AND c.contype='p' AND c.conname='backup_restore_receipts_pkey'
      AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='id')]::smallint[]
  ) THEN RAISE EXCEPTION 'backup_restore_receipts primary key is incompatible'; END IF;
  IF (SELECT count(*) FROM pg_constraint c WHERE c.conrelid='public.backup_restore_receipts'::regclass AND c.contype='c'
    AND c.conname IN ('backup_restore_receipts_status_check','backup_restore_receipts_rto_nonnegative',
      'backup_restore_receipts_threshold_positive','backup_restore_receipts_rows_nonnegative',
      'backup_restore_receipts_source_sha_check','backup_restore_receipts_terminal_shape_check'))<>6 THEN
    RAISE EXCEPTION 'backup_restore_receipts checks are incompatible';
  END IF;
  CREATE TEMP TABLE data_dr_expected_restore_checks (
    status TEXT CONSTRAINT expected_restore_status CHECK (status IN ('STARTED','COMPLETED','FAILED','COMMITTED_UNVERIFIED')),
    completed_at TIMESTAMPTZ,
    rto_seconds INTEGER CONSTRAINT expected_restore_rto CHECK (rto_seconds IS NULL OR rto_seconds >= 0),
    rto_threshold_seconds INTEGER CONSTRAINT expected_restore_threshold CHECK (rto_threshold_seconds > 0),
    rto_met BOOLEAN,
    restored_rows INTEGER CONSTRAINT expected_restore_rows CHECK (restored_rows IS NULL OR restored_rows >= 0),
    source_sha256 TEXT CONSTRAINT expected_restore_sha CHECK (source_sha256 IS NULL OR source_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT expected_restore_terminal CHECK (
      (status='STARTED' AND completed_at IS NULL) OR
      (status='COMPLETED' AND completed_at IS NOT NULL AND rto_seconds IS NOT NULL AND rto_met IS NOT NULL AND restored_rows IS NOT NULL AND source_sha256 IS NOT NULL) OR
      (status IN ('FAILED','COMMITTED_UNVERIFIED') AND completed_at IS NOT NULL)
    )
  ) ON COMMIT DROP;
  IF EXISTS (
    WITH mapping(actual_name,expected_name) AS (VALUES
      ('backup_restore_receipts_status_check','expected_restore_status'),
      ('backup_restore_receipts_rto_nonnegative','expected_restore_rto'),
      ('backup_restore_receipts_threshold_positive','expected_restore_threshold'),
      ('backup_restore_receipts_rows_nonnegative','expected_restore_rows'),
      ('backup_restore_receipts_source_sha_check','expected_restore_sha'),
      ('backup_restore_receipts_terminal_shape_check','expected_restore_terminal'))
    SELECT 1 FROM mapping m
    LEFT JOIN pg_constraint a ON a.conrelid='public.backup_restore_receipts'::regclass AND a.conname=m.actual_name AND a.contype='c'
    LEFT JOIN pg_constraint e ON e.conrelid='data_dr_expected_restore_checks'::regclass AND e.conname=m.expected_name AND e.contype='c'
    WHERE a.oid IS NULL OR e.oid IS NULL OR pg_get_expr(a.conbin,a.conrelid)<>pg_get_expr(e.conbin,e.conrelid)
  ) THEN RAISE EXCEPTION 'backup_restore_receipts check definitions are incompatible'; END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.backup_restore_receipts'::regclass AND contype='c')<>6 THEN
    RAISE EXCEPTION 'backup_restore_receipts has extra checks';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.protect_backup_restore_receipt_terminal()') IS NULL THEN
    EXECUTE $fn$CREATE FUNCTION public.protect_backup_restore_receipt_terminal() RETURNS trigger LANGUAGE plpgsql VOLATILE AS $body$
      BEGIN
        IF OLD.status IN ('COMPLETED','FAILED','COMMITTED_UNVERIFIED') THEN RAISE EXCEPTION 'backup_restore_receipts terminal rows are immutable'; END IF;
        IF TG_OP='DELETE' THEN RAISE EXCEPTION 'backup_restore_receipts rows are append-only'; END IF;
        RETURN NEW;
      END
    $body$ $fn$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
    WHERE n.nspname='public' AND p.proname='protect_backup_restore_receipt_terminal' AND p.pronargs=0
      AND p.prorettype='trigger'::regtype AND l.lanname='plpgsql' AND p.provolatile='v' AND p.prosecdef=false
      AND p.proleakproof=false AND p.proisstrict=false AND p.proparallel='u'
      AND trim(regexp_replace(p.prosrc, '\s+', ' ', 'g')) =
        'BEGIN IF OLD.status IN (''COMPLETED'',''FAILED'',''COMMITTED_UNVERIFIED'') THEN RAISE EXCEPTION ''backup_restore_receipts terminal rows are immutable''; END IF; IF TG_OP=''DELETE'' THEN RAISE EXCEPTION ''backup_restore_receipts rows are append-only''; END IF; RETURN NEW; END'
  ) THEN RAISE EXCEPTION 'protect_backup_restore_receipt_terminal has incompatible definition'; END IF;
END $$;

DO $$
DECLARE trigger_row record;
BEGIN
  SELECT t.oid,t.tgtype,t.tgenabled,t.tgisinternal,t.tgfoid INTO trigger_row
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='backup_restore_receipts' AND t.tgname='backup_restore_receipts_terminal_immutable';
  IF trigger_row.oid IS NULL THEN
    CREATE TRIGGER backup_restore_receipts_terminal_immutable BEFORE UPDATE OR DELETE ON public.backup_restore_receipts
      FOR EACH ROW EXECUTE FUNCTION public.protect_backup_restore_receipt_terminal();
  ELSIF trigger_row.tgtype<>27 OR trigger_row.tgenabled<>'O' OR trigger_row.tgisinternal
    OR trigger_row.tgfoid<>'public.protect_backup_restore_receipt_terminal()'::regprocedure THEN
    RAISE EXCEPTION 'backup_restore_receipts immutable trigger is incompatible';
  END IF;
END $$;

-- Migration 957 created this append-only audit contract. Validate it exactly here.
DO $$
DECLARE trigger_row record;
BEGIN
  IF to_regclass('public.backup_access_audit') IS NULL OR to_regprocedure('public.prevent_backup_access_audit_mutation()') IS NULL THEN
    RAISE EXCEPTION 'backup_access_audit contract is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
    WHERE n.nspname='public' AND p.proname='prevent_backup_access_audit_mutation' AND p.pronargs=0
      AND p.prorettype='trigger'::regtype AND l.lanname='plpgsql' AND p.provolatile='v' AND p.prosecdef=false
      AND p.proleakproof=false AND p.proisstrict=false AND p.proparallel='u'
      AND trim(regexp_replace(p.prosrc, '\s+', ' ', 'g')) = 'BEGIN RAISE EXCEPTION ''backup_access_audit is append-only''; END;'
  ) THEN RAISE EXCEPTION 'backup_access_audit function is incompatible'; END IF;
  SELECT t.oid,t.tgtype,t.tgenabled,t.tgisinternal,t.tgfoid INTO trigger_row
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='backup_access_audit' AND t.tgname='backup_access_audit_no_update';
  IF trigger_row.oid IS NULL OR trigger_row.tgtype<>27 OR trigger_row.tgenabled<>'O' OR trigger_row.tgisinternal
    OR trigger_row.tgfoid<>'public.prevent_backup_access_audit_mutation()'::regprocedure THEN
    RAISE EXCEPTION 'backup_access_audit trigger is incompatible';
  END IF;
END $$;
