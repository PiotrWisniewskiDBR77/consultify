-- MTG-1 rework etap 1 / DEC-596 — agenda jako oś spotkania + trwały cykl życia.
--
-- Addytywna, idempotentna migracja z puli stanowiska D (20262300-20262319).
-- GO: KANAL.md [D] Wpis 41 (2026-09-17 19:05 CEST), punkt (c).
--
-- Zakres (zero innych DDL, zero edycji istniejących migracji):
--   1. CREATE TABLE IF NOT EXISTS meeting_agenda_items  — punkt agendy:
--      kolejność, czas (duration), cel (information/discussion/decision),
--      prowadzący punktu, pre-read, powiązanie z inicjatywą/decyzją (link/odczyt).
--   2. ALTER TABLE meetings ADD COLUMN IF NOT EXISTS type / chair_user_id /
--      scribe_user_id / lifecycle_state.
--   3. Idempotentny backfill lifecycle_state z dzisiejszych statusów
--      (scheduled -> scheduled, completed -> closed), tylko WHERE NULL.
--
-- Cykl życia (5 stanów, makieta mtg-rework-20260917):
--   scheduled -> in_progress -> minutes_to_approve -> needs_actions -> closed.
-- Walidację dozwolonych PRZEJŚĆ egzekwuje warstwa API (meetingService),
-- nie CHECK — CHECK pilnuje jedynie zbioru stanów.
-- [ODMROZENIE 10_MEETINGS DEC-596]

CREATE TABLE IF NOT EXISTS meeting_agenda_items (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    meeting_id TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 15,
    purpose TEXT NOT NULL DEFAULT 'information'
        CHECK (purpose IN ('information', 'discussion', 'decision')),
    lead_user_id TEXT,
    pre_read_json TEXT DEFAULT '[]',
    initiative_id TEXT,
    decision_id TEXT,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (now()::text),
    updated_at TEXT DEFAULT (now()::text),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meeting_agenda_items_meeting
    ON meeting_agenda_items (meeting_id, position);
CREATE INDEX IF NOT EXISTS idx_meeting_agenda_items_org
    ON meeting_agenda_items (organization_id);

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS chair_user_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS scribe_user_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS lifecycle_state TEXT;

-- Zbiór stanów cyklu życia jako CHECK, dodawany idempotentnie (osobno od
-- ADD COLUMN IF NOT EXISTS, bo ponowny przebieg pominąłby constraint inline).
DO $lifecycle_check$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'meetings_lifecycle_state_check'
    ) THEN
        ALTER TABLE meetings
            ADD CONSTRAINT meetings_lifecycle_state_check
            CHECK (lifecycle_state IS NULL OR lifecycle_state IN (
                'scheduled', 'in_progress', 'minutes_to_approve',
                'needs_actions', 'closed'
            ));
    END IF;
END;
$lifecycle_check$;

-- Backfill: dzisiejsze statusy -> cykl życia. Idempotentny (WHERE NULL),
-- więc drugi i kolejne przebiegi nie nadpisują stanów ustawionych ręcznie.
UPDATE meetings
   SET lifecycle_state = CASE
         WHEN status = 'completed' THEN 'closed'
         ELSE 'scheduled'
       END
 WHERE lifecycle_state IS NULL;

-- Nowe wiersze startują w stanie scheduled (ustawiane PO backfillu, żeby
-- ADD COLUMN ... DEFAULT nie nadpisał historycznych completed -> closed).
ALTER TABLE meetings ALTER COLUMN lifecycle_state SET DEFAULT 'scheduled';
