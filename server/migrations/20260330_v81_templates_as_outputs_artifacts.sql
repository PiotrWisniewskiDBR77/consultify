-- V8.1 Wave 3 — Templates as Outputs artifacts (Position 24, P24-B)
-- Extends artifact substrate to allow template artifacts and template origin runtimes.

ALTER TABLE v8_output_artifacts DROP CONSTRAINT IF EXISTS v8_output_artifacts_artifact_family_check;
ALTER TABLE v8_output_artifacts ADD CONSTRAINT v8_output_artifacts_artifact_family_check
  CHECK (artifact_family IN ('document', 'presentation', 'sheet', 'template'));

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
      'document_template',
      'sheet_template'
    )
  );
