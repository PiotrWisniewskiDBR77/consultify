-- MAT-POL-001 restricted policy. Historical rows remain UNKNOWN: this
-- migration deliberately does not infer licenses or template rights.
DO $$
DECLARE
  policy_columns INTEGER;
  template_name TEXT;
  provenance_columns INTEGER;
BEGIN
  IF to_regclass('public.artifact_export_receipts') IS NULL THEN
    RAISE EXCEPTION 'm17 preflight: artifact_export_receipts is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='artifact_export_receipts'
       AND column_name='provider_key' AND data_type='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION 'm17 preflight: artifact_export_receipts.provider_key has wrong shape';
  END IF;
  SELECT count(*) INTO policy_columns FROM information_schema.columns
   WHERE table_schema='public' AND table_name='artifact_export_receipts'
     AND column_name IN ('policy_contract_version','render_engine_version','render_engine_license','output_semantics');
  IF policy_columns NOT IN (0, 4) THEN
    RAISE EXCEPTION 'm17 preflight: partial receipt policy columns (%)', policy_columns;
  END IF;
  IF policy_columns = 4 AND EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='artifact_export_receipts'
       AND column_name IN ('policy_contract_version','render_engine_version','render_engine_license','output_semantics')
       AND (data_type <> 'text' OR is_nullable <> 'YES' OR column_default IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'm17 preflight: receipt policy columns have wrong type/null/default';
  END IF;
  IF policy_columns = 4 AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid='public.artifact_export_receipts'::regclass
       AND conname='artifact_export_receipts_policy17_check'
       AND pg_get_constraintdef(oid) LIKE '%policy_contract_version IS NULL%render_engine_version IS NULL%'
       AND pg_get_constraintdef(oid) LIKE '%mat-policy-v1%native:pdfkit%'
  ) THEN
    RAISE EXCEPTION 'm17 preflight: receipt policy CHECK has wrong semantics';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='artifact_export_receipt_immutability_guard'
       AND pg_get_functiondef(p.oid) LIKE '%provider_key IS DISTINCT FROM OLD.provider_key%'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
     WHERE t.tgrelid='public.artifact_export_receipts'::regclass
       AND t.tgname='trg_artifact_export_receipt_immutability' AND NOT t.tgisinternal
       AND t.tgenabled='O' AND t.tgtype=19 AND p.proname='artifact_export_receipt_immutability_guard'
  ) THEN
    RAISE EXCEPTION 'm17 preflight: receipt immutable function/trigger has wrong shape';
  END IF;

  FOREACH template_name IN ARRAY ARRAY['document_studio_templates','report_builder_templates','presentation_templates','tp_base_templates'] LOOP
    IF to_regclass('public.' || template_name) IS NULL THEN
      RAISE EXCEPTION 'm17 preflight: template registry % is missing', template_name;
    END IF;
    SELECT count(*) INTO provenance_columns FROM information_schema.columns
     WHERE table_schema='public' AND table_name=template_name
       AND column_name IN ('provenance_status','provenance_json');
    IF provenance_columns NOT IN (0, 2) THEN
      RAISE EXCEPTION 'm17 preflight: partial provenance columns on %', template_name;
    END IF;
    IF provenance_columns = 2 AND EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name=template_name
         AND ((column_name='provenance_status' AND (data_type<>'text' OR is_nullable<>'NO' OR COALESCE(column_default,'') NOT LIKE '%unknown%'))
           OR (column_name='provenance_json' AND (data_type<>'jsonb' OR is_nullable<>'NO' OR COALESCE(column_default,'') NOT LIKE '%{}%')))
    ) THEN
      RAISE EXCEPTION 'm17 preflight: provenance columns have wrong type/null/default on %', template_name;
    END IF;
    IF provenance_columns = 2 AND NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conrelid=to_regclass('public.' || template_name)
         AND conname=template_name || '_provenance_status_check'
         AND pg_get_constraintdef(oid) LIKE '%authority%actor%version%evidence%'
    ) THEN
      RAISE EXCEPTION 'm17 preflight: provenance CHECK has wrong semantics on %', template_name;
    END IF;
  END LOOP;
