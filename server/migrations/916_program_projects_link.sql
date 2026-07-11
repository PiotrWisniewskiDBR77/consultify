-- Migration 916: program_id na projektach — domyka hierarchię program → projekty → inicjatywy.
--
-- KONTEKST: Decyzja Piotra "Programy = PEŁNE UI TERAZ, klienci wieloprojektowi".
-- Zwornik D3 = program_id + hierarchia programów. AUDYT PRZED BUDOWĄ (grep w
-- server/src) pokazał, że hierarchia programów W WIĘKSZOŚCI JUŻ ISTNIEJE:
--   - tabela `programs` (migracja 639_v4_programs_hierarchy.sql) — id, org_id,
--     name, status, parent_program_id (nested programs), owner/dates.
--   - `initiatives.program_id` (migracje 625/730) — inicjatywa → program,
--     BEZPOŚREDNIO, już czytane przez InitiativeController.getPortfolioRollups
--     i przez PMO routes (server/src/routes/pmo/initiatives.routes.ts,
--     GET/POST/PUT/DELETE /api/initiatives/programs...).
--   - CRUD programów (list/create/read/update/delete + child-program count +
--     initiative rollup liczony inline w SQL) już live pod /api/initiatives/programs.
--
-- BRAKUJĄCE OGNIWO: `projects` (server/migrations/000_z_core_baseline.sql,
-- 000_initdb_core_tables.sql) NIE MA kolumny program_id — projekt nie da się
-- dziś przypisać do programu, więc rollup "program → PROJEKTY → inicjatywy"
-- (w odróżnieniu od płaskiego "program → inicjatywy" jaki już działa) jest
-- niemożliwy. Ta migracja domyka WYŁĄCZNIE ten brakujący fragment.
--
-- Additive only — nullable TEXT column + index, zero FK constraint (spójne z
-- initiatives.program_id, które też nie ma FK — patrz 625_v4_task_hierarchy_unified.sql
-- i 730_beta_schema_fixes.sql: `ADD COLUMN IF NOT EXISTS program_id TEXT` bez FK).
-- Brak backfill: istniejące projekty stają się "bez programu" (program_id NULL),
-- co jest poprawnym stanem początkowym — nic się nie psuje, programRollupService.ts
-- degraduje się do pustej listy projektów dopóki nikt ich nie przypisze.
--
-- Idempotentna (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS) — bezpieczna
-- do wielokrotnego uruchomienia. NIE URUCHAMIANA tutaj — artefakt do przeglądu,
-- promocja przez skill `consultify-promocja-demo`.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS program_id TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_program_id ON projects(program_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_program ON projects(organization_id, program_id);
