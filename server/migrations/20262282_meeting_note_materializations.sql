-- MTG-2a — trwały rejestr materializacji protokołu spotkania.
--
-- MTG-1/closure miało trwałe `meeting_notes`, ale ścieżka approval -> material
-- zapisuje próby i artefakt w `meeting_note_materializations`. Ta tabela była
-- dotąd zakładana przez runtime helper, więc świeża baza po migracjach nie miała
-- kompletnego protokołu spotkania przed pierwszym wywołaniem kodu. Ten plik
-- przenosi kontrakt do migracji z puli Codex-2 (>20262281).
--
-- Addytywna i idempotentna; brak FK z tego samego powodu co w
-- `20260912_claude_c_meeting_boundary.sql`: fresh-DB replay sortuje po nazwie
-- pliku, więc istnienie tabel właścicielskich nie może być założeniem.

CREATE TABLE IF NOT EXISTS meeting_note_materializations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  meeting_id TEXT NOT NULL,
  note_id TEXT NOT NULL,
  proposal_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  stage TEXT NOT NULL DEFAULT 'content',
  artifact_id TEXT,
  receipt_id TEXT,
  failure_code TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_note_materializations_note
  ON meeting_note_materializations (organization_id, meeting_id, note_id);

CREATE INDEX IF NOT EXISTS idx_meeting_note_materializations_artifact
  ON meeting_note_materializations (organization_id, artifact_id)
  WHERE artifact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_note_materializations_receipt
  ON meeting_note_materializations (organization_id, receipt_id)
  WHERE receipt_id IS NOT NULL;

ALTER TABLE meeting_note_materializations
  DROP CONSTRAINT IF EXISTS meeting_note_materializations_status_check;
ALTER TABLE meeting_note_materializations
  ADD CONSTRAINT meeting_note_materializations_status_check
  CHECK (status IN ('pending', 'failed', 'materialized'));

ALTER TABLE meeting_note_materializations
  DROP CONSTRAINT IF EXISTS meeting_note_materializations_stage_check;
ALTER TABLE meeting_note_materializations
  ADD CONSTRAINT meeting_note_materializations_stage_check
  CHECK (stage IN ('content', 'registry', 'receipt'));
