-- 20260720_access_codes_reconcile.sql
-- Dual-model reconciliation for access_codes (CTO decision, 2026-07-20).
--
-- Context: access_codes carries two coexisting models on one table —
-- accessCodeService.ts (code_hash / uses_count / status 'ACTIVE'/'REVOKED')
-- and 4 legacy callers (SuperAdminController / adminP32 / access-control.routes
-- / auth.routes: current_uses / is_active 0|1 / code plaintext). The prior
-- additive migration (20260720_access_codes_hash_columns.sql) added the
-- hash-model columns so accessCodeService's INSERT stopped 500ing, but rows
-- created by the legacy callers BEFORE that migration (and any created since
-- by legacy callers not yet routed through AccessCodeService) still have
-- code_hash IS NULL — invisible to accessCodeService.validatePublic() /
-- validateCode() / acceptCode(), which look up by code_hash.
--
-- This migration backfills the hash-model columns for those rows from their
-- legacy values, so every pre-existing legacy-created code becomes valid
-- through EITHER engine immediately (application code additionally carries a
-- code_hash-IS-NULL fallback lookup in accessCodeService.findAccessCodeRow()
-- for defense-in-depth / rows created between deploys).
--
-- ADDITIVE + IDEMPOTENT: only fills columns that are currently NULL
-- (WHERE code_hash IS NULL); no legacy column is touched or dropped. A
-- second run finds zero matching rows.
--
-- Runner: matches /^\d{8}_.*\.sql$/ in DatabaseInitializer.runTablePlatformMigrations,
-- tracked idempotently in tp_migration_history, runs in its own transaction.

UPDATE access_codes
SET
  -- sha256(code) matches accessCodeService.hashCode()'s
  -- crypto.createHash('sha256').update(String(code).trim()).digest('hex').
  -- `code` is NOT NULL + UNIQUE, so no trimming ambiguity in practice.
  code_hash = encode(sha256(convert_to(code, 'UTF8')), 'hex'),
  -- Fold the legacy usage counter into the hash-model counter so a
  -- subsequent accessCodeService.acceptCode() call respects usage that
  -- already happened through the legacy engine.
  uses_count = COALESCE(current_uses, 0),
  -- Legacy `is_active` is the source of truth for these rows (the earlier
  -- additive migration defaulted `status` to 'ACTIVE' for ALL rows,
  -- including already-revoked legacy ones — this corrects that drift).
  status = CASE WHEN COALESCE(is_active, 1) = 1 THEN 'ACTIVE' ELSE 'REVOKED' END,
  -- Legacy codes are org-invite codes; INVITE is the closest hash-model type.
  type = COALESCE(type, 'INVITE')
WHERE code_hash IS NULL
  AND code IS NOT NULL;
