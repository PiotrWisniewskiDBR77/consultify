-- ROLLBACK migracji 20262220 (F9): powrót polskiej nazwy kontenera systemowego.
--
-- Bezpieczne z tego samego powodu co migracja w przód: lookup serwisu idzie po
-- `is_system`, nie po nazwie (initiativeProjectPolicyService.ts:55, :88), a
-- unikat trzyma partial index `uq_projects_org_system_portfolio`. Dotyka
-- wyłącznie wierszy, które migracja w przód faktycznie przestawiła.

UPDATE projects
SET
  name = 'Portfel — inicjatywy bezpośrednie',
  description = 'Kontener systemowy dla inicjatyw utworzonych bez przypisanego projektu (Zwornik Delta C). Przenieś je do właściwego projektu przez „Nieprzypisane” → przypisz.'
WHERE is_system = TRUE
  AND name = 'Portfolio — direct initiatives';
