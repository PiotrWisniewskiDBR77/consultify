-- Forward repair C (release migration gate repair, 2026-08-13)
--
-- WHY: 000_z_core_baseline.sql was applied to demo on 2026-03-16 from a version predating its
-- later "strict-schema repair" additions. The runner keys on filename and never re-runs an
-- applied file, so every column added to that file afterwards never reached demo. Verified
-- read-only 2026-08-13 against information_schema (table_schema = public): 29 columns missing.
--
-- 000_z_core_baseline.sql is NOT edited (that would rewrite an applied migration). Forward-only,
-- idempotent, additive. No DROP, no RENAME, no business backfill. Types/defaults/nullability
-- mirror the baseline contract, translated to Postgres-native form (the baseline is written in
-- the SQLite-flavoured dialect the runner shims at apply time: BOOLEAN DEFAULT 0 -> FALSE,
-- DATETIME -> TIMESTAMPTZ).
-- Part 3 of 3: settings + llm_providers.

ALTER TABLE IF EXISTS settings
  ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE IF EXISTS llm_providers
  ADD COLUMN IF NOT EXISTS context_window INTEGER DEFAULT 4096,
  ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
