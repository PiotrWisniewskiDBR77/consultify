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
-- Part 1 of 3: organizations + users.

ALTER TABLE IF EXISTS organizations
  ADD COLUMN IF NOT EXISTS active_llm_provider_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_currency       TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS billing_country        TEXT,
  ADD COLUMN IF NOT EXISTS tax_exempt             BOOLEAN DEFAULT FALSE;

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS title                    TEXT,
  ADD COLUMN IF NOT EXISTS trial_tokens_used        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locale                   TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS first_day_of_week        INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS accessibility_settings   TEXT DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notification_preferences TEXT DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ui_preferences           TEXT DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS known_devices            TEXT DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ai_assertiveness_level   REAL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS ai_autonomy_level        REAL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS attribution_data         TEXT;
