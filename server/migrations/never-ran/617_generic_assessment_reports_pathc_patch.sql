-- 617_generic_assessment_reports_pathc_patch.sql
--
-- Align Path C (Upload chaos -> Knowledge Map) with actual code usage.
-- This migration is additive: it extends generic_assessment_reports with the fields
-- referenced by report-builder upload-chaos + knowledgeMapService + genericReportService.

CREATE TABLE IF NOT EXISTS generic_assessment_reports (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT,
    report_type TEXT CHECK(report_type IN ('ISO_AUDIT', 'CONSULTING', 'COMPLIANCE', 'LEAN', 'OTHER')),
    consultant_name TEXT,
    report_date DATE,
    ai_summary TEXT,
    tags_json TEXT DEFAULT '[]',
    file_path TEXT,
    file_name TEXT,
    file_size INTEGER,
    uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_generic_org ON generic_assessment_reports(organization_id);

-- Core file metadata used by knowledge-map pipeline
ALTER TABLE generic_assessment_reports ADD COLUMN IF NOT EXISTS original_name TEXT;
ALTER TABLE generic_assessment_reports ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE generic_assessment_reports ADD COLUMN IF NOT EXISTS upload_status TEXT DEFAULT 'uploaded';

-- Content extraction / enrichment (best-effort, may remain NULL)
ALTER TABLE generic_assessment_reports ADD COLUMN IF NOT EXISTS text_content TEXT;
ALTER TABLE generic_assessment_reports ADD COLUMN IF NOT EXISTS metadata_json TEXT DEFAULT '{}';

-- Processing lifecycle used by GenericReportService
ALTER TABLE generic_assessment_reports ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE generic_assessment_reports ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'uploaded';
ALTER TABLE generic_assessment_reports ADD COLUMN IF NOT EXISTS processing_error TEXT;
ALTER TABLE generic_assessment_reports ADD COLUMN IF NOT EXISTS ocr_text TEXT;
ALTER TABLE generic_assessment_reports ADD COLUMN IF NOT EXISTS ai_key_findings TEXT DEFAULT '[]';
ALTER TABLE generic_assessment_reports ADD COLUMN IF NOT EXISTS linked_initiatives TEXT DEFAULT '[]';

-- Timestamps often expected by route code
ALTER TABLE generic_assessment_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE generic_assessment_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

