-- ZLECENIE 1.1-F2 (2026-09-06): naprawa MIGRACJI z 20260906_usage_counters_unique_index.sql
--   (scalona lokalnie bcdecd59f0, wdrożona na stagingu `thomas`) — pomiar nadzorcy PO tej
--   migracji na żywym stagingu pokazał, że nie zadziałała:
--     pg_indexes.indexdef = "CREATE INDEX idx_usage_counters_org_date ON
--       usage_counters USING btree (organization_id, counter_date)"   <- BEZ UNIQUE
--   Skutek: AccessUsageService.incrementUsage
--     (server/src/services/access/AccessUsageService.ts:82-85)
--     INSERT INTO usage_counters ... ON CONFLICT(organization_id, counter_date) DO UPDATE ...
--   nadal pada "there is no unique or exclusion constraint matching the ON CONFLICT
--   specification" — licznik zużycia AI (limiter/budżet) na stagingu wciąż się nie zapisuje.
--
-- PRZYCZYNA (dlaczego 20260906_usage_counters_unique_index.sql nie wystarczyła):
--   ta migracja użyła `CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_counters_org_date`.
--   `IF NOT EXISTS` w Postgresie sprawdza WYŁĄCZNIE, czy nazwa jest zajęta — nie sprawdza,
--   czy istniejący obiekt o tej nazwie jest unikalny. Na stagingu `thomas` nazwa
--   `idx_usage_counters_org_date` była JUŻ zajęta przez zwykły (NIE-unikalny) indeks
--   założony przez `server/migrations/20260719_baseline_gap.sql:19297`
--   (`CREATE INDEX if not exists idx_usage_counters_org_date ON ... USING btree
--   (organization_id, counter_date)`) — na stagingu ten plik wykonał się realnie (dryf
--   rejestru migracji po zrzucie 02.09, patrz komentarz w 20260906_...), więc
--   `CREATE UNIQUE INDEX IF NOT EXISTS` z 20260906_... zobaczył zajętą nazwę i był no-opem,
--   NIE podnosząc istniejącego indeksu do unikalności. (Na świeżej bazie z pełnego łańcucha
--   migracji ten sam plik jest no-opem z innego powodu — nazwę zajmuje WCZEŚNIEJSZY
--   `20260303_schema_alignment.sql`, który tworzy ją od razu jako UNIQUE — dlatego lokalna
--   baza 54400 postawiona od zera nigdy nie ujawniła tego problemu.)
--
-- NAZWA PLIKU / SORTOWANIE: migrator (`server/scripts/migrationOrdering.ts`) klasyfikuje
--   pliki DATOWANE przez `DATED_RE = /^(\d{4})-?(\d{2})-?(\d{2})[_-]/` — wymaga `_`/`-` ZARAZ
--   po 8 cyfrach daty. Sufiks literowy w stylu `20260906b_...` NIE pasuje do tego wzorca
--   (potwierdzone: `'20260906b_usage_counters_unique_index_fix.sql'.match(DATED_RE)` => brak
--   dopasowania) i plik wpadłby w `UnclassifiedMigrationFilenameError`, chyba że dopisany do
--   `UNORDERED_PHASE_MANIFEST` (tam mieszka już 9 innych plików z tym samym problemem —
--   `INTRADAY_SUFFIX_MANIFEST`). Zamiast dotykać rejestru klasyfikacji, plik nazwano
--   `20260907_...` — pasuje do DATED_RE wprost, klucz sortowania to `${rok}${miesiąc}${dzień}_
--   ${pełna_nazwa_pliku}` (phaseAndKeyFor, faza 1), więc `20260907_...` > `20260906_...`
--   leksykograficznie i migracja naprawcza ZAWSZE biegnie PO oryginalnej z 06.09 — sprawdzone
--   node-owym testem regexu, patrz raport.
--
-- Migracja ADDYTYWNA i idempotentna, NIE modyfikuje 20260906_usage_counters_unique_index.sql
-- (ta jest już w rejestrze schema_migrations na stagingu):
--   1) dedup ewentualnych duplikatów (organization_id, counter_date) — jak w migracji z 06.09,
--      no-op jeśli 06.09 już posprzątała (zachowujemy najnowszy wiersz).
--   2) jeśli `idx_usage_counters_org_date` istnieje na `usage_counters` i JEST NIEunikalny
--      (pg_index.indisunique = false) → DROP INDEX (usuwa dokładnie ten obiekt, nic więcej).
--   3) CREATE UNIQUE INDEX IF NOT EXISTS pod TĄ SAMĄ nazwą — po kroku 2 nazwa jest wolna
--      (albo już unikalna z wcześniejszego uruchomienia), więc ten krok tworzy prawdziwy
--      unikalny indeks zamiast cichego no-opa.
DO $$
DECLARE
  v_is_unique boolean;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'usage_counters'
  ) THEN
    -- Krok 1: dedup — zostaw najnowszy wiersz per (organization_id, counter_date).
    -- Idempotentne: no-op jeśli duplikatów nie ma (bo 20260906_... już je usunęła, albo
    -- nigdy ich nie było).
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

    -- Krok 2: jeśli nazwa jest zajęta przez NIEunikalny indeks — zdejmij go. `IF NOT EXISTS`
    -- na kroku 3 by tego nie zrobił (sprawdza tylko zajętość nazwy, nie unikalność obiektu).
    SELECT ic.indisunique
      INTO v_is_unique
    FROM pg_index ic
    JOIN pg_class c ON c.oid = ic.indexrelid
    JOIN pg_class t ON t.oid = ic.indrelid
    WHERE c.relname = 'idx_usage_counters_org_date'
      AND t.relname = 'usage_counters';

    IF v_is_unique IS NOT NULL AND v_is_unique = false THEN
      DROP INDEX idx_usage_counters_org_date;
    END IF;

    -- Krok 3: unikalny indeks dokładnie pod kolumnami z ON CONFLICT w kodzie. Po kroku 2
    -- nazwa jest albo wolna (świeżo zdjęta), albo już unikalna (drugie uruchomienie tej
    -- migracji, albo baza gdzie 20260906_... zadziałała poprawnie) — w obu przypadkach ten
    -- krok kończy się GREEN: albo tworzy prawdziwy unikalny indeks, albo dostaje NOTICE
    -- "already exists, skipping" bez błędu.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_counters_org_date
      ON usage_counters (organization_id, counter_date);
  END IF;
END $$;
