-- SR-1 SHOWCASE-ROLL / DEC-576 — state table for the showcase date-roll job.
--
-- One row per showcase organization, holding the watermark the nightly roll
-- measures its delta against (delta = today - last_rolled_on, in days) PLUS the
-- run proof the acceptance reads: how many days the last roll shifted and how
-- many rows moved per table.
--   delta_days  — the delta applied by the most recent ACTUAL roll (0 on the
--                 first/initializing run; a same-day no-op rerun does NOT
--                 overwrite it, so the proof of the last real shift survives).
--   per_table   — JSONB object { "<table>": <rows shifted> } for that roll.
-- Additive + idempotent; no other DDL. GO for THIS ONE migration only
-- ([A] Wpis 31 §4.2, columns added per [A] Wpis 38/45). Pool 20262300-20262319.
-- [ODMROZENIE WSPOLNE DEC-576]

CREATE TABLE IF NOT EXISTS showcase_date_roll (
  org_id         TEXT        PRIMARY KEY,
  last_rolled_on DATE        NOT NULL,
  delta_days     INTEGER     NOT NULL DEFAULT 0,
  per_table      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent upgrade for any database that already applied the earlier shape of
-- this migration (org_id, last_rolled_on, updated_at): add the run-proof columns.
ALTER TABLE showcase_date_roll ADD COLUMN IF NOT EXISTS delta_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE showcase_date_roll ADD COLUMN IF NOT EXISTS per_table  JSONB   NOT NULL DEFAULT '{}'::jsonb;
