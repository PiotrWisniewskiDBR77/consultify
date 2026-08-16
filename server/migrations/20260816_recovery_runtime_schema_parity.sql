-- Recovery candidate: columns read by mounted runtime paths but absent when
-- the strict migration ledger builds a database from zero. These are
-- additive parity repairs for tables created by the canonical baseline.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS default_language TEXT,
  ADD COLUMN IF NOT EXISTS default_timezone TEXT,
  ADD COLUMN IF NOT EXISTS mfa_required INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mfa_grace_period_days INTEGER DEFAULT 7;

ALTER TABLE initiatives
  ADD COLUMN IF NOT EXISTS source_report_id TEXT;

CREATE INDEX IF NOT EXISTS idx_initiatives_source_report
  ON initiatives(source_report_id);
