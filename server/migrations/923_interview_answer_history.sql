-- Migration 923 — #48B: wersjonowanie odpowiedzi wywiadu po send-back.
--
-- ⚠️ NIE APLIKOWANA AUTOMATYCZNIE. Ten plik NIE pasuje do wzorca
-- runTablePlatformMigrations (`^(7\d{2}|\d{8})_.*\.sql$`), więc nie zostanie
-- uruchomiona przy boocie serwera. Do ręcznego zastosowania na bazie TROLLEY
-- (staging=demo) przez nadzorcę sesji głównej — patrz skill
-- consultify-promocja-demo. Wzorowana na
-- 920_interview_assignment_archived_via_session.sql (ta sama nie-auto-apply
-- konwencja + runtime self-healing companion w kodzie).
--
-- ── PROBLEM ──────────────────────────────────────────────────────────────
-- Send-back (InterviewController.ts sendBackAssignment) odsyła assignment do
-- edycji z powodem/brakującymi elementami, ale NIE zachowuje treści
-- odpowiedzi sprzed odesłania. Gdy respondent poprawia i ponownie wysyła,
-- `interview_questions.answer_text` jest nadpisywane — poprzednia wersja
-- ginie bezpowrotnie. Menedżer, który wysłał odpowiedź do poprawy, nie może
-- już porównać "co było" z "co jest teraz".
--
-- ── ROZWIĄZANIE (addytywna, jednostronna snapshot-historia) ─────────────
-- Nowa tabela `interview_answer_history` — snapshot bieżących
-- `interview_questions.answer_text` per pytanie. Jest zapisywany przy submit
-- (`reason='submission'`) jako niezmienny artefakt przekazany do review oraz
-- ponownie tuż przed send-back (`reason='send_back'`) jako wersja bazowa do
-- porównania po poprawkach.
-- Czysty log append-only — bez UPDATE/DELETE w normalnym flow.

BEGIN;

CREATE TABLE IF NOT EXISTS interview_answer_history (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    assignment_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    answer_text TEXT,
    reason TEXT NOT NULL DEFAULT 'send_back',
    saved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    saved_by TEXT,
    FOREIGN KEY (assignment_id) REFERENCES interview_assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES interview_questions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_interview_answer_history_assignment
  ON interview_answer_history(assignment_id, saved_at);

CREATE INDEX IF NOT EXISTS idx_interview_answer_history_question
  ON interview_answer_history(question_id, saved_at);

COMMIT;
