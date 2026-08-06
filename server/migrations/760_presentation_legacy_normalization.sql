-- Sprint 1 (I1): legacy presentation deck normalization tracking
-- Creates migration report ledger for canonical deck normalization runs.

CREATE TABLE IF NOT EXISTS presentation_migration_reports (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  run_mode TEXT NOT NULL DEFAULT 'dry_run',
  total_decks INTEGER NOT NULL DEFAULT 0,
  normalized_decks INTEGER NOT NULL DEFAULT 0,
  skipped_decks INTEGER NOT NULL DEFAULT 0,
  failed_decks INTEGER NOT NULL DEFAULT 0,
  retry_pointer_json TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_presentation_migration_reports_org_created
  ON presentation_migration_reports (organization_id, created_at DESC);
