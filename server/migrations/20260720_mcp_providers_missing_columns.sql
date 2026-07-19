-- 20260720_mcp_providers_missing_columns.sql
-- E-MIG6XX: backfill columns missing from mcp_providers on the live schema.
--
-- WHY: 603_mcp_providers_registry.sql (server/migrations/, archived to never-ran/ as part of
-- the E-MIG6XX 6xx-autorun-gap audit) declares `mcp_providers` with only
-- (id, organization_id, name, type, status, config, created_at) -- no `updated_at`,
-- `last_error`, or `last_test_at`. Confirmed via information_schema on the live-mirrored
-- parity DB (:5443) that these three columns genuinely do not exist.
--
-- LIVE CALLER (currently broken without this): server/src/routes/mcp.routes.ts
--   - POST /mcp/providers            -> INSERT INTO mcp_providers (..., updated_at) VALUES (...)
--   - POST /mcp/providers/:id/test   -> UPDATE mcp_providers SET last_test_at = ..., last_error = ...,
--                                       updated_at = ... WHERE id = ...
-- Both currently fail with "column does not exist" on Postgres.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, safe to run any number of times.

ALTER TABLE mcp_providers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE mcp_providers ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE mcp_providers ADD COLUMN IF NOT EXISTS last_test_at TIMESTAMPTZ;
