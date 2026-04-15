-- ============================================
-- Bundle 16 — Valuation (T055–T057)
-- Add versioning + export metadata columns
-- ============================================

ALTER TABLE valuations
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE valuations
  ADD COLUMN IF NOT EXISTS export_path TEXT;

ALTER TABLE valuations
  ADD COLUMN IF NOT EXISTS exported_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_valuations_status ON valuations(status);

