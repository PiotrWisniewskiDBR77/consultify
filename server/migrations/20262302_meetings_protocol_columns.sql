-- MTG-2 rework etap 2a / DEC-607 (U-52) — protokół spotkania jako dokument.
--
-- Addytywna, idempotentna migracja z puli stanowiska D (20262300-20262319).
-- GO: KANAL.md [D] Wpis 100 (2026-09-17 20:36 CDT), „Zgoda na migracje".
--
-- Zakres (zero innych DDL, zero edycji istniejących migracji):
--   1. ALTER meeting_decisions — pola protokołu bloku „Decyzje":
--        owner_user_id       (imienny właściciel decyzji, użytkownik org),
--        decision_type       (rodzaj decyzji, np. approval/direction/information),
--        impact_text         (wpływ — tekst opisowy),
--        rejected_alternative (wariant odrzucony).
--   2. ALTER meeting_follow_ups — powiązania bloku „Akcje":
--        task_id             (link do zadania w Realizacji po konwersji),
--        agenda_item_id      (akcja przypięta do punktu agendy).
--
-- Kolumny dodane BEZ twardych FK: istniejące wiersze (i dane z kopii dumpu)
-- mają NULL w nowych polach, a `tasks`/`meeting_agenda_items` są dużymi
-- tabelami o własnym cyklu życia — FK ON DELETE SET NULL dodany addytywnie
-- mógłby odrzucić historyczne wiersze przy cascade. Integralność pilnuje
-- warstwa API (meetingProtocolService / meetingNoteTaskFunnelService),
-- która zapisuje task_id/agenda_item_id tylko po zweryfikowaniu celu w org.
-- Indeksy na nowych kolumnach-kluczach odczytu protokołu.
-- [ODMROZENIE 08_MEETINGS DEC-607]

ALTER TABLE meeting_decisions ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
ALTER TABLE meeting_decisions ADD COLUMN IF NOT EXISTS decision_type TEXT;
ALTER TABLE meeting_decisions ADD COLUMN IF NOT EXISTS impact_text TEXT;
ALTER TABLE meeting_decisions ADD COLUMN IF NOT EXISTS rejected_alternative TEXT;

ALTER TABLE meeting_follow_ups ADD COLUMN IF NOT EXISTS task_id TEXT;
ALTER TABLE meeting_follow_ups ADD COLUMN IF NOT EXISTS agenda_item_id TEXT;

CREATE INDEX IF NOT EXISTS idx_meeting_decisions_owner
    ON meeting_decisions (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_follow_ups_task
    ON meeting_follow_ups (task_id);
CREATE INDEX IF NOT EXISTS idx_meeting_follow_ups_agenda_item
    ON meeting_follow_ups (agenda_item_id);
