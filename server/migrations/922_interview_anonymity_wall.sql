-- Migration 922 — D18-A: anonimowe ankiety Interview, twarda ściana serwerowa.
--
-- ⚠️ NIE APLIKOWANA AUTOMATYCZNIE. Ten plik NIE pasuje do wzorca
-- runTablePlatformMigrations (`^(7\d{2}|\d{8})_.*\.sql$`), więc nie zostanie
-- uruchomiona przy boocie serwera. Do ręcznego zastosowania na bazie TROLLEY
-- (staging=demo) przez nadzorcę sesji głównej — patrz skill
-- consultify-promocja-demo.
--
-- ── DECYZJA WŁAŚCICIELA D18-A (Harvard/wdrozenie-100/_DECYZJE_PIOTRA_2026-07-12.md) ──
-- Ankieta może być oznaczona jako anonimowa przy przypisaniu. Dla anonimowych
-- odpowiedzi menedżer widzi WYŁĄCZNIE AI-score/rubrykę (liczby) — NIGDY
-- answer_text / treść / autora per-odpowiedź. To jest wariant TWARDSZY niż
-- koncept z §6.2 (który dopuszczał motywy) — Piotr wybrał zero treści.
--
-- ── SCHEMAT ──────────────────────────────────────────────────────────────
-- `is_anonymous` na interview_assignments (ustawiane przy tworzeniu przypisania,
-- toggle w UI "Odpowiedzi anonimowe") i lustrzanie na interview_sessions
-- (kopiowane w momencie utworzenia sesji z przypisania — startAssignment /
-- createSessionFromTemplate w InterviewController.ts), żeby endpointy czytające
-- WYŁĄCZNIE po session_id (getQuestions/getNotes/getEvidence/getSummary) mogły
-- sprawdzić anonimowość bez dodatkowego JOIN-a do assignments za każdym razem.
--
-- Additive + idempotentna (ADD COLUMN IF NOT EXISTS, DEFAULT FALSE — ZERO
-- zmiany zachowania dla istniejących wierszy/ankiet nie-anonimowych). Serwer
-- ma runtime self-healing odpowiednik w ensureInterviewAnonymityColumns()
-- (InterviewController.ts) — ten plik jest kanoniczną migracją dla środowisk
-- z formalnym schema-managed deployem; nie trzeba go odpalać, żeby kod
-- działał w dev (DB_MANAGED_SCHEMA off), ale POWINIEN zostać zastosowany na
-- TROLLEY/prod.

BEGIN;

ALTER TABLE interview_assignments
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;

ALTER TABLE interview_sessions
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;

-- Backfill: wszystkie istniejące wiersze sprzed tej migracji są NIE-anonimowe
-- (funkcja nie istniała) — FALSE jest poprawnym stanem początkowym, zero
-- zmiany zachowania.
UPDATE interview_assignments SET is_anonymous = FALSE WHERE is_anonymous IS NULL;
UPDATE interview_sessions SET is_anonymous = FALSE WHERE is_anonymous IS NULL;

CREATE INDEX IF NOT EXISTS idx_interview_assignments_is_anonymous
  ON interview_assignments(is_anonymous)
  WHERE is_anonymous = TRUE;

CREATE INDEX IF NOT EXISTS idx_interview_sessions_is_anonymous
  ON interview_sessions(is_anonymous)
  WHERE is_anonymous = TRUE;

COMMIT;
