-- =============================================================================
-- Migration: 793_email_templates_lifecycle_columns.sql
-- Class: RED "migracja-braku" (rejestr _REJESTR_DOKONCZENIA.md linia 74)
-- Description: server/src/routes/content/email-templates.routes.ts reads and
-- writes a draft/published lifecycle (status, version, category_id,
-- language_code, published_at, published_by) and a usage counter
-- (usage_count) on `email_templates` that do not exist on parity. Every
-- create/update/publish/deprecate/clone call currently 42703s and is
-- swallowed by the dbRun/dbGet wrapper. Purely additive, idempotent.
-- =============================================================================

ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS category_id TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS language_code TEXT DEFAULT 'en';
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'DRAFT';
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS published_by TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- Backfill: templates that already exist and are active should read as
-- PUBLISHED (not DRAFT) so the new `status` column doesn't regress visibility
-- of pre-existing templates in status-filtered queries.
UPDATE email_templates
SET status = 'PUBLISHED'
WHERE status = 'DRAFT' AND is_active = 1;
