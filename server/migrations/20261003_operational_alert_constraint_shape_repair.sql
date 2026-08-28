-- OPS-ALERT-001 forward repair: ZASTANY obiekt `uq_operational_alert_signal_org`
-- blokuje 20261003_operational_alert_missed_signal_repair.sql (biegnie zaraz po
-- tej migracji — klucz sortowania
--   20261003_20261003_operational_alert_constraint_shape_repair.sql
-- < 20261003_20261003_operational_alert_missed_signal_repair.sql).
--
-- OBJAW NA STAGINGU:
--   relation "uq_operational_alert_signal_org" already exists
--   RELEASE_MIGRATION_GATE_FAIL
--
-- POMIAR (2026-08-28, lokalny PG17, ZERO polaczen do stagingu):
-- 1. Runner opakowuje kazda migracje w BEGIN/COMMIT, a w `catch` robi
--    ROLLBACK i DOPIERO POTEM zapisuje wiersz 'failed' juz poza transakcja
--    (server/scripts/migrate.postgres.ts:781-812). Dowod mutacyjny: wymuszono
--    blad 20261003 PO linii 98 (usunieto deny_operational_alert_immutable_mutation)
--    -> po przebiegu `pg_constraint`/`to_regclass` = MISSING, a ledger = 'failed'.
--    WNIOSEK: nieudany przebieg 20261003 NIE MOGL zostawic tego ograniczenia.
-- 2. Na pustej bazie caly lancuch przechodzi (exit 0) — wiec kanon jest spojny.
-- 3. W calym repo (wszystkie refy) JEDYNYM producentem tej nazwy jest linia 98
--    20261003. Zero producentow w server/src i scripts/.
--    WNIOSEK: obiekt na stagingu pochodzi z przebiegu, w ktorym 20261003 (albo
--    jej wczesniejszy wariant) ZACOMMITOWALA, a wiersz ledgera zostal pozniej
--    nadpisany na 'failed' (recordResult to UPSERT po `filename`).
--
-- CO ROBI TA MIGRACJA: dowodzi, ze zastany obiekt jest DOKLADNIE tym, co
-- tworzy linia 98, i dopiero wtedy go usuwa, zeby 20261003 mogla odtworzyc go
-- wraz z zaleznym FK. Przy JAKIEJKOLWIEK niezgodnosci PRZERYWA z komunikatem —
-- nie poprawia po cichu i nie zgaduje.
--
-- GWARANCJE: idempotentna · na swiezej bazie = no-op (obiekt jeszcze nie istnieje)
-- · na bazie, gdzie 20261003 ma status 'success' = no-op (obiekt jest jej
-- wlasnoscia) · zero DELETE · zero DROP na tabeli z danymi · zaleznY FK
-- odtwarza 20261003 (linia 99-109), a nie ta migracja.

DO $$
DECLARE
  rel_kind   "char";
  con_oid    OID;
  con_def    TEXT;
  idx_oid    OID;
  idx_def    TEXT;
  dep        RECORD;
  dep_rows   BIGINT;
  CANON_CON_DEF CONSTANT TEXT := 'UNIQUE (signal_id, organization_id)';
  CANON_IDX_DEF CONSTANT TEXT :=
    'CREATE UNIQUE INDEX uq_operational_alert_signal_org ON public.operational_alert_signals USING btree (signal_id, organization_id)';
