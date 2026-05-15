-- Migration: 527_report_builder_chapters_and_metadata.sql
-- Description: Add chapter support to sections and metadata PATCH support for reports
-- Date: 2026-02-08

-- ============================================
-- CHAPTER SUPPORT FOR SECTIONS
-- ============================================

-- chapter_key groups blocks into the same chapter (e.g., "chapter_1")
ALTER TABLE report_builder_sections ADD COLUMN chapter_key TEXT;

-- chapter_title is the display name of the chapter (e.g., "Analiza osi DRD")
ALTER TABLE report_builder_sections ADD COLUMN chapter_title TEXT;

-- Index for chapter-based queries
CREATE INDEX IF NOT EXISTS idx_rb_sections_chapter ON report_builder_sections(report_id, chapter_key);
