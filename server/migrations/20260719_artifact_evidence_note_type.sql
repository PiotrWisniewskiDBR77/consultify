-- HP-16 domknięcie (Notatnik/note) — rozszerza CHECK artifact_evidence.artifact_type
-- o 'note'. SSOT: panel adwersaryjny realny 2026-07-19
-- (Harvard/wdrozenie-100/.../PANEL_HP16_REAL.md pkt 5) wykazał, że commit
-- `2cd4c674b8` twierdził o note-evidence, ale kod nie istniał (0 kodu,
-- `docs-teresa.e2e.test.ts` = 0 wystąpień słowa "evidence"). Ten fix (patrz
-- `generateDeliverable.ts` gałąź `format === 'note'` +
-- `buildNoteEvidenceContract` w `canvasGraphLlm.ts`) wymaga, żeby
-- `safePersistEvidenceContract(..., artifactType:'note')` mógł faktycznie
-- wstawić wiersz — bez tej migracji INSERT INTO artifact_evidence rzucałby
-- CHECK violation (kolumna miała tylko 15 dozwolonych wartości z 905, bez 'note').
--
-- Idempotentna: DROP+ADD w bloku DO, bezpieczna do wielokrotnego uruchomienia.
-- Wzorzec: `555_partner_resources.sql` (DO $$ ... EXCEPTION WHEN undefined_table).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'artifact_evidence_artifact_type_check'
      AND conrelid = 'artifact_evidence'::regclass
  ) THEN
    ALTER TABLE artifact_evidence DROP CONSTRAINT artifact_evidence_artifact_type_check;
  END IF;

  ALTER TABLE artifact_evidence
    ADD CONSTRAINT artifact_evidence_artifact_type_check
    CHECK (artifact_type IN (
      'insight', 'initiative', 'task', 'decision', 'report', 'deck',
      'document', 'sheet', 'kpi', 'finance_number', 'benefit', 'canvas', 'project',
      'source', 'assessment', 'note', 'other'
    ));
EXCEPTION WHEN undefined_table THEN
  -- artifact_evidence not created yet in this environment ordering — no-op,
  -- 905_artifact_evidence.sql (which runs first, numerically) creates it.
  NULL;
END $$;
