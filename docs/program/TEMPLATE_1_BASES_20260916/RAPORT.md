# TEMPLATE-1 — trzy systemowe bazy, poprawka W126

**Tor:** B

**Właściciel wykonania:** `[B] Codex-2`

**Decyzje:** KANAL.md W108, W113, W118, W126, W128

**Baza poprawki po wymaganym rebase:** `facf323157a822453f472bee8cdfedd68938e526`

**Zakres:** `DOC-BASE`, `DECK-BASE`, `SHEET-BASE`; obie warstwy danych; bez czystki 96 i bez plików toru A.

## Wynik

Migracja `server/migrations/20262271_template_base_family.sql` utrzymuje trzy zatwierdzone systemowe rodziny:

- `DOC-BASE` aktualizuje kanon `doc-template-system-en-client_final_report`;
- `DECK-BASE` aktualizuje kanon `dbr77-deck-board` z sześciu do ośmiu ról zaakceptowanego decku;
- `SHEET-BASE` tworzy rekord `2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1`; nie promuje Northwind #95;
- dla każdej organizacji utrzymuje jeden origin link do każdej rodziny i kartę w scope tej samej organizacji;
- manualnego `is_draft=1` nie zamienia na kartę aktywną. Readback wymaga najwyżej jednej aktywnej karty rodziny, więc pozostaje prawdziwy także wtedy, gdy czystka 96 świadomie zostawi zero aktywnych kart.

Zmiana nazwy kanonu dokumentu jest jawna: `[System] client final report (EN)` przechodzi na `[System] Client final report (EN)`. Zmiana outline decku z 6 do 8 ról jest celową realizacją zaakceptowanych makiet, nie migracją treści klienta.

## P0 — fresh strict i no-op

Brak runtime-seedowanych źródeł DOC-BASE lub DECK-BASE kończy migrację `NOTICE` i pełnym no-opem. Nie blokuje ogona migracji.

- pełny fresh strict na pustej PostgreSQL 18: **923 migracje, RC=0**;
- po `20262271` wykonały się migracje `948`, cała rodzina `case_workspace` i `init-pgvector.sql`;
- bezpośredni drugi przebieg na pustej bazie: `TEMPLATE-1 no-op: canonical DOC-BASE source is missing`, RC=0;
- na no-op nie powstaje tabela backupu, karta, link ani SHEET-BASE.

Dowody: `evidence/fresh-strict-v2.txt`, `evidence/fresh-strict-v2.exit-code.txt`, `evidence/fresh-noop-v2.txt`.

## P1 — SHEET-BASE zgodny z zaakceptowanym XLSX

`fixtures/supplier-scorecard-accepted.xlsx` jest dokładnym plikiem z makiety, SHA-256 `506d1ade58e98a31ba2d1e04c495dcddf7398ff51edffb015d11e4730e592b63`. `schema_snapshot` jest generowany z tego pliku i opisuje dokładnie:

- arkusze `Supplier scorecard` oraz `Template fields`;
- nagłówki `Supplier · Site · Receipts Q2 · NC Q2 · NC rate Q2 · Receipts Q3 · NC Q3 · NC rate Q3 · Δ pp · Trend · Status`;
- freeze `C7`, autofilter `A6:K12`, brak print titles, zakresy i wymiary wierszy/kolumn;
- wszystkie 28 formuł, w tym ważoną stopę NC w totalu;
- trzy grupy conditional formatting: `H7:H11`, `I7:I11`, `J7:J12`;
- dziewięć wierszy mapy pól.

Automatyczny test porównuje cały snapshot z zaakceptowanym XLSX. Drugi test dowodzi, że wynikowy `artifacts/supplier-scorecard-template-1.xlsx` zachowuje identyczną strukturę po normalizacji fontów. Wynikowy XLSX ma Aptos Display / Aptos i zero literalnych fontów; źródłowy fixture zachowuje oryginalny motyw makiety i służy wyłącznie jako SSOT parytetu.

## P1 — rollback i zachowanie draftu

Przed pierwszym zapisem migracja tworzy jednorazowy JSON backup poprzednich payloadów dwóch kanonów oraz wszystkich istniejących kart i linków, które może zmienić. Znacznik `migration_state/initialized` zapobiega dopisywaniu do backupu obiektów utworzonych przez pierwszy przebieg.

Rollback `server/migrations/rollback/20262271_template_base_family.down.sql`:

- przywraca pełne rekordy DOC-BASE i DECK-BASE z `_backup` JSON;
- przywraca istniejące karty i origin links, także wcześniejsze wadliwe linki cross-org;
- usuwa tylko nowy SHEET-BASE, nowe deterministyczne karty i linki;
- usuwa tabelę backupu po udanym odtworzeniu.

Pełne hashe źródeł, zastanych linked artifacts, origin links i 47 rekordów `tp_base_templates` są identyczne przed migracją i po rollbacku. Nowy SHEET-BASE oraz tabela backupu mają po rollbacku stan `NONE`.

Na dumpie 11.09 zastana karta Board deck `09b7e011-c7d5-438d-97ee-85244a4d6fe9` pozostała `is_draft=1`, `delivery_state=draft`. Licznik draftów przed/po: **1→1**.

## RealPG i język

Na prywatnym PostgreSQL 18 z dumpem `staging-thomas-przed-wdrozeniem-linii-20260911-2036.dump`:

- 29 organizacji, 87 kart połączonych kanonicznymi origin links;
- 86 kart aktywnych i 1 ręczny draft;
- 87 origin links, cross-org/missing = 0;
- drugi przebieg ma identyczne hashe DOC, DECK, SHEET, 87 kart, 87 linków i backupu;
- 47 zastanych `tp_base_templates` pozostaje z `language=NULL`; wyłącznie nowy SHEET-BASE ma `language='en'`. Migracja nie stempluje niezmierzonego języka jako angielskiego.

Dowody: `evidence/realpg-v2-first-run.txt`, `evidence/realpg-v2-second-run.txt`, `evidence/realpg-v2-readback.txt`, `evidence/idempotency-v2-state-{1,2}.txt`, `evidence/rollback-v2-*`.

## Walidacja plików

- DOCX: osiem sekcji, Aptos theme, `docDefaults minorHAnsi`, `altName=Arial`, zero literalnych fontów;
- PPTX: osiem zaakceptowanych ról; szczegółowe poprawki slajdów 6–8 należą do następnego EXPORT-1 etap 1b;
- XLSX: dwa arkusze, 28 formuł, trzy grupy CF, freeze `C7`, autofilter `A6:K12`, zero błędów formuł i zero literalnych fontów w artefakcie wynikowym;
- snapshot parity: **2/2 PASS**;
- OOXML DOCX/XLSX: **PASS**.
- server TSC: **RC=0**, plik dowodu niepusty;
- pełny root/frontend TSC bez limitu, na tej samej współdzielonej instalacji: baza `facf323157` **169 / RC=2** → kandydat **169 / RC=2**; logi są bajtowo identyczne, delta 0;
- ESLint nowych skryptów: **RC=0**.

Nie wykonywano zapisu na staging, deployu ani operacji Railway.
