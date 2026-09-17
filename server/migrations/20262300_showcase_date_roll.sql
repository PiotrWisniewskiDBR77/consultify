-- SR-1 SHOWCASE-ROLL / DEC-576 — state table for the showcase date-roll job.
--
-- One row per showcase organization, holding the watermark the nightly roll
-- measures its delta against (delta = today - last_rolled_on, in days).
-- Additive + idempotent; no other DDL. GO for THIS ONE migration only
-- ([A] Wpis 31 §4.2). Pool 20262300-20262319.
-- [ODMROZENIE WSPOLNE DEC-576]

CREATE TABLE IF NOT EXISTS showcase_date_roll (
  org_id         TEXT        PRIMARY KEY,
  last_rolled_on DATE        NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
