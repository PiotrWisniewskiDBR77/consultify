-- MTG-2b — wskaźnik obowiązującego protokołu na rekordzie spotkania.
--
-- Zatwierdzony protokół jest materializowany z `meeting_notes`, ale sam obiekt
-- `meetings` nie miał trwałej odpowiedzi „który protokół jest obowiązujący”.
-- Te trzy kolumny zapisują zimny odczyt bez zgadywania po najnowszej notatce.

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS approved_minutes_note_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS approved_minutes_artifact_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS approved_minutes_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_meetings_approved_minutes_artifact
  ON meetings (organization_id, approved_minutes_artifact_id)
  WHERE approved_minutes_artifact_id IS NOT NULL;