BEGIN
  -- (0) Swieza baza: obiektu nie ma, 20261003 utworzy go sama.
  IF to_regclass('public.uq_operational_alert_signal_org') IS NULL THEN
    RETURN;
  END IF;

  -- (0b) 20261003 juz zaliczona: obiekt jest JEJ wlasnoscia. Nie ruszamy —
  -- bez tej bramki ponowne uruchomienie tej migracji rozbiloby dzialajaca baze.
  IF to_regclass('public.schema_migrations') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.schema_migrations
                  WHERE filename = '20261003_operational_alert_missed_signal_repair.sql'
                    AND status = 'success') THEN
    RETURN;
  END IF;

  SELECT c.relkind, c.oid INTO rel_kind, idx_oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'uq_operational_alert_signal_org';

  IF rel_kind <> 'i' THEN
    RAISE EXCEPTION 'uq_operational_alert_signal_org istnieje jako relkind=% (oczekiwano indeksu). '
      'Ksztalt nieznany — NIE usuwam automatem.', rel_kind;
  END IF;

  -- (1) Rownowaznosc INDEKSU: kolumny, ich KOLEJNOSC, metoda btree, brak
  -- warunku czesciowego, brak NULLS NOT DISTINCT — wszystko zawarte w indexdef.
  SELECT pg_get_indexdef(idx_oid) INTO idx_def;
  IF idx_def <> CANON_IDX_DEF THEN
    RAISE EXCEPTION 'uq_operational_alert_signal_org ma inna definicje niz kanon 20261003. zastane: [%] kanon: [%]. NIE naprawiam automatem.', idx_def, CANON_IDX_DEF;
  END IF;

  -- (2) Rownowaznosc OGRANICZENIA: musi byc UNIQUE CONSTRAINT na
  -- operational_alert_signals (a nie goly indeks ani ograniczenie na innej tabeli).
  SELECT c.oid, pg_get_constraintdef(c.oid) INTO con_oid, con_def
    FROM pg_constraint c
   WHERE c.conname = 'uq_operational_alert_signal_org'
     AND c.connamespace = 'public'::regnamespace
     AND c.contype = 'u'
     AND c.conrelid = to_regclass('public.operational_alert_signals')
     AND c.conindid = idx_oid;

  IF con_oid IS NULL THEN
    RAISE EXCEPTION 'uq_operational_alert_signal_org istnieje jako indeks, ale NIE jako UNIQUE '
      'CONSTRAINT na public.operational_alert_signals — kanon 20261003 linia 98 wymaga ograniczenia. '
      'NIE naprawiam automatem.';
  END IF;
  IF con_def <> CANON_CON_DEF THEN
    RAISE EXCEPTION 'uq_operational_alert_signal_org: definicja ograniczenia % <> kanon %. '
      'NIE naprawiam automatem.', con_def, CANON_CON_DEF;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE oid = con_oid AND (condeferrable OR NOT convalidated)) THEN
    RAISE EXCEPTION 'uq_operational_alert_signal_org jest DEFERRABLE lub NOT VALID — kanon 20261003 '
      'tworzy je natychmiastowe i zwalidowane. NIE naprawiam automatem.';
  END IF;

  -- (3) Zaleznosci. Kanon 20261003 zna DOKLADNIE jeden FK oparty o ten indeks:
  -- operational_alert_repair_receipts(signal_id,organization_id) (linia 108).
  -- Tabela ta jest tworzona przez TE SAMA migracje (linia 99) i jest ledgerem
  -- operacyjnym — jesli ma wiersze, PRZERYWAMY: to dowody, nie smieci.
  FOR dep IN
    SELECT c.conname, c.conrelid::regclass::text AS tbl
      FROM pg_constraint c
     WHERE c.contype = 'f' AND c.conindid = idx_oid
  LOOP
    IF dep.tbl <> 'operational_alert_repair_receipts' THEN
      RAISE EXCEPTION 'Nieznany FK % na tabeli % opiera sie o uq_operational_alert_signal_org. '
        'Kanon 20261003 zna tylko operational_alert_repair_receipts. NIE ruszam.', dep.conname, dep.tbl;
    END IF;
    EXECUTE format('SELECT count(*) FROM %I', dep.tbl) INTO dep_rows;
    IF dep_rows > 0 THEN
      RAISE EXCEPTION '% ma % wierszy — to pokwitowania naprawcze (dowody operacyjne). '
        'NIE USUWAM ich; rozwiaz recznie zanim wpuscisz release.', dep.tbl, dep_rows;
    END IF;
    -- Pusta i odtwarzana DOSLOWNIE przez 20261003 linia 99-109 (razem z tym FK
    -- i triggerem immutability z linii 126-128). Bez CASCADE: gdyby cokolwiek
    -- innego od niej zalezalo, DROP ma sie wywalic, a nie sprzatnac po cichu.
    EXECUTE format('DROP TABLE %I', dep.tbl);
  END LOOP;

  -- (4) Zdjecie obiektu pochodnego. ZERO danych: unikalnosc odtwarza linia 98
  -- w tym samym lancuchu, kilka instrukcji dalej.
  ALTER TABLE public.operational_alert_signals DROP CONSTRAINT uq_operational_alert_signal_org;
END $$;
