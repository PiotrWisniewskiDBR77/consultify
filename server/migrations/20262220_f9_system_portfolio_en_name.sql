-- Migration 20262220 (F9, 15.09.2026): kontener systemowy inicjatyw — nazwa EN.
--
-- POWOD. Na stagingu `c458374bfa` moduł Projects (flaga `VITE_PMO_PROJECTS`)
-- pokazywał jedyną polską nazwę na całym ekranie targowym:
-- „Portfel — inicjatywy bezpośrednie" (dowód: `wdrozenie-6-20260915/zrzuty/
-- 16-projects-PMO-l6.txt`). DEC-461: oprogramowanie i dane pokazowe po
-- angielsku, polski seed osobno.
--
-- ★ SPROSTOWANIE PREMISY (zmierzone, nie założone). Meldunek linii 6 twierdził,
--   że `initiativeProjectPolicyService.ts` wyszukuje ten kontener PO NAZWIE,
--   więc zmiana wiersza wyprodukuje duplikat. To NIEPRAWDA:
--     server/src/services/initiativeProjectPolicyService.ts:55 i :88
--       SELECT id FROM projects WHERE organization_id = ? AND is_system = TRUE
--   Lookup idzie po STAŁYM KLUCZU `is_system`, strzeżonym partial unique index
--   `uq_projects_org_system_portfolio` (migracja 912 / baseline_gap:18067).
--   Nazwa występuje WYŁĄCZNIE w INSERT jako etykieta wyświetlana. Dlatego
--   nowej kolumny-klucza NIE dokładamy (istnieje), a zmiana nazwy istniejącego
--   wiersza NIE MOŻE wyprodukować duplikatu — unikat trzyma indeks, nie nazwa.
--
-- ZAKRES. Wyłącznie etykieta + opis istniejących wierszy systemowych. Zero DDL,
-- zero zmian klucza, zero nowych wierszy. Dopasowanie po `is_system = TRUE`
-- ORAZ po dokładnej starej nazwie — organizacja, która nazwała swój kontener
-- inaczej (ręcznie), zostaje nietknięta.
--
-- ROLLBACK: server/migrations/rollback/20262220_f9_system_portfolio_en_name.down.sql
-- Idempotentna: drugi przebieg trafia 0 wierszy (stara nazwa już nie istnieje).

UPDATE projects
SET
  name = 'Portfolio — direct initiatives',
  description = 'System container for initiatives created without an assigned project (Zwornik Delta C). Move them to the right project via "Unassigned" → assign.'
WHERE is_system = TRUE
  AND name = 'Portfel — inicjatywy bezpośrednie';
