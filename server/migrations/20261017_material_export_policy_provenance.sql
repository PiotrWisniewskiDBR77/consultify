-- MAT-POL-001 restricted policy. Historical rows remain UNKNOWN: this
-- migration deliberately does not infer licenses or template rights.
ALTER TABLE artifact_export_receipts
  ADD COLUMN IF NOT EXISTS policy_contract_version TEXT,
  ADD COLUMN IF NOT EXISTS render_engine_version TEXT,
  ADD COLUMN IF NOT EXISTS render_engine_license TEXT,
  ADD COLUMN IF NOT EXISTS output_semantics TEXT;

ALTER TABLE artifact_export_receipts
  DROP CONSTRAINT IF EXISTS artifact_export_receipts_policy17_check;
ALTER TABLE artifact_export_receipts
  ADD CONSTRAINT artifact_export_receipts_policy17_check CHECK (
    policy_contract_version IS NULL OR (
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
    )
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
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (provenance_status IN (''unknown'',''approved'',''quarantined''))', table_name, table_name || '_provenance_status_check');
    END IF;
  END LOOP;
END $$;

