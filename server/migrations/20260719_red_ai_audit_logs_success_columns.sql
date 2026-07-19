-- RED-AI (ŁOWCA RED, 2026-07-19) — schema-500 fix for the AI-training feedback rewir.
--
-- Rewir: server/src/routes/ai/ai-training.routes.ts →
--        server/src/controllers/ai/AITrainingController.ts
--
-- ROOT CAUSE (parity pg18 :5443, confirmed live):
--   GET /api/ai/training/stats → 500 "column \"success\" does not exist"
--   The controller's OWN data model references two columns on ai_audit_logs
--   that never existed in the real schema:
--     - getStats():      SUM(CASE WHEN success = 1 ...) FROM ai_audit_logs   (42703)
--     - listFeedback():  ... AND success = ?  (when ?helpful= is passed)     (42703)
--     - submitFeedback(): INSERT INTO ai_audit_logs (... success, metadata_json ...)  (42703, latent write-path 500)
--   DbPromise fallback=true masked the read error into `null`, so getStats then
--   threw "Cannot read properties of null (reading 'total')" → HTTP 500.
--
-- FIX: additive, idempotent — add ONLY the two missing columns this controller
-- writes and reads. No existing column is touched or renamed. Types chosen to
-- match controller usage: `success` compared/inserted as 1/0 (integer boolean);
-- `metadata_json` inserted as a JSON string (text, mirrors sibling *_json columns).
--
-- Auto-applies at boot: filename matches runTablePlatformMigrations `\d{8}_` prefix.
-- Scope: ai rewir only — does NOT collide with other RED migrations (distinct table/cols).

ALTER TABLE ai_audit_logs ADD COLUMN IF NOT EXISTS success integer;
ALTER TABLE ai_audit_logs ADD COLUMN IF NOT EXISTS metadata_json text;
