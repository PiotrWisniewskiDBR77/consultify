-- USPOJNIENIE B2 — strukturalna tabela handoffów granic stage'ów inicjatywy.
--
-- Audyt 2026-06-26 wykazał, że plan obiecywał zapis handoffów do tabeli
-- `initiative_handoffs`, ale tabela nigdy nie powstała — recordHandoff pisał
-- tylko do generycznego audit-logu. Ta migracja tworzy dedykowaną tabelę, do
-- której recordHandoff zapisuje ustrukturyzowany wiersz (granica + moduły +
-- wynik kontraktu gotowości evaluateHandoff). Read-model dla lineage/funnel.
--
-- Bezpieczna: CREATE TABLE IF NOT EXISTS (additive, brak DROP/ALTER istniejących).

CREATE TABLE IF NOT EXISTS initiative_handoffs (
  id                 TEXT PRIMARY KEY,
  organization_id    TEXT NOT NULL,
  initiative_id      TEXT NOT NULL,
  from_status        TEXT,
  to_status          TEXT,
  boundary           TEXT,
  from_module        TEXT,
  to_module          TEXT,
  readiness_allowed  BOOLEAN,
  readiness_missing  TEXT,            -- JSON array of missing contract keys
  readiness_reasons  TEXT,            -- JSON array of human-readable reasons
  actor_id           TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_initiative_handoffs_initiative
  ON initiative_handoffs (initiative_id);
CREATE INDEX IF NOT EXISTS idx_initiative_handoffs_org
  ON initiative_handoffs (organization_id);
CREATE INDEX IF NOT EXISTS idx_initiative_handoffs_created
  ON initiative_handoffs (created_at);
