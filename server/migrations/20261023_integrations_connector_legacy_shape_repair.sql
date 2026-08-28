-- ============================================================================
-- NAPRAWA ZASTANEGO KSZTALTU `integrations` PRZED 20261023
-- ============================================================================
-- Wzorzec: 956a_partner_referral_legacy_shape_repair.sql /
-- 20260909_backup_receipts_legacy_shape_repair.sql /
-- 20261003_operational_alert_constraint_shape_repair.sql.
-- Ten plik sortuje sie PRZED 20261023_integrations_connector_runtime_shape.sql
-- (ten sam prefiks daty, klucz sortowania = 'YYYYMMDD_<nazwa pliku>', a
-- 'integrations_connector_legacy...' < 'integrations_connector_runtime...').
-- 20261023 nie jest tu w zaden sposob zmieniana.
--
-- OBJAW (staging, przebieg wdrozeniowy):
--   integrations.last_sync_at has incompatible type timestamp with time zone
--   (expected one of: timestamp without time zone); refusing to converge onto
--   a third, unrecognised shape
--
-- PRZYCZYNA (zmierzona, nie zalozona):
-- `integrations` ma w repozytorium DWOCH producentow w samym lancuchu migracji:
--   * server/migrations/256_integrations_system.sql:71  -- kanon; wszystkie
--     znaczniki czasu jako TIMESTAMP (bez strefy), auth_type BEZ domyslnej
--     wartosci, connected_by BEZ domyslnej wartosci;
--   * server/migrations/727_beta_missing_tables.sql:560 -- ten sam
--     CREATE TABLE IF NOT EXISTS, ale token_expires_at / last_sync_at /
--     last_error_at / connected_at / updated_at / disconnected_at jako
--     TIMESTAMPTZ, auth_type DEFAULT 'oauth2', connected_by DEFAULT 'system'.
-- 256 jest migracja numerowana <500. Do czasu wpisania jej na liste
-- PROMOTED_LEGACY_PRODUCERS (server/scripts/migrationOrdering.ts) runner ja
-- POMIJAL, wiec na kazdej bazie zalozonej wczesniej pierwszym producentem
-- bylo 727 -- "first writer wins" przy CREATE TABLE IF NOT EXISTS. Na bazie
-- zakladanej dzis 256 idzie pierwsza (faza 0, klucz 000256 < 000727) i 727
-- jest no-opem. Stad rozjazd: staging niesie ksztalt 727, kanon swiezej bazy
-- to ksztalt 256, a 20261023 sprawdza wlasnie kanon 256.
-- Zmierzone (odczyt information_schema ze stagingu 2026-08-28 + lokalne
-- odtworzenie): staging ma DOKLADNIE ksztalt 727, co do kolumny.
--
-- CO TA MIGRACJA ROBI:
-- Sprowadza szesc znacznikow czasu do kanonu 256 (TIMESTAMP bez strefy,
-- konwersja jawna AT TIME ZONE 'UTC') i zdejmuje z auth_type domyslna
-- wartosc 'oauth2', ktorej kanon 256 nie ma i ktorej macierz domyslnych
-- wartosci w 20261023 nie akceptuje.
--
-- CZEGO TA MIGRACJA CELOWO NIE ROBI:
-- NIE zdejmuje DEFAULT 'system' z connected_by. Kanon 256 deklaruje
-- connected_by jako NOT NULL BEZ domyslnej wartosci, ale 20261023 tej kolumny
-- w ogole nie sprawdza (nie ma jej ani w liscie typow, ani w macierzy
-- domyslnych wartosci), a zdjecie domyslnej wartosci przy zachowanym NOT NULL
-- zepsuloby zywe INSERT-y, ktore tej kolumny nie podaja
-- (server/src/routes/integrations/integrations.routes.ts:319 i :337).
-- To pozostaje jawnie zadeklarowana, NIEBLOKUJACA roznica wobec 256.
--
-- BEZPIECZENSTWO:
-- * fail-closed: kazdy nierozpoznany typ/domyslna wartosc = RAISE EXCEPTION z
--   OBIEMA wartosciami (zastana i oczekiwana), zanim cokolwiek sie zmieni;
-- * bez cichego poprawiania: nie ma sciezki "nieznany ksztalt -> naprawiam";
-- * bez utraty danych: konwersja jawna AT TIME ZONE 'UTC' (nie polega na
--   ustawieniu TimeZone sesji), plus zliczenie wierszy i wartosci NOT NULL w
--   kazdej przestawianej kolumnie PRZED i PO -- rozbieznosc przerywa migracje;
-- * idempotentna: kazdy krok jest warunkowany zastanym typem/domyslna
--   wartoscia, wiec drugi przebieg jest no-opem;
-- * caly plik leci w jednej transakcji runnera (migrate.postgres.ts), wiec
--   RAISE w dowolnym miejscu cofa wszystko.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) PREFLIGHT -- wylacznie odczyt, konczy sie RAISE albo niczym
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  rec RECORD;
  actual_type TEXT;
  actual_default TEXT;
  canonical_oauth2_default TEXT;
