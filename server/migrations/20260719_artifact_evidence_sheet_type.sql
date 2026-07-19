-- HP-16 domknięcie (Arkusz/sheet) — rozszerza CHECK artifact_evidence.artifact_type
-- o 'sheet'. SSOT: backlog B-HP16-S (panel adwersaryjny realny 2026-07-19,
-- Harvard/wdrozenie-100/.../PANEL_HP16_REAL.md). Arkusz był JEDYNYM z 8 narzędzi
-- Teresy bez EvidenceContract — generuje w tle (`docGenerationRuntime.startSheet`,
-- 202+poll). Ten fix (patrz `buildSheetEvidenceContract` w
-- `services/evidence/sheetEvidenceContract.ts` + persist w `startSheet`) wymaga,
-- żeby `safePersistEvidenceContract(..., artifactType:'sheet')` mógł faktycznie
-- wstawić wiersz — bez tej migracji INSERT INTO artifact_evidence rzucałby CHECK
-- violation (905 dał 15 wartości, 20260719_..._note dołożył 'note', wciąż bez 'sheet').
--
-- Nazwa sortuje się PO `20260719_artifact_evidence_note_type.sql` ('sheet' > 'note'),
-- więc gdy oba odpalają na świeżym boot, finalny CHECK zawiera i 'note', i 'sheet'.
-- Idempotentna: DROP+ADD w bloku DO. Wzorzec: `20260719_artifact_evidence_note_type.sql`.

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
      'document', 'kpi', 'finance_number', 'benefit', 'canvas', 'project',
      'source', 'assessment', 'note', 'sheet', 'other'
    ));
EXCEPTION WHEN undefined_table THEN
  -- artifact_evidence not created yet in this environment ordering — no-op,
  -- 905_artifact_evidence.sql (which runs first, numerically) creates it.
  NULL;
END $$;
