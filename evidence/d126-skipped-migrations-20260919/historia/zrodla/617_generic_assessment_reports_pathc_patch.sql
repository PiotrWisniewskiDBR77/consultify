-- 617_generic_assessment_reports_pathc_patch.sql
--
-- Align Path C (Upload chaos -> Knowledge Map) with actual code usage.
-- This migration is additive: it extends generic_assessment_reports with the fields
-- referenced by report-builder upload-chaos + knowledgeMapService + genericReportService.

-- Core file metadata used by knowledge-map pipeline
ALTER TABLE generic_assessment_reports ADD COLUMN original_name TEXT;
ALTER TABLE generic_assessment_reports ADD COLUMN mime_type TEXT;
ALTER TABLE generic_assessment_reports ADD COLUMN upload_status TEXT DEFAULT 'uploaded';

-- Content extraction / enrichment (best-effort, may remain NULL)
ALTER TABLE generic_assessment_reports ADD COLUMN text_content TEXT;
ALTER TABLE generic_assessment_reports ADD COLUMN metadata_json TEXT DEFAULT '{}';

-- Processing lifecycle used by GenericReportService
ALTER TABLE generic_assessment_reports ADD COLUMN file_type TEXT;
ALTER TABLE generic_assessment_reports ADD COLUMN processing_status TEXT DEFAULT 'uploaded';
ALTER TABLE generic_assessment_reports ADD COLUMN processing_error TEXT;
ALTER TABLE generic_assessment_reports ADD COLUMN ocr_text TEXT;
ALTER TABLE generic_assessment_reports ADD COLUMN ai_key_findings TEXT DEFAULT '[]';
ALTER TABLE generic_assessment_reports ADD COLUMN linked_initiatives TEXT DEFAULT '[]';

-- Timestamps often expected by route code
ALTER TABLE generic_assessment_reports ADD COLUMN created_at DATETIME;
ALTER TABLE generic_assessment_reports ADD COLUMN updated_at DATETIME;

