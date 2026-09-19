-- ============================================================================
-- QD12 / D-37 — SYMULACJA runbooka d37-fix.sql na KOPII dumpu stagingu.
-- Baza: consultify_qd11 (pg_restore staging-pre-wdrozenie29-20260918T2052.dump).
-- Staging produkcyjny NIETYKNIĘTY — kopia w kontenerze qoder-d-pg-qd11.
-- Dowodzi: (1) PRZED — produktowy join resolveInitiativeTransitionCase zwraca 0 (409)
--             dla wszystkich 9 inicjatyw NW; (2) PO — zwraca sprawę (1 wiersz) dla 9/9;
--          (3) idempotentny (2. przebieg = 0 zmian, planów NW nadal 1);
--          (4) kolateral (2 plany DBR77 + 9 artifact_links) nienaruszony.
-- ============================================================================
\set ON_ERROR_STOP on
\pset border 2

\echo '==================== RESET (sprzątanie po ewentualnym poprzednim biegu) ======'
DROP TABLE IF EXISTS d37_fix_backup;
UPDATE transformation_cases SET active_plan_id=NULL WHERE transformation_case_id='565fa3f3-5cd3-5589-889b-9fcec0c5cd28';
DELETE FROM transformation_plans WHERE plan_id='d37a5f00-0000-4000-8000-565fa3f3cd28';

\echo '==================== FAZA A — STAN PRZED (oczekiwane: 0 / 0 / NULL / 9) ======='
\echo '--- A1. produktowy join ( Dokładnie SQL z resolveInitiativeTransitionCase ) — ile z 9 inicjatyw NW rezolwuje sprawę (oczekiwane 0 = 409):'
SELECT count(DISTINCT l.artifact_id) AS resolved_initiatives_before
FROM transformation_case_artifact_links l
JOIN transformation_cases c ON c.transformation_case_id=l.transformation_case_id AND c.organization_id=l.organization_id
JOIN transformation_plans p ON p.plan_id=c.active_plan_id AND p.transformation_case_id=c.transformation_case_id AND p.organization_id=c.organization_id
WHERE l.organization_id='468b234c-66c4-54e1-b626-5e0fb3a92f6a' AND l.artifact_type='initiative' AND LOWER(c.status) IN ('active','plan_approved');
\echo '--- A2. join dla JEDNEJ inicjatywy 88013795 z LIMIT 2 (dokładny kształt funkcji) — oczekiwane 0 wierszy:'
SELECT DISTINCT c.transformation_case_id
FROM transformation_case_artifact_links l
JOIN transformation_cases c ON c.transformation_case_id=l.transformation_case_id AND c.organization_id=l.organization_id
JOIN transformation_plans p ON p.plan_id=c.active_plan_id AND p.transformation_case_id=c.transformation_case_id AND p.organization_id=c.organization_id
WHERE l.organization_id='468b234c-66c4-54e1-b626-5e0fb3a92f6a' AND l.artifact_type='initiative' AND l.artifact_id='88013795-c478-5b1a-88da-fce4d1203621' AND LOWER(c.status) IN ('active','plan_approved')
ORDER BY c.transformation_case_id LIMIT 2;
\echo '--- A3. plany NW (oczekiwane 0):'
SELECT count(*) AS nw_plans_before FROM transformation_plans WHERE organization_id='468b234c-66c4-54e1-b626-5e0fb3a92f6a';
\echo '--- A4. active_plan_id sprawy (oczekiwane NULL):'
SELECT active_plan_id AS case_active_plan_before FROM transformation_cases WHERE transformation_case_id='565fa3f3-5cd3-5589-889b-9fcec0c5cd28';
\echo '--- A5. artifact_links sprawy (oczekiwane 9):'
SELECT count(*) AS links_before FROM transformation_case_artifact_links WHERE transformation_case_id='565fa3f3-5cd3-5589-889b-9fcec0c5cd28';