END $$;

ALTER TABLE artifact_export_receipts
  ADD COLUMN IF NOT EXISTS policy_contract_version TEXT,
  ADD COLUMN IF NOT EXISTS render_engine_version TEXT,
  ADD COLUMN IF NOT EXISTS render_engine_license TEXT,
  ADD COLUMN IF NOT EXISTS output_semantics TEXT;

ALTER TABLE artifact_export_receipts
  DROP CONSTRAINT IF EXISTS artifact_export_receipts_policy17_check;
ALTER TABLE artifact_export_receipts
  ADD CONSTRAINT artifact_export_receipts_policy17_check CHECK (
    (policy_contract_version IS NULL AND render_engine_version IS NULL
      AND render_engine_license IS NULL AND output_semantics IS NULL) OR COALESCE((
      policy_contract_version = 'mat-policy-v1'
      AND render_engine_version IS NOT NULL
      AND render_engine_license = 'MIT'
      AND output_semantics IN ('document', 'workbook', 'presentation', 'text_summary')
      AND (
        (provider_key = 'native:docx' AND render_engine_version = '9.5.1' AND output_semantics = 'document') OR
        (provider_key = 'native:pptxgenjs' AND render_engine_version = '4.0.1' AND output_semantics = 'presentation') OR
        (provider_key = 'native:exceljs' AND render_engine_version = '4.4.0' AND output_semantics = 'workbook') OR
        (provider_key = 'native:pdfkit' AND render_engine_version = '0.17.2' AND output_semantics = 'text_summary')
      )
    ), FALSE)
  ) NOT VALID;
ALTER TABLE artifact_export_receipts VALIDATE CONSTRAINT artifact_export_receipts_policy17_check;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['document_studio_templates','report_builder_templates','presentation_templates','tp_base_templates']
  LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS provenance_status TEXT NOT NULL DEFAULT ''unknown''', table_name);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS provenance_json JSONB NOT NULL DEFAULT ''{}''::jsonb', table_name);
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', table_name, table_name || '_provenance_status_check');
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (provenance_status IN (''unknown'',''approved'',''quarantined'') AND (provenance_status <> ''approved'' OR (jsonb_typeof(provenance_json) = ''object'' AND nullif(btrim(provenance_json->>''authority''), '''') IS NOT NULL AND nullif(btrim(provenance_json->>''actor''), '''') IS NOT NULL AND nullif(btrim(provenance_json->>''version''), '''') IS NOT NULL AND nullif(btrim(provenance_json->>''evidence''), '''') IS NOT NULL)))', table_name, table_name || '_provenance_status_check');
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION artifact_export_receipt_immutability_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.artifact_kind IS DISTINCT FROM OLD.artifact_kind
     OR NEW.source_record_id IS DISTINCT FROM OLD.source_record_id
     OR NEW.source_version IS DISTINCT FROM OLD.source_version
     OR NEW.source_content_hash IS DISTINCT FROM OLD.source_content_hash
     OR NEW.output_format IS DISTINCT FROM OLD.output_format
     OR NEW.provider_key IS DISTINCT FROM OLD.provider_key
     OR NEW.provider_job_id IS DISTINCT FROM OLD.provider_job_id
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.policy_contract_version IS DISTINCT FROM OLD.policy_contract_version
     OR NEW.render_engine_version IS DISTINCT FROM OLD.render_engine_version
     OR NEW.render_engine_license IS DISTINCT FROM OLD.render_engine_license
     OR NEW.output_semantics IS DISTINCT FROM OLD.output_semantics THEN
    RAISE EXCEPTION 'artifact export receipt immutable source/provider/policy fields cannot change'
      USING ERRCODE = '55000';
  END IF;
  IF OLD.status <> 'pending' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'artifact_export_receipts_success_check / terminal immutability: receipt is terminal (status=%)', OLD.status USING ERRCODE = '55000';
  END IF;
  IF OLD.status = 'pending' AND NEW.status = 'pending' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'pending artifact export receipt may only transition to a terminal outcome' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
