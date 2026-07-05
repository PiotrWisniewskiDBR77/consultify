-- F0 — AUDYTY jako źródło inicjatyw (audit → initiative) + F2 skan kandydatów.
--
-- WAŻNE USTALENIE: tabela `audits` JUŻ ISTNIEJE (PostgresDatabase.ts:1599, „Compliance
-- Audits") z kolumnami: id, organization_id, name, type, status, score, auditor,
-- scheduled_date, completed_date, findings, created_at. Brakuje jej JEDNAK kolumn,
-- których wymagają dwie żywe ścieżki kręgosłupa — dlatego ta migracja jest ADDYTYWNA
-- (ALTER ... ADD COLUMN IF NOT EXISTS), nie tworzy tabeli od zera (CREATE IF NOT EXISTS
-- byłoby no-opem i NIE dodałoby brakujących kolumn).
--
-- Kto co czyta (i czego brakowało w istniejącej tabeli):
--
--   1) auditInitiativeService.createInitiativeFromAudit (F0):
--        SELECT id, organization_id, project_id, name, findings
--          FROM audits WHERE id = ? AND organization_id = ?
--      → istnieją: id, organization_id, name, findings.
--      → BRAKUJE: project_id  (bez tego całe SELECT pada → audit→initiative martwy).
--
--   2) initiativeCandidateService.loadDiscoveryArtifacts (F2 skan):
--        SELECT a.id,
--               COALESCE(a.title, a.name, '')        AS title,
--               COALESCE(a.summary, a.description,'') AS summary
--          FROM audits a WHERE a.organization_id = ?
--          AND NOT EXISTS (… initiatives n WHERE n.source_type='audit' AND n.source_id=a.id)
--      → istnieje: name.
--      → BRAKUJE: title, summary, description (bez nich zapytanie nie parsuje →
--        fail-soft do [] = skan audytów CICHO pusty).
--
-- Stąd dokładamy: project_id, title, summary, description, created_by. Zachowujemy
-- istniejące `name`/`findings`/`status`. Idempotentne: ADD COLUMN IF NOT EXISTS na
-- istniejącej tabeli, a gdyby tabela jeszcze nie powstała (świeża baza) — CREATE IF
-- NOT EXISTS poniżej zakłada ją z PEŁNYM zestawem kolumn.
--
-- Wzorzec: idempotentny, org-scoped, z indeksem po organization_id (jak
-- initiative_candidates 20260627 / deliverable_bundles 786).

-- ===========================================================================
-- audits — fundament (gdyby NIE istniała, np. świeża baza): pełny zestaw kolumn.
-- Na istniejących bazach to no-op (tabela już jest) i kolumny dokłada ALTER niżej.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS audits (
  id              TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id      TEXT,
  name            TEXT,
  title           TEXT,
  summary         TEXT,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'draft',
  findings        TEXT,            -- inline JSON array ustaleń (TEXT — zgodnie z istniejącą tabelą)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      TEXT
);

-- Backfill brakujących kolumn na ISTNIEJĄCEJ tabeli „audits" (Compliance Audits).
-- Każda osobno, IF NOT EXISTS → idempotentne i bezpieczne dla obu wariantów schematu.
ALTER TABLE audits ADD COLUMN IF NOT EXISTS project_id  TEXT;   -- czyta auditInitiativeService (F0)
ALTER TABLE audits ADD COLUMN IF NOT EXISTS title       TEXT;   -- czyta skan kandydatów (F2)
ALTER TABLE audits ADD COLUMN IF NOT EXISTS summary     TEXT;   -- czyta skan kandydatów (F2)
ALTER TABLE audits ADD COLUMN IF NOT EXISTS description TEXT;   -- czyta skan kandydatów (F2)
ALTER TABLE audits ADD COLUMN IF NOT EXISTS created_by  TEXT;   -- lineage / autor audytu

-- Skan kandydatów + audit→initiative są org-scoped → indeks po org (+ świeżość).
CREATE INDEX IF NOT EXISTS idx_audits_org
  ON audits(organization_id, created_at DESC);

-- ===========================================================================
-- audit_findings — OPCJONALNY znormalizowany wariant ustaleń.
-- Żaden żywy odczyt go jeszcze nie wymaga (F0 czyta inline audits.findings), ale
-- dostarczamy go pod przyszłą normalizację / per-finding accept. Idempotentny.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS audit_findings (
  id              TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT PRIMARY KEY,
  audit_id        TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  title           TEXT,
  description     TEXT,
  severity        TEXT,                            -- low | medium | high | critical
  recommendation  TEXT,
  area            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_findings_audit
  ON audit_findings(audit_id);

CREATE INDEX IF NOT EXISTS idx_audit_findings_org
  ON audit_findings(organization_id);
