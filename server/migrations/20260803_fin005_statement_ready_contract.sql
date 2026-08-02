-- ============================================
-- 20260803 — FIN-005 statement-ready contract (sanctioned wiring)
-- ============================================
-- WHY THIS FILE EXISTS (Codex fresh-DB Blocker 1):
-- The FIN-005 golden flow (upload -> detect -> extract -> map -> values ->
-- validate -> confirm) is implemented against a schema that historically only
-- existed as two files under `server/migrations/never-ran/`
-- (`668_statement_ready_contract.sql`, `669_statement_import_rebuild.sql`).
-- Those files are NEVER discovered by the sanctioned Postgres runner
-- (`server/scripts/migrate.postgres.ts` — plain `fs.readdirSync(dir)`, which
-- does not recurse into `never-ran/`), so a genuinely fresh database that
-- only ever runs the sanctioned migration path was missing:
--   - `financial_statements.readiness_status` / `readiness_score` /
--     `quality_summary` / `quality_reason_codes` / `document_class` /
--     `extraction_strategy` / `template_family` / `values_version`
--   - `financial_statement_values.is_non_financial` / `quality_label` /
--     `classification_reason`
--   - tables `financial_statement_quality_runs`,
--     `financial_statement_value_versions`, `financial_statement_line_aliases`,
--     `financial_statement_templates`, `financial_statement_repair_sessions`
-- every one of which `server/src/services/financialStatementService.ts` reads
-- or writes on the golden-flow path (classifyStatementDocument,
-- evaluateStatementReadiness, recordStatementQualityRun,
-- learnStatementAliases, openStatementRepairSession, etc).
--
-- WHAT THIS FILE DOES NOT DO:
-- `financial_statement_ingest_runs`, `financial_statement_extracted_sections`,
-- `financial_statement_candidate_rows` and `financial_statement_mapping_candidates`
-- (four of the six tables `669_statement_import_rebuild.sql` defines) are
-- ALREADY created by the sanctioned `20260316_financial_statement_packs.sql`
-- with an IDENTICAL column-for-column shape (verified by diff before writing
-- this file) — they are intentionally NOT repeated here to avoid pasting
-- duplicate schema. `financial_statement_source_artifacts` and
-- `financial_statement_repair_sessions` (669's other two tables) were
-- genuinely missing from the sanctioned path — confirmed empirically against
-- a freshly created, never-migrated Postgres database — so both are included
-- below.
--
-- SAFETY: every statement is additive (`CREATE TABLE IF NOT EXISTS`,
-- `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) — safe to run
-- against a database that already has this contract from a prior manual
-- application of 668/669 elsewhere (no-ops), and safe against a completely
-- empty database (creates everything from scratch). `never-ran/668` and
-- `never-ran/669` themselves are left untouched as historical reference —
-- this file is the sanctioned, runner-discovered equivalent.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---- from never-ran/668_statement_ready_contract.sql ----------------------

ALTER TABLE financial_statements
  ADD COLUMN IF NOT EXISTS readiness_status TEXT DEFAULT 'pending'
    CHECK (readiness_status IN ('pending', 'recoverable', 'ready', 'rejected')),
  ADD COLUMN IF NOT EXISTS readiness_score REAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_summary TEXT,
  ADD COLUMN IF NOT EXISTS quality_reason_codes TEXT,
  ADD COLUMN IF NOT EXISTS document_class TEXT DEFAULT 'unknown'
    CHECK (document_class IN ('unknown', 'native_pdf', 'scan_pdf', 'spreadsheet', 'csv', 'mixed_report')),
  ADD COLUMN IF NOT EXISTS extraction_strategy TEXT,
  ADD COLUMN IF NOT EXISTS template_family TEXT,
  ADD COLUMN IF NOT EXISTS values_version INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_fs_readiness_status ON financial_statements(readiness_status);
CREATE INDEX IF NOT EXISTS idx_fs_document_class ON financial_statements(document_class);

ALTER TABLE financial_statement_values
  ADD COLUMN IF NOT EXISTS is_non_financial BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS quality_label TEXT,
  ADD COLUMN IF NOT EXISTS classification_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_fsv_non_financial ON financial_statement_values(statement_id, is_non_financial);

CREATE TABLE IF NOT EXISTS financial_statement_quality_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  stage TEXT NOT NULL
    CHECK (stage IN ('upload', 'detect', 'extract', 'map', 'validate', 'repair', 'readiness', 'confirm', 'benchmark')),
  result_status TEXT NOT NULL
    CHECK (result_status IN ('pass', 'warning', 'fail', 'info')),
  readiness_status TEXT
    CHECK (readiness_status IN ('pending', 'recoverable', 'ready', 'rejected')),
  strategy TEXT,
  summary TEXT,
  reason_codes TEXT,
  payload_json TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (statement_id) REFERENCES financial_statements(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fsqr_statement_stage ON financial_statement_quality_runs(statement_id, stage, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fsqr_org_stage ON financial_statement_quality_runs(organization_id, stage, created_at DESC);

CREATE TABLE IF NOT EXISTS financial_statement_value_versions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_id TEXT NOT NULL,
  version_no INTEGER NOT NULL,
  source_stage TEXT NOT NULL,
  values_json TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(statement_id, version_no),
  FOREIGN KEY (statement_id) REFERENCES financial_statements(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fsvv_statement ON financial_statement_value_versions(statement_id, version_no DESC);

CREATE TABLE IF NOT EXISTS financial_statement_line_aliases (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL DEFAULT '',
  statement_line_id TEXT NOT NULL,
  statement_type TEXT NOT NULL CHECK (statement_type IN ('P&L', 'BS', 'CF')),
  alias_text TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  template_family TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'learned'
    CHECK (source IN ('seed', 'learned', 'manual')),
  usage_count INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, statement_line_id, normalized_alias, template_family),
  FOREIGN KEY (statement_line_id) REFERENCES financial_statement_lines(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fsla_lookup ON financial_statement_line_aliases(statement_type, normalized_alias, template_family);

CREATE TABLE IF NOT EXISTS financial_statement_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL DEFAULT '',
  template_family TEXT NOT NULL,
  template_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  matcher_terms TEXT,
  document_class TEXT NOT NULL DEFAULT 'unknown'
    CHECK (document_class IN ('unknown', 'native_pdf', 'scan_pdf', 'spreadsheet', 'csv', 'mixed_report')),
  extraction_strategy TEXT,
  is_system BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_fst_template_lookup ON financial_statement_templates(template_family, template_key);

-- ---- from never-ran/669_statement_import_rebuild.sql -----------------------
-- Only `financial_statement_source_artifacts` and
-- `financial_statement_repair_sessions` — the other four tables that file
-- defines are already live via `20260316_financial_statement_packs.sql`.

CREATE TABLE IF NOT EXISTS financial_statement_source_artifacts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_id TEXT NOT NULL,
  ingest_run_id TEXT,
  artifact_type TEXT NOT NULL,
  stage TEXT NOT NULL,
  version_no INTEGER NOT NULL DEFAULT 1,
  content_text TEXT,
  content_json TEXT,
  metadata_json TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (statement_id) REFERENCES financial_statements(id) ON DELETE CASCADE,
  FOREIGN KEY (ingest_run_id) REFERENCES financial_statement_ingest_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fssa_statement_stage
  ON financial_statement_source_artifacts(statement_id, stage, created_at DESC);

CREATE TABLE IF NOT EXISTS financial_statement_repair_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  ingest_run_id TEXT,
  repair_status TEXT NOT NULL DEFAULT 'open'
    CHECK (repair_status IN ('open', 'applied', 'dismissed')),
  summary TEXT,
  payload_json TEXT,
  started_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (statement_id) REFERENCES financial_statements(id) ON DELETE CASCADE,
  FOREIGN KEY (ingest_run_id) REFERENCES financial_statement_ingest_runs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fsrs_statement_status
  ON financial_statement_repair_sessions(statement_id, repair_status, created_at DESC);
