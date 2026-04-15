-- Migration: 506_report_builder_block_types.sql
-- Report Builder - User-defined block types (safe dynamic blocks)
-- Date: 2026-02-02
--
-- Notes:
-- - SQLite doesn't support ADD COLUMN IF NOT EXISTS. Migration runner should ignore duplicate-column errors if re-run.
-- - We keep blocks "safe" by restricting rendering to predefined render kinds.

-- ==========================================
-- BLOCK TYPES (Library)
-- ==========================================

CREATE TABLE IF NOT EXISTS report_builder_block_types (
  id TEXT PRIMARY KEY,
  organization_id TEXT, -- NULL for system block types

  -- Identity
  name TEXT NOT NULL,
  description TEXT,

  -- Applicability
  source_types_json TEXT, -- JSON array of allowed source types, e.g. ["ASSESSMENT","TOOL"]
  render_kind TEXT NOT NULL DEFAULT 'markdown', -- markdown | callout | table | chart | matrix | json

  -- Generation
  prompt_template TEXT, -- template string used to build the user prompt
  input_schema_json TEXT, -- JSON schema for block_config_json (optional)

  -- Defaults
  default_length TEXT DEFAULT 'medium', -- short | medium | long
  default_language TEXT DEFAULT 'business', -- technical | business | general

  -- Status
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  -- Audit
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_rb_block_types_org ON report_builder_block_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_rb_block_types_active ON report_builder_block_types(is_active);

-- ==========================================
-- SECTION EXTENSIONS (link section -> block type)
-- ==========================================

ALTER TABLE report_builder_sections ADD COLUMN block_type_id TEXT;
ALTER TABLE report_builder_sections ADD COLUMN block_config_json TEXT;
ALTER TABLE report_builder_sections ADD COLUMN render_kind TEXT;

CREATE INDEX IF NOT EXISTS idx_rb_sections_block_type ON report_builder_sections(block_type_id);