\echo '==================== FAZA A — URUCHOMIENIE 1 runbooka =========================='
\i /tmp/d37-fix.sql
\echo '--- A6. produktowy join PO — ile z 9 inicjatyw NW rezolwuje sprawę (oczekiwane 9):'
SELECT count(DISTINCT l.artifact_id) AS resolved_initiatives_after
FROM transformation_case_artifact_links l
JOIN transformation_cases c ON c.transformation_case_id=l.transformation_case_id AND c.organization_id=l.organization_id
JOIN transformation_plans p ON p.plan_id=c.active_plan_id AND p.transformation_case_id=c.transformation_case_id AND p.organization_id=c.organization_id
WHERE l.organization_id='468b234c-66c4-54e1-b626-5e0fb3a92f6a' AND l.artifact_type='initiative' AND LOWER(c.status) IN ('active','plan_approved');
\echo '--- A7. join dla JEDNEJ inicjatywy 88013795 PO (oczekiwane 1 wiersz = case_id 565fa3f3):'
SELECT DISTINCT c.transformation_case_id
FROM transformation_case_artifact_links l
JOIN transformation_cases c ON c.transformation_case_id=l.transformation_case_id AND c.organization_id=l.organization_id
JOIN transformation_plans p ON p.plan_id=c.active_plan_id AND p.transformation_case_id=c.transformation_case_id AND p.organization_id=c.organization_id
WHERE l.organization_id='468b234c-66c4-54e1-b626-5e0fb3a92f6a' AND l.artifact_type='initiative' AND l.artifact_id='88013795-c478-5b1a-88da-fce4d1203621' AND LOWER(c.status) IN ('active','plan_approved')
ORDER BY c.transformation_case_id LIMIT 2;
\echo '--- A8. plany NW (oczekiwane 1) + active_plan_id ustawiony:'
SELECT count(*) AS nw_plans_after FROM transformation_plans WHERE organization_id='468b234c-66c4-54e1-b626-5e0fb3a92f6a';
SELECT active_plan_id AS case_active_plan_after, status, version FROM transformation_cases WHERE transformation_case_id='565fa3f3-5cd3-5589-889b-9fcec0c5cd28';
\echo '--- A9. backup before-image (oczekiwane 1 wiersz):'
SELECT count(*) AS backup_rows FROM d37_fix_backup;

\echo '==================== FAZA A — URUCHOMIENIE 2 (idempotencja) ===================='
\i /tmp/d37-fix.sql
\echo '--- A10. plany NW NIE rosną (oczekiwane 1):'
SELECT count(*) AS nw_plans_run2 FROM transformation_plans WHERE organization_id='468b234c-66c4-54e1-b626-5e0fb3a92f6a';
\echo '--- A11. join nadal rezolwuje 9/9 (oczekiwane 9):'
SELECT count(DISTINCT l.artifact_id) AS resolved_run2
FROM transformation_case_artifact_links l
JOIN transformation_cases c ON c.transformation_case_id=l.transformation_case_id AND c.organization_id=l.organization_id
JOIN transformation_plans p ON p.plan_id=c.active_plan_id AND p.transformation_case_id=c.transformation_case_id AND p.organization_id=c.organization_id
WHERE l.organization_id='468b234c-66c4-54e1-b626-5e0fb3a92f6a' AND l.artifact_type='initiative' AND LOWER(c.status) IN ('active','plan_approved');
\echo '--- A12. backup NIE rośnie (oczekiwane 1):'
SELECT count(*) AS backup_rows_run2 FROM d37_fix_backup;

\echo '==================== FAZA B — KOLATERAL (oczekiwane: nietknięty) =============='
\echo '--- B1. 2 plany DBR77 obecne, niezmienione:'
SELECT plan_id, status, methodology_key FROM transformation_plans WHERE organization_id='a3e05d4a-5397-419d-b486-8e44366c0063' ORDER BY plan_id;
\echo '--- B2. 9 artifact_links sprawy nietknięte (oczekiwane 9):'
SELECT count(*) AS links_after FROM transformation_case_artifact_links WHERE transformation_case_id='565fa3f3-5cd3-5589-889b-9fcec0c5cd28';
\echo '--- B3. globalna liczba planów (oczekiwane 3 = 2 DBR77 + 1 NW):'
SELECT count(*) AS total_plans FROM transformation_plans;

\echo '==================== FAZA C — PORZĄDKI ======================================'
DROP TABLE IF EXISTS d37_fix_backup;
\echo '--- C1. backup table zdropowana (oczekiwane: brak):'
SELECT to_regclass('public.d37_fix_backup') AS backup_table_after_drop;
\echo '==================== KONIEC SYMULACJI ======================================='
