CREATE TABLE IF NOT EXISTS assessment_skip_reasons (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level > 0),
  skip_code TEXT NOT NULL CHECK (
    skip_code IN (
      'poza_modelem_operacyjnym',
      'poza_zakresem_zlecenia',
      'odroczone_do_kolejnej_rewizji',
      'zastapione_innym_rozwiazaniem'
    )
  ),
  recorded_by_user_id TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  supersedes_id TEXT,
  superseded_by TEXT,
  idempotency_key TEXT NOT NULL,
  UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_assessment_skip_reasons_active_lookup
  ON assessment_skip_reasons (organization_id, session_id, unit_id, question_id, recorded_at DESC);
