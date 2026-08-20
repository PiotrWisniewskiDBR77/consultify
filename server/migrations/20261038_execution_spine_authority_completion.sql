-- EXE-MVP-SPINE-001 / AMD-EXE-SPINE-AUTHORITY-004 (26A)
-- Migration-owned, immutable evidence for the explicit legacy identity
-- disposition. The migration deliberately does NOT execute a production
-- backfill: AMD-MVP-DATA-MIGRATION-GATE-003 requires separate execution
-- authorization. Application code may first produce a write-free plan and,
-- only when authorized, atomically record every legacy identity as either
-- mapped to the Runtime-v1 authority or quarantined.

CREATE TABLE IF NOT EXISTS execution_spine_backfill_runs (
  run_id UUID CONSTRAINT pk_execution_spine_backfill_runs PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL CONSTRAINT fk_execution_spine_backfill_org REFERENCES organizations(id),
  source_sha TEXT NOT NULL CONSTRAINT ck_execution_spine_backfill_source_sha CHECK (source_sha ~ '^[0-9a-f]{40}$'),
  plan_checksum TEXT NOT NULL CONSTRAINT ck_execution_spine_backfill_checksum CHECK (plan_checksum ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL CONSTRAINT ck_execution_spine_backfill_status CHECK (status IN ('COMPLETED','FAILED')),
  mapped_count INTEGER NOT NULL CONSTRAINT ck_execution_spine_backfill_mapped CHECK (mapped_count >= 0),
  quarantined_count INTEGER NOT NULL CONSTRAINT ck_execution_spine_backfill_quarantined CHECK (quarantined_count >= 0),
  total_count INTEGER NOT NULL CONSTRAINT ck_execution_spine_backfill_total CHECK (total_count = mapped_count + quarantined_count),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_execution_spine_backfill_run_plan UNIQUE (organization_id, source_sha, plan_checksum)
);

CREATE TABLE IF NOT EXISTS execution_spine_backfill_receipts (
  receipt_id UUID CONSTRAINT pk_execution_spine_backfill_receipts PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL CONSTRAINT fk_execution_spine_receipt_org REFERENCES organizations(id),
  run_id UUID NOT NULL CONSTRAINT fk_execution_spine_receipt_run REFERENCES execution_spine_backfill_runs(run_id),
  legacy_execution_link_id UUID NOT NULL CONSTRAINT fk_execution_spine_receipt_legacy_link REFERENCES execution_case_links(link_id),
  legacy_initiative_id TEXT NOT NULL CONSTRAINT fk_execution_spine_receipt_initiative REFERENCES initiatives(id),
  legacy_case_id TEXT NOT NULL CONSTRAINT fk_execution_spine_receipt_case REFERENCES case_core(case_id),
  canonical_execution_link_id UUID NOT NULL CONSTRAINT fk_execution_spine_receipt_canonical_link REFERENCES execution_case_links(link_id),
  source_digest TEXT NOT NULL CONSTRAINT ck_execution_spine_receipt_digest CHECK (source_digest ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_execution_spine_receipt_legacy_link UNIQUE (organization_id, legacy_execution_link_id),
  CONSTRAINT uq_execution_spine_receipt_legacy_initiative UNIQUE (organization_id, legacy_initiative_id),
  CONSTRAINT uq_execution_spine_receipt_legacy_case UNIQUE (organization_id, legacy_case_id)
);

CREATE TABLE IF NOT EXISTS execution_spine_identity_quarantine (
  quarantine_id UUID CONSTRAINT pk_execution_spine_identity_quarantine PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL CONSTRAINT fk_execution_spine_quarantine_org REFERENCES organizations(id),
  run_id UUID NOT NULL CONSTRAINT fk_execution_spine_quarantine_run REFERENCES execution_spine_backfill_runs(run_id),
  legacy_execution_link_id UUID NOT NULL CONSTRAINT fk_execution_spine_quarantine_legacy_link REFERENCES execution_case_links(link_id),
  legacy_initiative_id TEXT NOT NULL CONSTRAINT fk_execution_spine_quarantine_initiative REFERENCES initiatives(id),
  legacy_case_id TEXT NOT NULL CONSTRAINT fk_execution_spine_quarantine_case REFERENCES case_core(case_id),
  reason_code TEXT NOT NULL CONSTRAINT ck_execution_spine_quarantine_reason CHECK (reason_code IN (
    'NO_RUNTIME_V1_IDENTITY',
    'AMBIGUOUS_RUNTIME_V1_IDENTITY',
    'PROJECT_IDENTITY_MISMATCH',
    'DANGLING_LEGACY_IDENTITY'
  )),
  source_digest TEXT NOT NULL CONSTRAINT ck_execution_spine_quarantine_digest CHECK (source_digest ~ '^[0-9a-f]{64}$'),
  source_snapshot JSONB NOT NULL CONSTRAINT ck_execution_spine_quarantine_snapshot CHECK (jsonb_typeof(source_snapshot) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_execution_spine_quarantine_legacy_link UNIQUE (organization_id, legacy_execution_link_id),
  CONSTRAINT uq_execution_spine_quarantine_legacy_initiative UNIQUE (organization_id, legacy_initiative_id),
  CONSTRAINT uq_execution_spine_quarantine_legacy_case UNIQUE (organization_id, legacy_case_id)
);

DO $migration$
DECLARE
  actual text[];
BEGIN
  SELECT array_agg(attname||':'||format_type(atttypid,atttypmod)||':'||attnotnull ORDER BY attnum)
    INTO actual FROM pg_attribute
   WHERE attrelid='public.execution_spine_backfill_runs'::regclass AND attnum>0 AND NOT attisdropped;
  IF actual <> ARRAY[
    'run_id:uuid:true','organization_id:text:true','source_sha:text:true','plan_checksum:text:true',
    'status:text:true','mapped_count:integer:true','quarantined_count:integer:true','total_count:integer:true',
    'created_by:text:true','created_at:timestamp with time zone:true'
  ] THEN RAISE EXCEPTION 'execution_spine_backfill_runs has incompatible column shape'; END IF;

  SELECT array_agg(attname||':'||format_type(atttypid,atttypmod)||':'||attnotnull ORDER BY attnum)
    INTO actual FROM pg_attribute
   WHERE attrelid='public.execution_spine_backfill_receipts'::regclass AND attnum>0 AND NOT attisdropped;
  IF actual <> ARRAY[
    'receipt_id:uuid:true','organization_id:text:true','run_id:uuid:true','legacy_execution_link_id:uuid:true',
    'legacy_initiative_id:text:true','legacy_case_id:text:true','canonical_execution_link_id:uuid:true',
    'source_digest:text:true','created_at:timestamp with time zone:true'
  ] THEN RAISE EXCEPTION 'execution_spine_backfill_receipts has incompatible column shape'; END IF;

  SELECT array_agg(attname||':'||format_type(atttypid,atttypmod)||':'||attnotnull ORDER BY attnum)
    INTO actual FROM pg_attribute
   WHERE attrelid='public.execution_spine_identity_quarantine'::regclass AND attnum>0 AND NOT attisdropped;
  IF actual <> ARRAY[
    'quarantine_id:uuid:true','organization_id:text:true','run_id:uuid:true','legacy_execution_link_id:uuid:true',
    'legacy_initiative_id:text:true','legacy_case_id:text:true','reason_code:text:true','source_digest:text:true',
    'source_snapshot:jsonb:true','created_at:timestamp with time zone:true'
  ] THEN RAISE EXCEPTION 'execution_spine_identity_quarantine has incompatible column shape'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
     WHERE d.adrelid='public.execution_spine_backfill_runs'::regclass AND a.attname='run_id'
       AND regexp_replace(pg_get_expr(d.adbin,d.adrelid),'\s+','','g')='gen_random_uuid()'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
     WHERE d.adrelid='public.execution_spine_backfill_runs'::regclass AND a.attname='created_at'
       AND regexp_replace(pg_get_expr(d.adbin,d.adrelid),'\s+','','g')='now()'
  ) THEN RAISE EXCEPTION 'execution_spine_backfill_runs has incompatible defaults'; END IF;

  -- PostgreSQL 18 represents column NOT NULL attributes in pg_constraint as
  -- contype='n'. PostgreSQL 16 does not. Column nullability is verified above
  -- through pg_attribute, so exclude only that version-specific duplicate
  -- representation while retaining the exact fail-closed named-constraint
  -- inventory on both server versions.
  SELECT array_agg(conname ORDER BY conname) INTO actual FROM pg_constraint
   WHERE conrelid='public.execution_spine_backfill_runs'::regclass
     AND contype <> 'n';
  IF actual <> ARRAY[
    'ck_execution_spine_backfill_checksum','ck_execution_spine_backfill_mapped',
    'ck_execution_spine_backfill_quarantined','ck_execution_spine_backfill_source_sha',
    'ck_execution_spine_backfill_status','ck_execution_spine_backfill_total',
    'fk_execution_spine_backfill_org','pk_execution_spine_backfill_runs','uq_execution_spine_backfill_run_plan'
  ] THEN RAISE EXCEPTION 'execution_spine_backfill_runs has incompatible constraints'; END IF;

  SELECT array_agg(conname ORDER BY conname) INTO actual FROM pg_constraint
   WHERE conrelid='public.execution_spine_backfill_receipts'::regclass
     AND contype <> 'n';
  IF actual <> ARRAY[
    'ck_execution_spine_receipt_digest','fk_execution_spine_receipt_canonical_link',
    'fk_execution_spine_receipt_case','fk_execution_spine_receipt_initiative',
    'fk_execution_spine_receipt_legacy_link','fk_execution_spine_receipt_org',
    'fk_execution_spine_receipt_run','pk_execution_spine_backfill_receipts',
    'uq_execution_spine_receipt_legacy_case','uq_execution_spine_receipt_legacy_initiative',
    'uq_execution_spine_receipt_legacy_link'
  ] THEN RAISE EXCEPTION 'execution_spine_backfill_receipts has incompatible constraints'; END IF;

  SELECT array_agg(conname ORDER BY conname) INTO actual FROM pg_constraint
   WHERE conrelid='public.execution_spine_identity_quarantine'::regclass
     AND contype <> 'n';
  IF actual <> ARRAY[
    'ck_execution_spine_quarantine_digest','ck_execution_spine_quarantine_reason',
    'ck_execution_spine_quarantine_snapshot','fk_execution_spine_quarantine_case',
    'fk_execution_spine_quarantine_initiative','fk_execution_spine_quarantine_legacy_link',
    'fk_execution_spine_quarantine_org','fk_execution_spine_quarantine_run',
    'pk_execution_spine_identity_quarantine','uq_execution_spine_quarantine_legacy_case',
    'uq_execution_spine_quarantine_legacy_initiative','uq_execution_spine_quarantine_legacy_link'
  ] THEN RAISE EXCEPTION 'execution_spine_identity_quarantine has incompatible constraints'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='public.execution_spine_backfill_runs'::regclass
      AND conname='ck_execution_spine_backfill_total'
      AND regexp_replace(pg_get_constraintdef(oid),'\s+','','g')='CHECK((total_count=(mapped_count+quarantined_count)))'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='public.execution_spine_identity_quarantine'::regclass
      AND conname='ck_execution_spine_quarantine_snapshot'
      AND regexp_replace(pg_get_constraintdef(oid),'\s+','','g')='CHECK((jsonb_typeof(source_snapshot)=''object''::text))'
  ) THEN RAISE EXCEPTION 'execution spine authority checks are incompatible'; END IF;
END
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_execution_identity_aliases_legacy_initiative
  ON execution_identity_aliases(organization_id, legacy_initiative_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_execution_identity_aliases_legacy_case
  ON execution_identity_aliases(organization_id, legacy_case_id);

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
     WHERE i.indexrelid='public.uq_execution_identity_aliases_legacy_initiative'::regclass
       AND i.indrelid='public.execution_identity_aliases'::regclass
       AND i.indisunique AND i.indisvalid AND i.indisready AND i.indpred IS NULL
       AND regexp_replace(pg_get_indexdef(i.indexrelid),'\s+','','g')=
           'CREATEUNIQUEINDEXuq_execution_identity_aliases_legacy_initiativeONpublic.execution_identity_aliasesUSINGbtree(organization_id,legacy_initiative_id)'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_index i
     WHERE i.indexrelid='public.uq_execution_identity_aliases_legacy_case'::regclass
       AND i.indrelid='public.execution_identity_aliases'::regclass
       AND i.indisunique AND i.indisvalid AND i.indisready AND i.indpred IS NULL
       AND regexp_replace(pg_get_indexdef(i.indexrelid),'\s+','','g')=
           'CREATEUNIQUEINDEXuq_execution_identity_aliases_legacy_caseONpublic.execution_identity_aliasesUSINGbtree(organization_id,legacy_case_id)'
  ) THEN RAISE EXCEPTION 'execution_identity_aliases legacy indexes are incompatible'; END IF;
END
$migration$;

DO $migration$
BEGIN
  IF to_regprocedure('public.execution_spine_authority_evidence_immutable()') IS NULL THEN
    EXECUTE $fn$CREATE FUNCTION public.execution_spine_authority_evidence_immutable()
      RETURNS trigger LANGUAGE plpgsql IMMUTABLE AS $body$
      BEGIN RAISE EXCEPTION '% is immutable', TG_TABLE_NAME; END;
      $body$ $fn$;
  ELSIF NOT EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
      JOIN pg_language l ON l.oid=p.prolang
     WHERE p.oid='public.execution_spine_authority_evidence_immutable()'::regprocedure
       AND n.nspname='public' AND l.lanname='plpgsql' AND p.provolatile='i'
       AND p.prokind='f' AND p.pronargs=0 AND NOT p.prosecdef AND NOT p.proleakproof
       AND p.proparallel='u' AND p.proconfig IS NULL AND p.prorettype='trigger'::regtype
       AND regexp_replace(p.prosrc,'\s+','','g')=
           'BEGINRAISEEXCEPTION''%isimmutable'',TG_TABLE_NAME;END;'
  ) THEN
    RAISE EXCEPTION 'execution_spine_authority_evidence_immutable has incompatible definition';
  END IF;
