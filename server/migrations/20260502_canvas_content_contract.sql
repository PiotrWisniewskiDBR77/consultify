-- Canvas Content Contract: additive columns for Markdown-first / JSON-native artifacts.
-- Legacy content/content_json fields are intentionally kept during this phase.

-- FRESH-DB GUARD (2026-07-14): work_canvas_drafts is created by
-- 760_work_canvas_runtime.sql, which sorts AFTER this file on a fresh replay.
-- Run this section only when the table exists; 760 re-adds the columns
-- idempotently (the data backfill below is a no-op on a fresh, empty table).
-- No behaviour change on already-migrated DBs.
DO $$ BEGIN
IF to_regclass('public.work_canvas_drafts') IS NOT NULL THEN

ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS canonical_format TEXT DEFAULT 'markdown';
ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS content_md TEXT;
ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS content_json_native TEXT;
ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS content_schema_version TEXT;
ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS markdown_projection_status TEXT DEFAULT 'synced';
ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS markdown_projected_at TEXT;
ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS markdown_projection_stale_at TEXT;
ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS projection_error TEXT;

UPDATE work_canvas_drafts
SET content_md = CASE
  WHEN content_md IS NOT NULL THEN content_md
  WHEN content_json IS NULL THEN ''
  WHEN LEFT(TRIM(content_json), 1) IN ('{', '[') THEN ''
  ELSE content_json
END
WHERE content_md IS NULL;

UPDATE work_canvas_drafts
SET content_json_native = CASE
  WHEN content_json_native IS NOT NULL THEN content_json_native
  WHEN content_json IS NOT NULL AND LEFT(TRIM(content_json), 1) IN ('{', '[') THEN content_json
  ELSE content_json_native
END
WHERE content_json_native IS NULL;

UPDATE work_canvas_drafts
SET canonical_format = CASE
  WHEN content_json_native IS NOT NULL AND content_json_native <> '' THEN 'json'
  ELSE 'markdown'
END
WHERE canonical_format IS NULL OR canonical_format NOT IN ('markdown', 'json');

UPDATE work_canvas_drafts
SET markdown_projection_status = CASE
  WHEN content_md IS NULL OR content_md = '' THEN 'missing'
  ELSE 'synced'
END
WHERE markdown_projection_status IS NULL OR markdown_projection_status NOT IN ('synced', 'stale', 'failed', 'missing');

END IF;
END $$;

ALTER TABLE wave5_artifacts ADD COLUMN IF NOT EXISTS canonical_format TEXT DEFAULT 'markdown';
ALTER TABLE wave5_artifacts ADD COLUMN IF NOT EXISTS content_md TEXT;
ALTER TABLE wave5_artifacts ADD COLUMN IF NOT EXISTS content_json_native TEXT;
ALTER TABLE wave5_artifacts ADD COLUMN IF NOT EXISTS content_schema_version TEXT;
ALTER TABLE wave5_artifacts ADD COLUMN IF NOT EXISTS markdown_projection_status TEXT DEFAULT 'synced';
ALTER TABLE wave5_artifacts ADD COLUMN IF NOT EXISTS markdown_projected_at TEXT;
ALTER TABLE wave5_artifacts ADD COLUMN IF NOT EXISTS projection_error TEXT;

UPDATE wave5_artifacts
SET content_md = COALESCE(content_md, content)
WHERE content_md IS NULL;

ALTER TABLE wave5_artifact_versions ADD COLUMN IF NOT EXISTS canonical_format TEXT DEFAULT 'markdown';
ALTER TABLE wave5_artifact_versions ADD COLUMN IF NOT EXISTS content_md TEXT;
ALTER TABLE wave5_artifact_versions ADD COLUMN IF NOT EXISTS content_json_native TEXT;
ALTER TABLE wave5_artifact_versions ADD COLUMN IF NOT EXISTS content_schema_version TEXT;
ALTER TABLE wave5_artifact_versions ADD COLUMN IF NOT EXISTS markdown_projection_status TEXT DEFAULT 'synced';
ALTER TABLE wave5_artifact_versions ADD COLUMN IF NOT EXISTS markdown_projected_at TEXT;
ALTER TABLE wave5_artifact_versions ADD COLUMN IF NOT EXISTS projection_error TEXT;

UPDATE wave5_artifact_versions
SET content_md = COALESCE(content_md, content)
WHERE content_md IS NULL;

ALTER TABLE research_report_artifacts ADD COLUMN IF NOT EXISTS canonical_format TEXT DEFAULT 'markdown';
ALTER TABLE research_report_artifacts ADD COLUMN IF NOT EXISTS content_json_native TEXT;
ALTER TABLE research_report_artifacts ADD COLUMN IF NOT EXISTS content_schema_version TEXT;
ALTER TABLE research_report_artifacts ADD COLUMN IF NOT EXISTS markdown_projection_status TEXT DEFAULT 'synced';
ALTER TABLE research_report_artifacts ADD COLUMN IF NOT EXISTS markdown_projected_at TEXT;
ALTER TABLE research_report_artifacts ADD COLUMN IF NOT EXISTS projection_error TEXT;

ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS canonical_format TEXT DEFAULT 'markdown';
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS content_md TEXT;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS content_json_native TEXT;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS content_schema_version TEXT;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS markdown_projection_status TEXT DEFAULT 'synced';
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS markdown_projected_at TEXT;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS projection_error TEXT;

UPDATE knowledge_documents
SET content_md = COALESCE(content_md, raw_content)
WHERE content_md IS NULL;

ALTER TABLE presentation_decks ADD COLUMN IF NOT EXISTS canonical_format TEXT DEFAULT 'json';
ALTER TABLE presentation_decks ADD COLUMN IF NOT EXISTS content_md TEXT;
ALTER TABLE presentation_decks ADD COLUMN IF NOT EXISTS content_json_native TEXT;
ALTER TABLE presentation_decks ADD COLUMN IF NOT EXISTS content_schema_version TEXT;
ALTER TABLE presentation_decks ADD COLUMN IF NOT EXISTS markdown_projection_status TEXT DEFAULT 'missing';
ALTER TABLE presentation_decks ADD COLUMN IF NOT EXISTS markdown_projected_at TEXT;
ALTER TABLE presentation_decks ADD COLUMN IF NOT EXISTS projection_error TEXT;

UPDATE presentation_decks
SET content_json_native = COALESCE(content_json_native, deck_json)
WHERE content_json_native IS NULL;

