-- MAT-006 workbook lifecycle (2026-08-02): version/CAS + history + share.
--
-- `generated_workbooks` is guaranteed to exist on a from-scratch DB via
-- `756_interview_insight_downstream_lineage.sql` (a real, standalone
-- CREATE TABLE IF NOT EXISTS migration) independent of the rollback-prone
-- `20260719_baseline_gap.sql` consolidated baseline (see MAT-007/009's
-- `20260802_mat007_009_fresh_db_guard.sql` for the full story on why that
-- baseline file cannot be relied on for fresh-DB table existence). This file
-- follows the SAME "FRESH-DB GUARD" pattern: purely additive, every
-- statement is IF NOT EXISTS / ADD COLUMN IF NOT EXISTS, so it is a no-op
-- wherever these columns/tables already exist (staging/prod after a manual
-- backfill, or a re-run of this file).
--
-- These same statements are ALSO issued at runtime by
-- `ensureWorkbookSchema()` in `server/src/routes/workbook.routes.ts` (the
-- established self-healing idiom that file already uses for its 3 prior
-- extra columns) — this migration is the sanctioned, auditable counterpart
-- for `migrate.postgres.ts`, not a replacement for that runtime guard.

-- Optimistic-locking / CAS version counter (mirrors
-- `752_p20_deck_version_and_history.sql`'s `presentation_decks.version`).
ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Public share link (mirrors `568_presentations_brand_kits_templates.sql`'s
-- `presentation_decks.share_token` / `share_expires_at`, plus a
-- `share_created_by` actor column so the public-payload deny-list has a
-- concrete field to strip, matching presentations' `PUBLIC_DECK_DENY_FIELDS`).
ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS share_token TEXT;
ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS share_created_by TEXT;
ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_generated_workbooks_share_token
  ON generated_workbooks(share_token) WHERE share_token IS NOT NULL;

-- Immutable version history (mirrors `presentation_deck_versions`).
CREATE TABLE IF NOT EXISTS generated_workbook_versions (
  id TEXT PRIMARY KEY,
  workbook_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  schema_json_snapshot TEXT NOT NULL,
  sheet_count INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gwv_workbook_version
  ON generated_workbook_versions(workbook_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_gwv_workbook_created
  ON generated_workbook_versions(workbook_id, created_at DESC);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'generated_workbook_versions_workbook_id_fkey'
  ) and exists (
    select 1 from information_schema.tables where table_schema = 'public' and table_name = 'generated_workbooks'
  ) then
    alter table "public"."generated_workbook_versions"
      add constraint "generated_workbook_versions_workbook_id_fkey"
      foreign key (workbook_id) references generated_workbooks(id) on delete cascade;
  end if;
end $$;