END
$migration$;

DO $migration$
DECLARE
  target record;
BEGIN
  FOR target IN SELECT * FROM (VALUES
    ('execution_spine_backfill_runs','trg_execution_spine_backfill_runs_immutable'),
    ('execution_spine_backfill_receipts','trg_execution_spine_backfill_receipts_immutable'),
    ('execution_spine_identity_quarantine','trg_execution_spine_identity_quarantine_immutable')
  ) AS t(table_name,trigger_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
       WHERE tgrelid=to_regclass('public.'||target.table_name)
         AND tgname=target.trigger_name
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.execution_spine_authority_evidence_immutable()',
        target.trigger_name,target.table_name
      );
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_trigger
       WHERE tgrelid=to_regclass('public.'||target.table_name)
         AND tgname=target.trigger_name AND NOT tgisinternal AND tgenabled='O' AND tgtype=27
         AND tgfoid='public.execution_spine_authority_evidence_immutable()'::regprocedure
    ) THEN
      RAISE EXCEPTION '% has incompatible definition',target.trigger_name;
    END IF;
  END LOOP;
END
$migration$;

COMMENT ON TABLE execution_spine_backfill_receipts IS
  'Immutable proof that one legacy PMO/Case identity maps to exactly one Runtime-v1 execution_case_links authority.';
COMMENT ON TABLE execution_spine_identity_quarantine IS
  'Immutable fail-closed disposition for a legacy execution identity that cannot be mapped without guessing.';
