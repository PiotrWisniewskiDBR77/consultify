-- R11 (doc slice) — extend origin_runtime CHECK with 'document_template'.
--
-- Document Studio templates (`document_studio_templates`) are the CANONICAL
-- document-template registry. Until now the Template Library index could only
-- carry the legacy report/presentation/sheet template runtimes, so approved
-- Document Studio templates were invisible to the artifact substrate.
--
-- This migration is ADDITIVE: it re-declares the same CHECK constraint with
-- ONE extra allowed value. Every previously allowed value is preserved
-- (precedents: 20260330_v81_templates_as_outputs_artifacts.sql and
-- 20260412_seed_business_templates.sql, which added 'sheet_template').
-- NO data is inserted, updated or deleted.

ALTER TABLE v8_artifact_origin_links DROP CONSTRAINT IF EXISTS v8_artifact_origin_links_origin_runtime_check;
ALTER TABLE v8_artifact_origin_links ADD CONSTRAINT v8_artifact_origin_links_origin_runtime_check
  CHECK (
    origin_runtime IN (
      'report',
      'presentation',
      'sheet',
      'native_artifact',
      'report_template',
      'presentation_template',
      'sheet_template',
      'document_template'
    )
  );
