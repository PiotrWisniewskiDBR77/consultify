-- =============================================================================
-- Migration: 795_permission_requests_missing_columns.sql
-- Class: RED "migracja-braku" (rejestr _REJESTR_DOKONCZENIA.md linia 74)
-- Description: server/src/routes/permissionRequests.routes.ts reads/writes
-- `requested_permission`, `reason`, `resolved_by`, `resolved_at`,
-- `rejection_reason` on `permission_requests`; parity only has the older
-- request_type/current_value/requested_value/justification/priority/
-- reviewed_by/reviewed_at/admin_notes shape. Both shapes are kept side by
-- side (additive) rather than renamed, since renaming is a semantic decision
-- outside the "migracja-braku" bucket.
-- =============================================================================

ALTER TABLE permission_requests ADD COLUMN IF NOT EXISTS requested_permission TEXT;
ALTER TABLE permission_requests ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE permission_requests ADD COLUMN IF NOT EXISTS resolved_by TEXT;
ALTER TABLE permission_requests ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE permission_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
