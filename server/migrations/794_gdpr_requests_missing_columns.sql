-- =============================================================================
-- Migration: 794_gdpr_requests_missing_columns.sql
-- Class: RED "migracja-braku" (rejestr _REJESTR_DOKONCZENIA.md linia 74)
-- Description: `gdpr_requests` on parity only has the minimal shape
-- (id, organization_id, user_id, type, status, result_url, processed_at,
-- created_at). Two independent call sites read/write a much wider set of
-- columns that all 42703 today:
--   - server/src/routes/settings.routes.ts (export/delete flows):
--     reason, download_url, file_path, expires_at, scheduled_at,
--     error_message, metadata, updated_at
--   - server/src/routes/dataExport.routes.ts (GDPR self-service export/
--     delete flows): request_type, requested_at, format, options,
--     scheduled_date
-- Also adds `completed_at` (settings.routes.ts export-completion write, distinct
-- from the pre-existing `processed_at`). Purely additive, idempotent. Does NOT touch the existing NOT NULL
-- constraints on organization_id/type (some call sites don't populate them) —
-- that is a semantic/decision item, tracked separately in the rejestr under
-- "Semantyczne (decyzja/schemat)", not "migracja-braku".
-- =============================================================================

ALTER TABLE gdpr_requests ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE gdpr_requests ADD COLUMN IF NOT EXISTS download_url TEXT;
ALTER TABLE gdpr_requests ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE gdpr_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE gdpr_requests ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE gdpr_requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE gdpr_requests ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE gdpr_requests ADD COLUMN IF NOT EXISTS metadata TEXT DEFAULT '{}';
ALTER TABLE gdpr_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE gdpr_requests ADD COLUMN IF NOT EXISTS request_type TEXT;
ALTER TABLE gdpr_requests ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ;
ALTER TABLE gdpr_requests ADD COLUMN IF NOT EXISTS format TEXT;
ALTER TABLE gdpr_requests ADD COLUMN IF NOT EXISTS options TEXT;
ALTER TABLE gdpr_requests ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMPTZ;

-- Backfill: dataExport.routes.ts reads/filters by request_type/requested_at;
-- keep them in sync with the pre-existing type/created_at for old rows.
UPDATE gdpr_requests
SET request_type = COALESCE(request_type, type),
    requested_at = COALESCE(requested_at, created_at)
WHERE request_type IS NULL OR requested_at IS NULL;
