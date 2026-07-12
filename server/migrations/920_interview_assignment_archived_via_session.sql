-- Migration 920 — #50a: spójny model archived_at Interview (sesje ↔ assignments).
--
-- ⚠️ NIE APLIKOWANA AUTOMATYCZNIE. Ten plik NIE pasuje do wzorca
-- runTablePlatformMigrations (`^(7\d{2}|\d{8})_.*\.sql$`), więc nie zostanie
-- uruchomiona przy boocie serwera. Do ręcznego zastosowania na bazie TROLLEY
-- (staging=demo) przez nadzorcę sesji głównej — patrz skill
-- consultify-promocja-demo.
--
-- ── PROBLEM ──────────────────────────────────────────────────────────────
-- `interview_sessions.archived_at` i `interview_assignments.archived_at` są
-- dwiema NIEZALEŻNYMI kolumnami (InterviewController.ts: sesja @2608
-- applySessionLifecycleAction, assignment @4514 archiveAssignment).
-- Archiwizacja jednej nie dotyka drugiej — assignment przypięty do
-- zarchiwizowanej sesji zostaje widoczny jako aktywny (i odwrotnie).
--
-- ── ROZWIĄZANIE (minimalna spójność, celowo jednokierunkowa) ────────────
-- 1. Archiwizacja SESJI → kaskadowo archiwizuje jej assignments (jeden
--    UPDATE po session_id) — kod w applySessionLifecycleAction.
-- 2. Archiwizacja POJEDYNCZEGO assignmentu (archiveAssignment) NIE rusza
--    sesji — to zostaje jak jest, celowo (assignment = zadanie jednej
--    osoby; sesja może mieć wielu odbiorców/asygnacji).
-- 3. Przywrócenie SESJI → przywraca TYLKO te assignments, które zostały
--    zarchiwizowane TĄ SAMĄ kaskadą (nie te zarchiwizowane ręcznie przez
--    admina niezależnie przez archiveAssignment) — stąd nowa kolumna
--    `archived_via_session`, ustawiana TRUE tylko przez kaskadę sesji i
--    czytana przy restore, żeby session-restore nie "wskrzeszał" czegoś,
--    co ktoś świadomie zarchiwizował osobno.
--
-- Additive + idempotentna (ADD COLUMN IF NOT EXISTS, DEFAULT FALSE — brak
-- zmiany istniejących wartości/zachowania dla wierszy sprzed migracji).
-- Serwer ma też runtime self-healing odpowiednik w
-- ensureInterviewAssignmentLifecycleColumns() (InterviewController.ts) —
-- ten plik jest kanoniczną migracją dla środowisk z formalnym schema-managed
-- deployem; nie trzeba go odpalać, żeby kod działał w dev (DB_MANAGED_SCHEMA
-- off), ale POWINIEN zostać zastosowany na TROLLEY/prod.

BEGIN;

ALTER TABLE interview_assignments
  ADD COLUMN IF NOT EXISTS archived_via_session BOOLEAN DEFAULT FALSE;

-- Backfill: żadny istniejący zarchiwizowany assignment nie był dotąd
-- zarchiwizowany przez kaskadę sesji (kaskada nie istniała przed tym
-- kodem) — FALSE dla wszystkich jest poprawnym stanem początkowym.
UPDATE interview_assignments
   SET archived_via_session = FALSE
 WHERE archived_via_session IS NULL;

CREATE INDEX IF NOT EXISTS idx_interview_assignments_archived_via_session
  ON interview_assignments(session_id, archived_via_session)
  WHERE archived_via_session = TRUE;

COMMIT;
