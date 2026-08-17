-- UI-CANON G4 — test-only feature-flag overrides.
--
-- The G4 Audits gate has to turn `auditsFiveSurfacesV1` on for one throwaway
-- tenant. It must not do that by borrowing the shared `feature_flags` row:
-- that table is UNIQUE per flag_key, so borrowing rewrites a real definition's
-- type, rules, variants and targets for the duration of a test run, and two
-- runs then fight over the same row.
--
-- This table keeps every fixture override in its own row, keyed by
-- organization. Two runs never touch the same row, no production definition is
-- read or written, and a crashed run leaves nothing but its own row, which its
-- `run_id` identifies.
--
-- It is resolved ONLY when the test-support gate is open (never in production);
-- see `server/src/routes/featureFlags.routes.ts`. Additive and reversible: drop
-- the table and the product behaves exactly as before.

CREATE TABLE IF NOT EXISTS g4_test_flag_overrides (
  organization_id TEXT NOT NULL,
  flag_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  run_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, flag_key)
);

CREATE INDEX IF NOT EXISTS idx_g4_test_flag_overrides_run
  ON g4_test_flag_overrides (run_id);
