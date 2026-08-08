-- Assessment Workbench outputs are canonical document artifacts, but they are
-- not Report Builder models. Preserve their owning runtime so Outputs can route
-- back to the source assessment without fabricating an empty native report.
-- Forward-only and additive: all previously accepted runtime values remain.

ALTER TABLE v8_artifact_origin_links
  DROP CONSTRAINT IF EXISTS v8_artifact_origin_links_origin_runtime_check;

ALTER TABLE v8_artifact_origin_links
  ADD CONSTRAINT v8_artifact_origin_links_origin_runtime_check
  CHECK (
    origin_runtime IN (
      'report',
      'presentation',
      'sheet',
      'native_artifact',
      'assessment_report',
      'report_template',
      'presentation_template',
      'sheet_template',
      'document_template'
    )
  );
