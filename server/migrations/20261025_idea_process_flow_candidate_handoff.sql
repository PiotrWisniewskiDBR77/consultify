-- FLOW-TRANSFORM-MVP-001: immutable Process Flow map -> Initiative Candidate.
DO $$
BEGIN
  IF to_regclass('public.idea_process_flow_candidate_handoffs') IS NULL THEN
    CREATE TABLE public.idea_process_flow_candidate_handoffs (
      receipt_id TEXT CONSTRAINT pk_idea_process_flow_candidate_handoff PRIMARY KEY,
      organization_id TEXT NOT NULL,
      idea_id TEXT NOT NULL,
      map_id TEXT NOT NULL,
      map_version INTEGER NOT NULL CONSTRAINT ck_idea_process_flow_handoff_version CHECK (map_version > 0),
      projection_hash TEXT NOT NULL CONSTRAINT ck_idea_process_flow_handoff_hash CHECK (projection_hash ~ '^[0-9a-f]{64}$'),
      projection_json JSONB NOT NULL CONSTRAINT ck_idea_process_flow_handoff_projection CHECK (jsonb_typeof(projection_json)='object'),
      candidate_id TEXT NOT NULL,
      approved_by TEXT NOT NULL,
      approved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='idea_process_flow_candidate_handoffs'
      GROUP BY table_schema,table_name HAVING count(*)=10
    ) OR EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='idea_process_flow_candidate_handoffs'
        AND column_name IN ('receipt_id','organization_id','idea_id','map_id','projection_hash','candidate_id','approved_by')
        AND (data_type <> 'text' OR is_nullable <> 'NO')
    ) THEN
      RAISE EXCEPTION 'idea_process_flow_candidate_handoffs has incompatible text shape';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='idea_process_flow_candidate_handoffs' AND column_name='map_version' AND data_type='integer' AND is_nullable='NO')
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='idea_process_flow_candidate_handoffs' AND column_name='projection_json' AND data_type='jsonb' AND is_nullable='NO')
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='idea_process_flow_candidate_handoffs' AND column_name='approved_at' AND data_type='timestamp with time zone' AND is_nullable='NO' AND column_default ILIKE '%CURRENT_TIMESTAMP%') THEN
      RAISE EXCEPTION 'idea_process_flow_candidate_handoffs has incompatible typed shape';
    END IF;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_idea_process_flow_handoff_snapshot
  ON public.idea_process_flow_candidate_handoffs
  (organization_id,map_id,projection_hash);
CREATE UNIQUE INDEX IF NOT EXISTS uq_idea_process_flow_handoff_candidate
  ON public.idea_process_flow_candidate_handoffs (organization_id,candidate_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.idea_process_flow_candidate_handoffs'::regclass AND c.conname='pk_idea_process_flow_candidate_handoff' AND c.contype='p'
       AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='receipt_id')]::smallint[])
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.idea_process_flow_candidate_handoffs'::regclass AND conname='ck_idea_process_flow_handoff_version' AND contype='c' AND regexp_replace(pg_get_constraintdef(oid),'\s+','','g')='CHECK((map_version>0))')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.idea_process_flow_candidate_handoffs'::regclass AND conname='ck_idea_process_flow_handoff_hash' AND contype='c' AND regexp_replace(pg_get_constraintdef(oid),'\s+','','g')='CHECK((projection_hash~''^[0-9a-f]{64}$''::text))')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.idea_process_flow_candidate_handoffs'::regclass AND conname='ck_idea_process_flow_handoff_projection' AND contype='c' AND regexp_replace(pg_get_constraintdef(oid),'\s+','','g')='CHECK((jsonb_typeof(projection_json)=''object''::text))') THEN
    RAISE EXCEPTION 'idea_process_flow_candidate_handoffs constraints are incompatible';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uq_idea_process_flow_handoff_snapshot' AND regexp_replace(indexdef,'\s+','','g') LIKE '%UNIQUEINDEXuq_idea_process_flow_handoff_snapshotONpublic.idea_process_flow_candidate_handoffsUSINGbtree(organization_id,map_id,projection_hash)%')
     OR NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uq_idea_process_flow_handoff_candidate' AND regexp_replace(indexdef,'\s+','','g') LIKE '%UNIQUEINDEXuq_idea_process_flow_handoff_candidateONpublic.idea_process_flow_candidate_handoffsUSINGbtree(organization_id,candidate_id)%') THEN
    RAISE EXCEPTION 'idea_process_flow_candidate_handoffs indexes are incompatible';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_index i WHERE i.indexrelid IN (
      'public.uq_idea_process_flow_handoff_snapshot'::regclass,
      'public.uq_idea_process_flow_handoff_candidate'::regclass
    ) AND (NOT i.indisunique OR NOT i.indisvalid OR NOT i.indisready OR i.indpred IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'idea_process_flow_candidate_handoffs index properties are incompatible';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.protect_idea_process_flow_candidate_handoff()') IS NULL THEN
    EXECUTE $fn$CREATE FUNCTION public.protect_idea_process_flow_candidate_handoff()
      RETURNS trigger LANGUAGE plpgsql IMMUTABLE AS $body$
      BEGIN RAISE EXCEPTION 'idea_process_flow_candidate_handoffs is immutable'; END;
      $body$ $fn$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
    WHERE p.oid='public.protect_idea_process_flow_candidate_handoff()'::regprocedure
      AND n.nspname='public' AND l.lanname='plpgsql' AND p.provolatile='i'
      AND p.prokind='f' AND p.pronargs=0 AND p.prosecdef=FALSE AND p.proleakproof=FALSE
      AND p.proparallel='u' AND p.proconfig IS NULL AND p.prorettype='trigger'::regtype
      AND regexp_replace(p.prosrc,'\s+','','g')='BEGINRAISEEXCEPTION''idea_process_flow_candidate_handoffsisimmutable'';END;'
  ) THEN
    RAISE EXCEPTION 'protect_idea_process_flow_candidate_handoff has incompatible body';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.idea_process_flow_candidate_handoffs'::regclass AND tgname='trg_idea_process_flow_candidate_handoff_immutable') THEN
    CREATE TRIGGER trg_idea_process_flow_candidate_handoff_immutable
      BEFORE UPDATE OR DELETE ON public.idea_process_flow_candidate_handoffs
      FOR EACH ROW EXECUTE FUNCTION public.protect_idea_process_flow_candidate_handoff();
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid='public.idea_process_flow_candidate_handoffs'::regclass
      AND tgname='trg_idea_process_flow_candidate_handoff_immutable' AND NOT tgisinternal
      AND tgenabled='O' AND tgtype=27
      AND tgfoid='public.protect_idea_process_flow_candidate_handoff()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'trg_idea_process_flow_candidate_handoff_immutable has incompatible definition';
  END IF;
END $$;
