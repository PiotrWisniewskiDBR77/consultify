-- ============================================================================
-- QD11 / D-49 — SYMULACJA runbooka d49-cleanup.sql na KOPII dumpu stagingu.
-- Baza: consultify_qd11 (pg_restore staging-pre-wdrozenie29-20260918T2052.dump).
-- Staging produkcyjny NIETYKNIĘTY — to jest kopia w kontenerze qoder-d-pg-qd11.
-- Dowodzi: (1) czyści 2 śmieciowe odpowiedzi + 1 snapshot 'CTO smoke',
--          (2) idempotentny (2. przebieg = 0 zmian, backup nie rośnie),
--          (3) kolateral nienaruszony (2 legit snapshoty + 4 legit odpowiedzi).
-- ============================================================================
\set ON_ERROR_STOP on
\pset border 2

\echo '==================== RESET (sprzątanie po ewentualnym poprzednim biegu) ======'
DROP TABLE IF EXISTS d49_cleanup_backup;

\echo '==================== FAZA A — STAN PRZED (oczekiwane: 2 / 1 / 3 / 4) ========='
\echo '--- A1. śmieciowe odpowiedzi (oczekiwane 2):'
SELECT count(*) AS junk_answers_before FROM interview_questions
WHERE organization_id='468b234c-66c4-54e1-b626-5e0fb3a92f6a' AND answer_text='asdf asdf qwerty nie wiem 123';
\echo '--- A2. snapshot CTO smoke (oczekiwane 1):'
SELECT count(*) AS smoke_before FROM execution_report_snapshots
WHERE organization_id='468b234c-66c4-54e1-b626-5e0fb3a92f6a' AND title ILIKE '%CTO smoke%';
\echo '--- A3. wszystkie snapshoty NW (oczekiwane 3):'
SELECT count(*) AS nw_snapshots_total_before FROM execution_report_snapshots
WHERE organization_id='468b234c-66c4-54e1-b626-5e0fb3a92f6a';
\echo '--- A4. legit (nie-śmieci) odpowiedzi w sesji 13c932b0 (oczekiwane 4):'
SELECT count(*) AS legit_answers_before FROM interview_questions
WHERE session_id='13c932b0-e750-410c-996b-66a98f8fb234' AND answer_text IS DISTINCT FROM 'asdf asdf qwerty nie wiem 123';

\echo '==================== FAZA A — URUCHOMIENIE 1 runbooka =========================='
\i /tmp/d49-cleanup.sql
\echo '--- A5. śmieciowe odpowiedzi PO (oczekiwane 0):'
SELECT count(*) AS junk_answers_after FROM interview_questions
WHERE organization_id='468b234c-66c4-54e1-b626-5e0fb3a92f6a' AND answer_text='asdf asdf qwerty nie wiem 123';
\echo '--- A6. snapshot CTO smoke PO (oczekiwane 0):'
SELECT count(*) AS smoke_after FROM execution_report_snapshots
WHERE organization_id='468b234c-66c4-54e1-b626-5e0fb3a92f6a' AND title ILIKE '%CTO smoke%';
\echo '--- A7. wszystkie snapshoty NW PO (oczekiwane 2):'
SELECT count(*) AS nw_snapshots_total_after FROM execution_report_snapshots
WHERE organization_id='468b234c-66c4-54e1-b626-5e0fb3a92f6a';
\echo '--- A8. wiersze w backupie (oczekiwane 3 = 2 odpowiedzi + 1 snapshot):'
SELECT count(*) AS backup_rows FROM d49_cleanup_backup;
\echo '--- A9. przepisane odpowiedzi = propozycja EN (oczekiwane 2 wiersze z nowym tekstem):'
SELECT id, left(answer_text,50) AS new_answer FROM interview_questions
WHERE id IN ('233ae4ce-7069-4578-899c-f20fc0fcbb9d','e563ed82-c572-4829-8206-158f3d2f5a96')
ORDER BY id;

\echo '==================== FAZA A — URUCHOMIENIE 2 (idempotencja) ===================='
\i /tmp/d49-cleanup.sql
\echo '--- A10. śmieciowe odpowiedzi (oczekiwane 0):'
SELECT count(*) AS junk_answers_run2 FROM interview_questions
WHERE organization_id='468b234c-66c4-54e1-b626-5e0fb3a92f6a' AND answer_text='asdf asdf qwerty nie wiem 123';
\echo '--- A11. snapshot CTO smoke (oczekiwane 0):'
SELECT count(*) AS smoke_run2 FROM execution_report_snapshots
WHERE organization_id='468b234c-66c4-54e1-b626-5e0fb3a92f6a' AND title ILIKE '%CTO smoke%';
\echo '--- A12. backup NIE rośnie (oczekiwane 3):'
SELECT count(*) AS backup_rows_run2 FROM d49_cleanup_backup;
\echo '--- A13. snapshoty NW nadal 2 (oczekiwane 2):'
SELECT count(*) AS nw_snapshots_run2 FROM execution_report_snapshots
WHERE organization_id='468b234c-66c4-54e1-b626-5e0fb3a92f6a';

\echo '==================== FAZA B — KOLATERAL (oczekiwane: nietknięty) =============='
\echo '--- B1. 2 legit snapshoty NW obecne z oryginalnymi tytułami/statusami:'
SELECT id, title, status FROM execution_report_snapshots
WHERE organization_id='468b234c-66c4-54e1-b626-5e0fb3a92f6a' ORDER BY created_at;
\echo '--- B2. 4 legit odpowiedzi w sesji 13c932b0 niezmienione (oczekiwane 4):'
SELECT count(*) AS legit_answers_after FROM interview_questions
WHERE session_id='13c932b0-e750-410c-996b-66a98f8fb234'
  AND id NOT IN ('233ae4ce-7069-4578-899c-f20fc0fcbb9d','e563ed82-c572-4829-8206-158f3d2f5a96');

\echo '==================== FAZA C — PORZĄDKI ======================================'
DROP TABLE IF EXISTS d49_cleanup_backup;
\echo '--- C1. backup table zdropowana (oczekiwane: brak):'
SELECT to_regclass('public.d49_cleanup_backup') AS backup_table_after_drop;
\echo '==================== KONIEC SYMULACJI ======================================='
