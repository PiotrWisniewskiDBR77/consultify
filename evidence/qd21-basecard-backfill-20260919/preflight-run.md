# QD21 PREFLIGHT migracji 20262306 — 2026-09-19 07:29 CDT (pomiar PO REBASE)

    linia_integracyjna=66f6b161ec075a75619606dc0bee5fcbd4f28ea3   HEAD=linia (rebase wykonany przed bramką)
    poprzedni tip w chwili startu etapu=4732a6032dbf78229f08ecbbff590f653edadf6f
    galez=qoder/d-qd21-basecard-backfill-20260919
    pliki_delty=server/migrations/20262306_basecard_backfill_missing_orgs.sql
               server/migrations/rollback/20262306_basecard_backfill_missing_orgs.down.sql
               server/src/routes/v8/__tests__/basecardBackfill20262306.pg.test.ts

## §2 kopia (jedna na stanowisko, bez nowego kontenera)

    kontener=qoder-d-pg-9  obraz=pgvector/pgvector:pg18  start=2026-09-19T11:04:44Z  port=127.0.0.1:6638
    baza=consultify_qd21 (kopia dumpu stagingu 2026-09-19)
    silnik=PostgreSQL 18.6 (Debian 18.6-1.pgdg12+2) aarch64
    tabel_w_public=1912
    ODCISK PRE (zmierzony po zjechaniu w dół 20262306 + 20262304 ich własnymi .down.sql):
      arty=1031  linki=956  marker=0  kanoniczne=36  org=13  org_bez_3_kart=1 (ateliertoys-demo)
      scim_kolumny=0
      md5(artifact_id wszystkich kart) = 93ab6abbff7818896ecdbdced2e1bad0  (identyczny z KROK0.md)
    ledger PRZED: 20262304=0 wierszy, 20262305=0, 20262306=0

## §3 preflight --dry-run

    rc_dry_run=0
    Pending migrations: 3
      - 20262304_scim_missing_objects.sql              (zastana, D-136/QD20)
      - 20262305_created_at_timestamptz_etap1.sql      (zastana, D-03 etap 1 — weszła w linię 66f6b161ec)
      - 20262306_basecard_backfill_missing_orgs.sql    (MOJA)
    ASERCJA_PENDING=PASS: pending == {20262304, 20262305, 20262306}; QD14-bis zapowiadał {20262304}, +1 to moja

## §4 UP (realny runner, pełny łańcuch, bez --safe i bez --only)

    NODE_ENV=test DATABASE_URL=<loopback 127.0.0.1:6638/consultify_qd21> \
      npx tsx server/scripts/migrate.postgres.ts --dir server/migrations
    rc_up1=0   Applying migrations: 3 → 20262304, 20262305, 20262306   "Postgres migrations complete"
    PO_UP1: arty=1034 (+3)  linki=959 (+3)  marker=3  kanoniczne=39 (+3)  org_bez_3_kart=0  scim=3
    md5(kart BEZ znacznika) PO_UP1 = 93ab6abbff7818896ecdbdced2e1bad0 == PRE
      → ani jeden wiersz 20262271 nie został dotknięty, przesunięty ani przenumerowany
    3 artefakty ze znacznikiem (identyczne z wyliczeniem md5 z KROK0 i ze smoke w transakcji):
      template-1-docbase-dbe36314c896d1721f89ba349dec6bdd   | DOC-BASE   | report       | ready | [System] Client final report (EN)
      template-1-deckbase-9165a795aa6cee069903513512316ce2  | DECK-BASE  | presentation | ready | Board deck
      template-1-sheetbase-6dbf21b25f2e19a22d352e558a6cd59c | SHEET-BASE | sheet        | ready | Supplier scorecard workbook
    3 linki: abea4a2b0b31e9804065e1725ab649e3 → docbase
             f5ee1c06f2923f3f6d24c87088d1d7bd → deckbase
             5602d301072e153abe54df38ad9ff80c → sheetbase
    ledger PO_UP1 (wszystkie success):
      20262304 | 451917cec8776426   20262305 | 384eb474416b3f3d   20262306 | 62db47a62378f6a2

