-- F2 — SKRZYNKA KANDYDATÓW (wejście wrzeciona inicjatyw) · D5/D8
--
-- AI proaktywnie sugeruje inicjatywy z rozpoznania (insights / assessments / audits,
-- które NIE mają jeszcze przypisanej inicjatywy). Każdy wiersz = jeden kandydat:
-- propozycja z tytułem, uzasadnieniem i wstępnym dopasowaniem do portfela (fit_score).
-- Human akceptuje (→ generator F1) / odrzuca / scal.
--
-- Wzorzec: analogiczny do deliverable_bundles (migration 786) — idempotentny,
-- org-scoped, z indeksem po (organization_id, status) pod listę zakładki "Kandydaci".
--
-- status: 'pending'   — świeży kandydat, czeka na decyzję human
--         'accepted'  — zaakceptowany, uruchomiono generator inicjatywy
--         'dismissed' — odrzucony przez human

CREATE TABLE IF NOT EXISTS initiative_candidates (
  id              TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  -- artefakt rozpoznania, z którego AI wyprowadził kandydata
  source_type     TEXT NOT NULL,            -- 'interview_insight' | 'assessment' | 'audit'
  source_id       TEXT,
  title           TEXT NOT NULL,
  rationale       TEXT,                      -- uzasadnienie AI (dlaczego warto)
  fit_score       REAL,                      -- 0..1 dopasowanie do portfela (dedup/luki)
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | dismissed
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      TEXT
);

-- Lista zakładki "Kandydaci": filtr po org + status, najnowsze najpierw.
CREATE INDEX IF NOT EXISTS idx_initiative_candidates_org_status
  ON initiative_candidates(organization_id, status);