BEGIN
  IF to_regclass('public.integrations') IS NULL THEN
    -- Nie ma czego naprawiac: 20261023 zalozy tabele od razu w ksztalcie
    -- docelowym (CREATE TABLE IF NOT EXISTS).
    RETURN;
  END IF;

  -- 1a) Szesc znacznikow czasu rozjezdzajacych sie miedzy 256 a 727.
  FOR rec IN
    SELECT * FROM (VALUES
      ('token_expires_at'),
      ('last_sync_at'),
      ('last_error_at'),
      ('connected_at'),
      ('updated_at'),
      ('disconnected_at')
    ) AS v(col_name)
  LOOP
    SELECT data_type INTO actual_type
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'integrations'
       AND column_name = rec.col_name;

    CONTINUE WHEN actual_type IS NULL;  -- kolumny brak: nie nasza sprawa

    IF actual_type NOT IN ('timestamp with time zone', 'timestamp without time zone') THEN
      RAISE EXCEPTION
        'integrations.% ma typ % — kanon 256 wymaga "timestamp without time zone", zastany ksztalt 727 to "timestamp with time zone". Trzeci, nierozpoznany ksztalt: NIE naprawiam automatem.',
        rec.col_name, actual_type;
    END IF;
  END LOOP;

  -- 1b) auth_type: kanon 256 nie ma domyslnej wartosci, 727 ma 'oauth2'.
  --     Kanonizacje kandydata liczy Postgres na blizniaku w pg_temp, nie
  --     zapisany na sztywno literal (renderowanie DEFAULT nie jest stabilne).
  SELECT data_type INTO actual_type
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'integrations' AND column_name = 'auth_type';

  IF actual_type IS NOT NULL THEN
    IF actual_type <> 'text' THEN
      RAISE EXCEPTION
        'integrations.auth_type ma typ % (oczekiwano: text) — ksztalt nierozpoznany, NIE naprawiam automatem.',
        actual_type;
    END IF;

    SELECT pg_get_expr(d.adbin, d.adrelid) INTO actual_default
      FROM pg_attrdef d
      JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
     WHERE d.adrelid = to_regclass('public.integrations') AND a.attname = 'auth_type';

    IF actual_default IS NOT NULL THEN
      CREATE TEMP TABLE m23_auth_type_twin (c TEXT DEFAULT 'oauth2') ON COMMIT DROP;
      SELECT pg_get_expr(d.adbin, d.adrelid) INTO canonical_oauth2_default
        FROM pg_attrdef d
        JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
       WHERE d.adrelid = 'pg_temp.m23_auth_type_twin'::regclass AND a.attname = 'c';
      DROP TABLE pg_temp.m23_auth_type_twin;

      IF actual_default IS DISTINCT FROM canonical_oauth2_default THEN
        RAISE EXCEPTION
          'integrations.auth_type ma domyslna wartosc % (kanon 256: brak; zastany ksztalt 727: %) — trzecia, nierozpoznana wartosc: NIE naprawiam automatem.',
          actual_default, canonical_oauth2_default;
      END IF;
    END IF;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2) KONWERSJA -- z pomiarem liczby wierszy i wartosci NOT NULL przed i po
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  rec RECORD;
  actual_type TEXT;
  rows_before BIGINT;
  rows_after BIGINT;
  notnull_before BIGINT;
  notnull_after BIGINT;
  had_default BOOLEAN;
