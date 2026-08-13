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
-- Part 2 of 3: projects.

ALTER TABLE IF EXISTS projects
  ADD COLUMN IF NOT EXISTS start_date   TEXT,
  ADD COLUMN IF NOT EXISTS end_date     TEXT,
  ADD COLUMN IF NOT EXISTS budget       REAL,
  ADD COLUMN IF NOT EXISTS currency     TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS lead_id      TEXT,
  ADD COLUMN IF NOT EXISTS priority     TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS phase        TEXT DEFAULT 'planning',
  ADD COLUMN IF NOT EXISTS settings     TEXT,
  ADD COLUMN IF NOT EXISTS metadata     TEXT,
  ADD COLUMN IF NOT EXISTS context_data TEXT,
  ADD COLUMN IF NOT EXISTS rag_enabled  INTEGER DEFAULT 1;
