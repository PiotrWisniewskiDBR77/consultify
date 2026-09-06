-- ZLECENIE 1.1-F (2026-09-06): staging `thomas` loguje przy KAŻDYM wywołaniu Teresy
--   "column \"memory_key\" does not exist" z aiContextBuilder.ts:572-573:
--     SELECT memory_key, memory_value FROM ai_organization_memory
--     WHERE organization_id = $1 AND memory_key LIKE 'terminology_%'
--   -> terminologia organizacji dla Teresy nigdy nie ładuje się na stagingu.
--
-- Kolumny memory_key/memory_value NA TABELI ai_organization_memory są tworzone przez DWIE
-- istniejące migracje: 000_initdb_core_tables.sql:1022-1030 (CREATE TABLE ... memory_key
-- TEXT NOT NULL, memory_value TEXT) i 900_prod_missing_tables_hotfix.sql:130-138 (ta sama
-- para kolumn — hotfix z tego samego powodu wykonany już RAZ wcześniej dla produkcji).
-- Lokalna baza 54400, postawiona ŚCIŚLE z pełnego łańcucha migracji na pustej bazie, MA
-- obie kolumny (`\d ai_organization_memory` -> memory_key text not null, memory_value
-- text) — więc lokalnie dryfu NIE MA, kod i migracje są zgodne.
--
-- Dryf jest w innej migracji: `server/migrations/20260719_baseline_gap.sql:1158-1169`
-- tworzy TĘ SAMĄ tabelę drugą definicją — kolumny id/organization_id/memory_type/content/
-- embedding/created_at, BEZ memory_key/memory_value — jako zrzut schematu z innego
-- środowiska w innym momencie. `CREATE TABLE IF NOT EXISTS` z tego pliku jest no-opem
-- WYŁĄCZNIE jeśli 000/900 już wcześniej stworzyły tabelę z memory_key. Staging `thomas`
-- powstał 02.09 ze zrzutu bazy + odtworzonego rejestru migracji (schema_migrations) — jeśli
-- zrzut zamroził strukturę tabeli w wariancie z 20260719_baseline_gap.sql (bez memory_key),
-- a rejestr mimo to oznacza 000/900 jako już odpalone, silnik migracji nigdy ich nie
-- powtórzy i kolumny nigdy nie powstaną na żywo. To ten sam kształt dryfu co przy
-- usage_counters — „schemat mieszka poza migracjami”.
--
-- Migracja ADDYTYWNA i idempotentna: dokłada kolumny (bez NOT NULL — tabela może już mieć
-- wiersze w wariancie memory_type/content/embedding, więc nie wymuszamy wartości na starych
-- rekordach) i indeks po (organization_id, memory_key) pod zapytanie z aiContextBuilder.ts.
-- Nazwy WZIĘTE z migracji (memory_key/memory_value), nie z kodu — kod już używa tych nazw,
-- więc nie ma tu konfliktu nazewnictwa do rozstrzygania.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_organization_memory'
  ) THEN
    ALTER TABLE ai_organization_memory ADD COLUMN IF NOT EXISTS memory_key TEXT;
    ALTER TABLE ai_organization_memory ADD COLUMN IF NOT EXISTS memory_value TEXT;

    CREATE INDEX IF NOT EXISTS idx_ai_organization_memory_org_key
      ON ai_organization_memory (organization_id, memory_key);
  END IF;
END $$;
