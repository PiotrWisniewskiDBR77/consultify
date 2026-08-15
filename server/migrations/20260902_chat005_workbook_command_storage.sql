-- CHAT-005: deployed storage for governed, versioned workbook commands.
-- Runtime guards remain for upgrade compatibility, but normal requests must not
-- race one another while creating the command ledger on first use.

ALTER TABLE generated_workbooks
  ADD COLUMN IF NOT EXISTS approval_current INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_mutation_key TEXT;

CREATE TABLE IF NOT EXISTS generated_workbook_revisions (
  id TEXT PRIMARY KEY,
  workbook_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  command_id TEXT NOT NULL,
  idempotency_key TEXT,
  base_schema_json TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  operations_json TEXT DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workbook_id, organization_id, version)
);

CREATE TABLE IF NOT EXISTS generated_workbook_comments (
  id TEXT PRIMARY KEY,
  workbook_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  sheet_id TEXT,
  range_ref TEXT,
  anchored_version INTEGER NOT NULL DEFAULT 0,
  parent_comment_id TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  anchor_state TEXT NOT NULL DEFAULT 'active',
  idempotency_key TEXT,
  created_by TEXT NOT NULL,
  resolved_by TEXT,
  resolved_at TIMESTAMP,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workbook_id, organization_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS generated_workbook_source_bindings (
  id TEXT PRIMARY KEY,
  workbook_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  sheet_id TEXT NOT NULL,
  range_ref TEXT NOT NULL,
  label TEXT NOT NULL,
  source_ref TEXT,
  source_type TEXT,
  anchored_version INTEGER NOT NULL DEFAULT 0,
  anchor_state TEXT NOT NULL DEFAULT 'active',
  idempotency_key TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workbook_id, organization_id, idempotency_key)
);
