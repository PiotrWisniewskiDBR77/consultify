-- M17 Materiały — persystencja bundli + cykl życia (W4.1).
-- Każde wywołanie POST /bundle/export zapisuje rekord tu, zamiast generować
-- efemeryczne pliki i zapominać. Pozwala na listę wygenerowanych materiałów,
-- rollback, tryb lifecycle (draft→review→authorized→sent) i historię wersji.
--
-- Wzorzec: analogiczny do document_lifecycle_states (migration 782) ale
-- dla unified bundle (DOCX+XLSX+PPTX w jednej encji).
--
-- deliverable_bundles — jeden wiersz = jeden wygenerowany komplet materiałów.
-- deliverable_bundle_versions — append-only historia wersji (snapshot_json = pełny
-- bundle metadata; treść plików w object storage, tu tylko wskaźniki).

CREATE TABLE IF NOT EXISTS deliverable_bundles (
  id                TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL,
  user_id           TEXT,
  brief             TEXT NOT NULL,
  title             TEXT,
  lifecycle_state   TEXT NOT NULL DEFAULT 'draft',
  theme_id          TEXT,
  language          TEXT NOT NULL DEFAULT 'pl',
  quality_json      JSONB,
  hero_numbers_json JSONB,
  -- ZIP exportu (base64 lub URL — zależnie od storage backend)
  export_ref        TEXT,
  -- Flagi pomocnicze
  is_locked         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_db_bundles_org
  ON deliverable_bundles(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_db_bundles_user
  ON deliverable_bundles(user_id, created_at DESC);

-- append-only log wersji (snapshot metadanych; nie binarne pliki)
CREATE TABLE IF NOT EXISTS deliverable_bundle_versions (
  id               TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT PRIMARY KEY,
  bundle_id        TEXT NOT NULL REFERENCES deliverable_bundles(id) ON DELETE CASCADE,
  version          INTEGER NOT NULL,
  lifecycle_state  TEXT NOT NULL,
  snapshot_json    JSONB NOT NULL DEFAULT '{}',
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rolled_back_from INTEGER,
  UNIQUE (bundle_id, version)
);

CREATE INDEX IF NOT EXISTS idx_dbv_bundle
  ON deliverable_bundle_versions(bundle_id, version DESC);

-- Trigger: auto-update updated_at na deliverable_bundles
CREATE OR REPLACE FUNCTION update_deliverable_bundles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deliverable_bundles_updated_at ON deliverable_bundles;
CREATE TRIGGER trg_deliverable_bundles_updated_at
  BEFORE UPDATE ON deliverable_bundles
  FOR EACH ROW EXECUTE FUNCTION update_deliverable_bundles_updated_at();
