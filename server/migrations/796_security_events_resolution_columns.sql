-- =============================================================================
-- Migration: 796_security_events_resolution_columns.sql
-- Class: RED "migracja-braku" (rejestr _REJESTR_DOKONCZENIA.md linia 74)
-- Description: server/src/routes/admin-data.routes.ts ("resolve security
-- event" action) writes `resolved_at` and `resolved_by` on `security_events`;
-- parity only has the boolean `resolved` flag. server/src/routes/settings.routes.ts
-- (GET /api/settings/login-history, reading login/logout events out of
-- security_events) also selects generic `location`/`device` columns, distinct
-- from the pre-existing `location_city`/`location_country`. Purely additive,
-- idempotent.
-- =============================================================================

ALTER TABLE security_events ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS resolved_by TEXT;
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS device TEXT;
