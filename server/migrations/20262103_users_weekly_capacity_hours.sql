-- 1.12-R2 (Realizacja › Zasoby) — ŹRÓDŁO PODAŻY GODZIN.
--
-- ŹRÓDŁO WYMAGANIA
--   docs/program/PROGRAM_NAPRAWCZY_20260905/1_12_REALIZACJA_PLAN.md:
--   · C2 wiersz 4 („Zasoby”): kolumny „Popyt (h) · Podaż (h) · Obłożenie % · Luka”
--     oraz wprost „DOBUDOWAĆ źródło podaży (bez niego obłożenie zawsze 0)”;
--   · C5 pytanie 2, rekomendacja CTO przyjęta przez właściciela 06.09:
--     „Etat z profilu (np. 40 h/tydz. × dostępność %) — jedna liczba na osobę,
--     edytowalna. Bez tego kafel »Obłożenie« zostaje »—« na zawsze.”
--
-- POMIAR PRZED KODEM (baza stanowiska, org DBR77 cc9db573-…, 2026-09-06)
--   initiative_resources = 0 wierszy, project_members = 0 wierszy,
--   users = 31, tasks = 84 (81 z osobą, 84 z estimated_hours).
--   `getCapacityTimeline()` (server/src/services/workloadCapacityService.ts)
--   liczy podaż jako COUNT(DISTINCT user_id) FROM initiative_resources × 40 h,
--   więc przy zerowym rejestrze wychodzi capacityHours = 0 w KAŻDYM z 12
--   tygodni i obłożenie 0 % — dokładnie to zmierzył plan (B1).
--   Popyt (godziny zadań) JEST; brakuje wyłącznie strony podaży.
--
-- DLACZEGO NOWA KOLUMNA, A NIE ISTNIEJĄCE POLE
--   · `initiative_resources.allocation_percentage` to przydział DO JEDNEJ
--     inicjatywy, nie etat osoby — osoba bez wpisu ma 0, czyli „nie istnieje”.
--   · `project_members.allocation_percent` ma ten sam kształt (per projekt)
--     i jest w tej organizacji puste.
--   · `user_availability` to obecność w czacie (working_hours_json / dnd),
--     nie wymiar etatu.
--   · `organization_members` nie ma żadnego pola godzinowego.
--   Sprawdzone w katalogu żywej bazy, nie w dokumentacji.
--
-- ADDYTYWNOŚĆ I KOLEJNOŚĆ NA ŚWIEŻEJ BAZIE
--   Wyłącznie `ADD COLUMN IF NOT EXISTS` na `users` — tabeli z bazowego
--   `000_z_core_baseline.sql` (faza 0), która sortuje się PRZED każdą migracją
--   datowaną, więc odtworzenie bazy od zera nie wywraca się na braku tabeli.
--   Obie kolumny są NULLable i BEZ backfillu: NULL znaczy „nikt nie ustawił”,
--   a warstwa serwisu podstawia wtedy politykę 40 h × 100 % (CAPACITY_POLICY).
--   Dzięki temu „ustawione ręcznie 40” różni się od „nie pytaliśmy nikogo”.
--   Cofnięcie = DROP COLUMN, zero zmian w istniejących wierszach.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS weekly_capacity_hours NUMERIC(6,2);
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS availability_percent INTEGER;

COMMENT ON COLUMN users.weekly_capacity_hours IS
  '1.12-R2: etat tygodniowy osoby w godzinach (podaż dla Realizacja › Zasoby). NULL = nie ustawiono, serwis podstawia CAPACITY_POLICY.weeklyHoursPerFte (40).';
COMMENT ON COLUMN users.availability_percent IS
  '1.12-R2: dostępność osoby w procentach etatu (urlop/część etatu/inny program). NULL = nie ustawiono, serwis podstawia 100. Podaż = weekly_capacity_hours × availability_percent / 100.';

COMMIT;
