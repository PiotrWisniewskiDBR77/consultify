-- Evidence Layer — fundament (H1 Harvey-gap, kontrakt nr 1)
-- SSOT: Harvard/wdrozenie-100/_KONCEPT_RDZEN_2026-07-10.md §3 (EvidenceEnvelope)
--
-- Jedna polimorficzna tabela adnotacji węzła łańcucha dowodowego. Krawędzie
-- (kto-skąd) mieszkają w `link_graph_edges` (20260303_link_graph_v3.sql) —
-- ta tabela NIE duplikuje grafu, tylko niesie envelope {sources, assumptions,
-- confidence, to_verify} per (artifact_type, artifact_id). Wzorzec: dokładnie
-- to, czym zwornik D4 rozszerza `approval_assignments` (subject_type/subject_id
-- polymorphic FK).
--
-- Idempotentna: bezpieczna do wielokrotnego uruchomienia (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS artifact_evidence (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,

  -- Ogniwo łańcucha, do którego przypięty jest envelope. Otwarta lista (nowe
  -- ogniwa/archetypy SPEC-A dochodzą bez migracji schematu) — 'other' = escape
  -- hatch, żeby robotnik nie blokował się na CHECK przy nowym typie.
  artifact_type TEXT NOT NULL
    CHECK (artifact_type IN (
      'insight', 'initiative', 'task', 'decision', 'report', 'deck',
      'document', 'kpi', 'finance_number', 'benefit', 'canvas', 'project',
      'source', 'assessment', 'other'
    )),
  artifact_id TEXT NOT NULL,

  -- EvidenceEnvelope.sources: [{type, ref, snippet, url}]
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- EvidenceEnvelope.assumptions: [{key, value, source_type, confidence, rationale?}]
  -- source_type: imported|user|teresa|ai_assumed|benchmark
  assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Zagregowana pewność envelope, 0..1 (np. z judge-score F14 lub średniej
  -- assumptions[].confidence). Etykieta high/medium/low (kontrakt rdzenia
  -- §3.1) jest DERIVED w serwisie z progów — nie duplikujemy jej w schemacie.
  confidence NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),

  -- EvidenceEnvelope.to_verify: [{claim, why, suggested_check?}]
  to_verify JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- EvidenceEnvelope.computed_by: {service, version?, at} — liczby: silnik TS
  -- policzył, nie LLM (kontrakt §3.1 wymaganie computed_by).
  computed_by TEXT,

  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jeden envelope per (artifact_type, artifact_id) — upsert semantyka serwisu.
CREATE UNIQUE INDEX IF NOT EXISTS ux_artifact_evidence_subject
  ON artifact_evidence(artifact_type, artifact_id);

CREATE INDEX IF NOT EXISTS idx_artifact_evidence_org
  ON artifact_evidence(organization_id);
CREATE INDEX IF NOT EXISTS idx_artifact_evidence_type_id
  ON artifact_evidence(artifact_type, artifact_id);