## §5 bramka release-migration-gate.ts

    RELEASE_TARGET_DB_HOST_FINGERPRINT=127.0.0.1 — wymagane przez gateContract.ts:33 (bez tej zmiennej rc=1
    „RELEASE_TARGET_DB_HOST_FINGERPRINT is required"; fingerprint jest porównywany z `new URL(url).hostname`,
    więc sam port ani nazwa bazy nie przechodzą — zmierzone, nie zgadnięte)
    rc_gate=0
    RELEASE_MIGRATION_GATE_PASS checks=12 hostVerified=true dbIdentity=127.0.0.1:6638/consultify_qd21
    PASS 12/12: sql_ledger_present, sql_ledger_no_failed (failed=0), sql_ledger_no_skipped (skipped=0),
      sql_chain_no_pending (pending=0), sql_chain_no_unexplained_drift, sql_chain_acceptable,
      tp_chain_no_pending, no_unresolved_present_without_history, repair_a/b/c_postcondition,
      schema_coverage_critical_relations (22/22)
    FAIL=0

## §6 UP → DOWN → UP (cykl odtwarzalny)

    DOWN: `psql --single-transaction -v ON_ERROR_STOP=1 < rollback/20262306….down.sql` → rc_down=0
    PO_DOWN: arty=1031  linki=956  marker=0  kanoniczne=36  → ODCISK DOKŁADNIE = PRE
      md5(Wszystkich kart) PO_DOWN = 93ab6abbff7818896ecdbdced2e1bad0 == PRE (cała tabela, nie tylko bez znacznika)
      scim=3 → down NIE dotyka obiektów 20262304 (lekcja D-133)
      v8_promotion_gates.created_at = timestamp with time zone → down NIE cofa 20262305
    delete wiersza ledgera 20262306 → rc_up2=0, Applying migrations: 1
    PO_UP2: arty=1034  linki=959  marker=3  kanoniczne=39  org_bez_3_kart=0  → identyczne z PO_UP1
    STAN_KONCOWY kopii po całym etapie: 1034 / 959 / marker=3 / kanoniczne=39 (zgodny z ledgerem)

## §7 pg_dump -s — dowód, że 20262306 jest DML-only

    dumpy/schema-pre.sql      (przed całym łańcuchem)
    dumpy/schema-po-up1.sql   (po 20262304+20262305+20262306)
    dumpy/schema-po-down.sql  (po DOWN wyłącznie mojej 20262306)
    diff-po-up1-vs-po-down.txt = **0 linii** (porównanie bez tokenów \restrict/\unrestrict pg_dumpa)
      → moja para UP+DOWN nie tworzy ani nie usuwa ŻADNEGO obiektu schematu
    diff-pre-vs-po-up1.txt = 119 linii = 20262304 (3 kolumny scim_*, 2 indeksy) + 20262305 (typy/defaulty
      created_at w 24 tabelach); wierszy mentioning `v8_output_artifacts` lub `v8_artifact_origin_links` = **0**
    (pomiar pomocniczy sprzed rebase, sam łańcuch 20262304+20262306: diff 31 linii, również 0 wspomnień o v8_*)

## §8 checksumy

    62db47a62378f6a27343719326cec8f2146feed757c416f56f497bcf92ce73be  20262306_basecard_backfill_missing_orgs.sql
    e9181f7e508551391b70a55bfda11180b888b477ff7c7772d4d7924ec1b8fee9  rollback/20262306_basecard_backfill_missing_orgs.down.sql
    ledger_checksum_po_up2 = 62db47a62378f6a27343719326cec8f2146feed757c416f56f497bcf92ce73be  (== sha256 pliku)

## §9 kolizja z 20262305 (D-03 etap 1), sprawdzona przed uruchomieniem

    20262305 konwertuje created_at w 24 tabelach (lista VALUES w pliku, linie 74–99); wśród v8_* tylko
    `v8_promotion_gates`. `v8_output_artifacts` i `v8_artifact_origin_links` NIE są konwertowane, więc
    mój zapis `CURRENT_TIMESTAMP::text` pozostaje poprawny. Potwierdzone pomiarem: łańcuch 3 migracji RC=0,
    a po nim created_at moich 3 wierszy to nadal text (brak błędu typu).

## Test RealPG (delta) na drzewie po rebase

    ✓ src/routes/v8/__tests__/basecardBackfill20262306.pg.test.ts (6 tests) 54ms
    Test Files 1 passed (1)   Tests 6 passed (6)
    (przebieg z 20262305 obecną w bazie; po teście kopia przywrócona do stanu zgodnego z ledgerem)

WERDYKT=PASS (pending={20262304,20262305,20262306}; łańcuch 3 migracji RC=0; gate 12/12 FAIL=0;
UP/DOWN/UP RC 0/0/0; kanoniczne 36→39→36→39; org_bez_3_kart 1→0; odcisk PRE 1031/956/md5 93ab6abb…
przywrócony co do wiersza; diff schematu po mojej parze UP+DOWN = 0 linii; zero wierszy 20262271 dotkniętych)