BEGIN
  IF to_regclass('public.integrations') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'SELECT count(*) FROM public.integrations' INTO rows_before;

  FOR rec IN
    SELECT * FROM (VALUES
      ('token_expires_at'),
      ('last_sync_at'),
      ('last_error_at'),
      ('connected_at'),
      ('updated_at'),
      ('disconnected_at')
    ) AS v(col_name)
  LOOP
    SELECT data_type INTO actual_type
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'integrations'
       AND column_name = rec.col_name;

    CONTINUE WHEN actual_type IS DISTINCT FROM 'timestamp with time zone';

    EXECUTE format('SELECT count(*) FROM public.integrations WHERE %I IS NOT NULL', rec.col_name)
      INTO notnull_before;

    SELECT EXISTS (
      SELECT 1 FROM pg_attrdef d
        JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
       WHERE d.adrelid = to_regclass('public.integrations') AND a.attname = rec.col_name
    ) INTO had_default;

    -- Domyslna wartosc schodzi przed przestawieniem typu (CURRENT_TIMESTAMP na
    -- kolumnie timestamptz nie przechodzi automatycznej konwersji), i wraca po
    -- nim w brzmieniu kanonu 256 (connected_at/updated_at: CURRENT_TIMESTAMP).
    IF had_default THEN
      EXECUTE format('ALTER TABLE public.integrations ALTER COLUMN %I DROP DEFAULT', rec.col_name);
    END IF;

    EXECUTE format(
      'ALTER TABLE public.integrations ALTER COLUMN %I TYPE TIMESTAMP WITHOUT TIME ZONE USING (%I AT TIME ZONE ''UTC'')',
      rec.col_name, rec.col_name
    );

    IF had_default THEN
      EXECUTE format(
        'ALTER TABLE public.integrations ALTER COLUMN %I SET DEFAULT CURRENT_TIMESTAMP',
        rec.col_name
      );
    END IF;

    EXECUTE format('SELECT count(*) FROM public.integrations WHERE %I IS NOT NULL', rec.col_name)
      INTO notnull_after;

    IF notnull_after IS DISTINCT FROM notnull_before THEN
      RAISE EXCEPTION
        'integrations.%: po konwersji typu liczba wartosci NOT NULL zmienila sie z % na % — przerywam, zeby nie zgubic danych.',
        rec.col_name, notnull_before, notnull_after;
    END IF;
  END LOOP;

  -- auth_type: zdjecie domyslnej wartosci 727 (kanon 256 jej nie ma).
  -- Warunkowe, wiec drugi przebieg to no-op. Kolumna jest juz (albo zaraz
  -- bedzie, krok 3 w 20261023) NULLowalna, wiec brak domyslnej wartosci
  -- oznacza NULL, a nie blad zapisu.
  IF EXISTS (
    SELECT 1 FROM pg_attrdef d
      JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
     WHERE d.adrelid = to_regclass('public.integrations') AND a.attname = 'auth_type'
  ) THEN
    ALTER TABLE public.integrations ALTER COLUMN auth_type DROP DEFAULT;
  END IF;

  EXECUTE 'SELECT count(*) FROM public.integrations' INTO rows_after;
  IF rows_after IS DISTINCT FROM rows_before THEN
    RAISE EXCEPTION
      'integrations: liczba wierszy zmienila sie z % na % w trakcie naprawy ksztaltu — przerywam.',
      rows_before, rows_after;
  END IF;
END $$;
