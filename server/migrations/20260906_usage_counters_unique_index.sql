-- ZLECENIE 1.1-F (2026-09-06): staging `thomas` loguje przy KAŻDYM wywołaniu Teresy
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--   z AccessUsageService.incrementUsage (server/src/services/access/AccessUsageService.ts:82-85):
--     INSERT INTO usage_counters AS uc (id, organization_id, counter_date, <col>)
--     ...
--     ON CONFLICT(organization_id, counter_date) DO UPDATE SET ...
--   -> licznik zużycia AI (limiter/budżet) nigdy się nie zapisuje na stagingu.
--
-- Indeks UNIQUE(organization_id, counter_date) na usage_counters JEST już tworzony przez
-- dwie istniejące migracje — 20260303_schema_alignment.sql:134-135 (CREATE UNIQUE INDEX
-- idx_usage_counters_org_date) i 20260401_access_policy_core_tables.sql:19-33 (CREATE TABLE
-- ... UNIQUE (organization_id, counter_date) + ten sam indeks). Lokalna baza 54400,
-- postawiona ŚCIŚLE z pełnego łańcucha migracji na pustej bazie, MA ten indeks
-- (`\d usage_counters` -> "idx_usage_counters_org_date" UNIQUE, btree (organization_id,
-- counter_date)). Staging `thomas` powstał 02.09 ze zrzutu bazy + odtworzenia rejestru
-- migracji (schema_migrations) — jeśli zrzut pochodził ze stanu SPRZED tego indeksu, a
-- rejestr mimo to oznacza obie migracje jako już odpalone, silnik migracji nigdy ich nie
-- powtórzy i indeks nigdy nie powstanie na żywo. To jest dryf „schemat mieszka poza
-- migracjami” (patrz też: `server/migrations/20260719_baseline_gap.sql:19297`, które
-- odtwarza indeks o TEJ SAMEJ nazwie, ale jako zwykły, NIE-unikalny `CREATE INDEX IF NOT
-- EXISTS` — na świeżej bazie to no-op bo unikalny indeks już istnieje, ale gdyby ten plik
-- kiedykolwiek wykonał się jako pierwszy „producent” tej nazwy, zablokowałby unikalność
-- na dobre pod tą samą nazwą).
--
-- Migracja ADDYTYWNA i idempotentna:
--   1) dedup ewentualnych już istniejących duplikatów (organization_id, counter_date) —
--      bez tego CREATE UNIQUE INDEX rzuci "could not create unique index... duplicate
--      key" na bazie z danymi. Zachowujemy NAJNOWSZY wiersz (wg updated_at, potem
--      created_at, potem id) — to on niesie najbardziej aktualne liczniki; usuwamy
--      starsze duplikaty (bezpieczne, bo to tylko dzienne liczniki użycia, nie dane
--      klienta — a semantyka kolumny jest addytywna, więc świeższy wiersz i tak
--      dominuje przy kolejnym incremencie).
--   2) CREATE UNIQUE INDEX IF NOT EXISTS z DOKŁADNIE tymi kolumnami, których używa
--      ON CONFLICT w kodzie (organization_id, counter_date) i pod TĄ SAMĄ nazwą co
--      istniejące migracje (idx_usage_counters_org_date), żeby nie zdublować indeksu
--      pod inną nazwą.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'usage_counters'
  ) THEN
    -- Krok 1: dedup — zostaw najnowszy wiersz per (organization_id, counter_date).
    DELETE FROM usage_counters t
    WHERE t.ctid IN (
      SELECT ranked.ctid FROM (
        SELECT
          ctid,
          ROW_NUMBER() OVER (
            PARTITION BY organization_id, counter_date
            ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, id DESC
          ) AS rn
        FROM usage_counters
      ) ranked
      WHERE ranked.rn > 1
    );

    -- Krok 2: unikalny indeks dokładnie pod kolumnami z ON CONFLICT w kodzie.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_counters_org_date
      ON usage_counters (organization_id, counter_date);
  END IF;
END $$;
