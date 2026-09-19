# D-126 — audyt 7 migracji `skipped` na stagingu (klasa 6XX_*)

Data pomiaru: 2026-09-19 (odczyt stagingu 08:10–08:17 UTC). Baza: staging, `PostgreSQL 18.4 (Debian 18.4-1.pgdg12+1) on x86_64-pc-linux-gnu`.
Zlecenie: `~/Developer/cto-codex/DLUG-PO-MVP.md:155` — „Jednorazowy audyt: obiekty tych 7 migracji (z tresci w historii git) vs zywy staging (pg_dump -s), lista brakow."
Zakres: TYLKO odczyt. Zero zapisów do bazy, zero migracji, zero zmian w `server/`.

## 1. Werdykt w liczbach

Skip 7 migracji kosztował staging **5 obiektów**, wszystkie z jednego pliku (`656_v4_scim_enhanced.sql`):

| # | Obiekt | Deklaracja (treść historyczna) | Deklaracja (treść obecna) | Na stagingu |
|---|--------|-------------------------------|---------------------------|-------------|
| 1 | `users.scim_external_id` (COLUMN) | `656:3` | `656:3` | **BRAK** |
| 2 | `users.scim_provisioned` (COLUMN) | `656:4` | `656:4` | **BRAK** |
| 3 | `users.scim_last_sync_at` (COLUMN) | `656:5` | `656:5` | **BRAK** |
| 4 | `idx_users_scim_external_id` (UNIQUE INDEX) | `656:7` | `656:7` | **BRAK** |
| 5 | `idx_scim_conflicts_org` (INDEX) | `656:25` | `656:41` | **BRAK** |

Pozostałe obiekty z tych 7 plików ISTNIEJĄ — ale nie dzięki tym migracjom (patrz §4).

Liczniki (przyrząd `audyt-d126.mjs`, ten sam kod, dwa źródła treści):

| Źródło treści | TABLE | INDEX | COLUMN | DML | razem | BRAK |
|---|---|---|---|---|---|---|
| **historyczna** = bajty, których sha256 zgadza się z ledgerem (`checksum ZGODNY 7/7`) | 1/1 | 2/4 | 57/60 | 23 (n/d) | 88 | **5** |
| **obecna** = `server/migrations/never-ran/` dziś | 5/5 | 9/11 | 59/62 | 23 (n/d) | 101 | **5** |

Lista braków jest IDENTYCZNA w obu wariantach — czyli późniejsze edycje plików niczego nie „odzyskały" ani nie zgubiły.

Potwierdzenie metodą z treści zlecenia (`pg_dump -s`, ukierunkowane na `-t public.users -t public.scim_conflict_log -t public.scim_group_mappings`, 325 linii, `pgdump-s-users-scim.txt`):

| Wzorzec | Trafień w `pg_dump -s` | Oczekiwane |
|---|---|---|
| `scim_external_id` | 0 | 0 |
| `scim_provisioned` | 0 | 0 |
| `scim_last_sync_at` | 0 | 0 |
| `idx_users_scim_external_id` | 0 | 0 |
| `idx_scim_conflicts_org` | 0 | 0 |
| kontrola pozytywna: `scim_group_mappings` | 14 | >0 |
| kontrola pozytywna: `scim_conflict_log` | 5 | >0 |
| kontrola pozytywna: `idx_scim_group_mappings_org` | 4 | >0 |
| kontrola pozytywna: `auto_sync` / `member_count` | 1 / 1 | >0 |

## 2. KROK 0 — premissa z DLUG jest w połowie FAŁSZYWA

DLUG:155 twierdzi: „7 migracji 'skipped' … **nie istnieje juz w drzewie** -> zaden preflight ich nie widzi".

- **FAŁSZ** w pierwszej połowie: wszystkie 7 plików JEST w drzewie, w `server/migrations/never-ran/` (154 pliki `.sql` w tym katalogu). Zarchiwizował je commit `879c172944` (2026-07-19) „fix(migrations): archive dead 6XX_* migration class to never-ran/ + 3 idempotent catch-up migrations (E-MIG6XX)". Treść nie zginęła — nie trzeba jej wydobywać z historii, żeby ją przeczytać (historia była potrzebna do czego innego: §3).
- **PRAWDA** w drugiej połowie, i to z dokładnym mechanizmem:
  - `server/scripts/migrate.postgres.ts:157` — `export const KNOWN_EXCLUDED_MIGRATIONS_SUBDIRS = new Set(['ops', 'never-ran', 'rollback']);` → runner w ogóle nie widzi tych plików;
  - `server/src/services/releaseGate/sqlChainEvaluator.ts:133-134` — `fs.readdirSync(deps.migrationsDir)` bez rekursji → `never-ran/` nie trafia do `onDisk`;
  - `sqlChainEvaluator.ts:180-186` — `if (!requiredSet.has(filename)) continue;` → wiersze ledgera `skipped`/`failed` dla plików spoza `requiredSet` NIE są liczone do `sql_ledger_no_skipped` (`release-migration-gate.ts:122`).
  - Efekt: 7 wierszy `skipped` jest niewidzialnych dla runnera, dla bramki release i dla każdego preflightu opartego o te dwa mechanizmy. Dokładnie tak, jak pisze DLUG — tylko powód jest inny niż „nie ma ich w drzewie".

## 3. Checksum ledgera: 7/7 ROZJECHANY z obecną treścią, 7/7 ZGODNY z treścią historyczną

Ledger przechowuje `skipped:<sha256 zawartości utf-8>` (`migrate.postgres.ts:146-149`, forma sprawdzana przez `SKIPPED_CHECKSUM_RE` `:431`). Wszystkie 7 wierszy: `status=skipped`, długość checksumu 72 (8+64), `applied_at` 2026-03-16T17:31:35.837Z … 17:31:37.877Z (2,04 s — jeden przebieg `--safe`).

| Plik | sha ledgera (16) | sha obecnej treści (16) | Werdykt | Commit, w którym treść = ledgerowa |
|---|---|---|---|---|
| `604_tools_missing_known_tools_library.sql` | `7f86f077fe1ce564` | `60ff5e4c90ff0c58` | ROZJECHANY | `771cee0c53` 2026-03-04 |
| `617_generic_assessment_reports_pathc_patch.sql` | `fbf3b0413d2f5363` | `e36740a34a26dd1b` | ROZJECHANY | `bb545034c5` 2026-03-03 |
| `618_tools_missing_12_consulting_tools.sql` | `45d14ffc47f500da` | `37150a444611d341` | ROZJECHANY | `771cee0c53` 2026-03-04 |
| `625_v4_task_hierarchy_unified.sql` | `6d82190103fc00c5` | `cffe9118cf1fcc31` | ROZJECHANY | `12ee900607` 2026-03-05 |
| `656_v4_scim_enhanced.sql` | `cf5aec4e30dda698` | `1db8422dc439c2c1` | ROZJECHANY | `ecb882ca8e` 2026-03-06 |
| `665_v6_interview_templates_foundation.sql` | `0c73014f92644c8c` | `717e253022d143bfc` | ROZJECHANY | `5e44a0f371` 2026-03-08 |
| `666_v6_interview_runtime_answers.sql` | `fcbb8bfcf86bc7f0` | `e9e25c42aa9241d0` | ROZJECHANY | `3bcc437a32` 2026-03-09 |

Wersję historyczną znalazłem przez dopasowanie sha256 bloba z `git log --all` (`historia-ledger.sh`) — bez zgadywania dat. Każda z 7 została potem przepuszczona przez TEN SAM przyrząd: `checksum_zgodny=true` 7/7 (`historia/wynik/wykonanie.log`), więc wiersz „historyczna" w §1 to pomiar na bajtach, które staging faktycznie pominął.

Co się zmieniło po skipie (linie DDL w `diff -u`, `historia/*.diff`):

| Plik | linie +/− | DDL +/− | Charakter zmian |
|---|---|---|---|
| 604 | 18/18 | 0/0 | tylko DML/komentarze |
| 617 | 30/13 | 15/13 | utwardzenie: `ADD COLUMN` → `ADD COLUMN IF NOT EXISTS` (13 tych samych kolumn) + dopisany `CREATE TABLE IF NOT EXISTS generic_assessment_reports` i `idx_generic_org` |
| 618 | 36/36 | 0/0 | tylko DML/komentarze |
| 625 | 2/0 | 2/0 | dopisane 2 kolumny |
| 656 | 14/0 | 3/0 | dopisany `CREATE TABLE scim_group_mappings` + 2 indeksy (dlatego obecna treść deklaruje 5 tabel/11 indeksów zamiast 1/4) |
| 665 | 29/0 | 6/0 | dopisane 6 kolumn |
| 666 | 15/0 | 1/0 | dopisana 1 kolumna |

Wniosek operacyjny: **przywrócenie dzisiejszych plików z `never-ran/` do katalogu skanowanego NIE jest tym samym, co „zastosowanie pominiętych migracji"** — 5 z 7 plików deklaruje dziś więcej obiektów niż w chwili skipu. Za to `status='skipped'` nie blokuje ponownego wykonania: `migrate.postgres.ts:997-1000` liczy jako pending wszystko, co nie ma `status='success'`.

## 4. Dlaczego 83 z 88 obiektów istnieje mimo skipa

Nie dzięki tym migracjom. Przykład mierzalny: `scim_conflict_log` i `scim_group_mappings` tworzy aktywna migracja `server/migrations/20260719_baseline_gap.sql:8615` i `:8628` (plus `scim_sync_logs:8640`, `scim_tokens:8651`) — baseline odtworzył tabele, więc TABLE 1/1 i część indeksów świeci na TAK niezależnie od 656.
Natomiast 3 kolumny `users.scim_*` deklaruje w całym drzewie migracji WYŁĄCZNIE `never-ran/656_v4_scim_enhanced.sql` (`grep -rl scim_external_id server/migrations` = 1 plik) — i dlatego właśnie one przepadły razem ze skipem. `idx_scim_conflicts_org` też jest tylko tam (`656:41`), choć tabela pod nim istnieje.

## 5. Wpływ braków na produkt (zmierzone, nie domniemane)

- Trasy SCIM są zamontowane bezwarunkowo: `server/src/Gateway.ts:1027-1028` — `app.use('/api/scim/v2', scimRoutes)` i `app.use('/api/scim/admin', scimRoutes)` (import `:173`, rejestracja też w `server/src/routes/integrations/index.ts:11,21`).
- `server/src/routes/integrations/scim.routes.ts` odwołuje się do brakujących kolumn w 12 miejscach: `:193`, `:201`, `:320`, `:327`, `:388`, `:403`, `:442`, `:488`, `:489`, `:614`, `:647`, `:1161` (`SELECT`/`UPDATE`/`INSERT` na `users.scim_external_id | scim_provisioned | scim_last_sync_at`). Na Postgresie takie zapytanie kończy się `column … does not exist`.
- `server/src/database/PostgresDatabase.ts:254` wymienia `'scim_provisioned'` — to lista nazw traktowanych jako BOOLEAN, NIE tworzenie kolumny; nie ratuje braku.
- Znalezisko poza zleceniem (DEC-607 — jedno zdanie, ZERO naprawy): te same zapytania w `scim.routes.ts` używają dialektu SQLite (`?` jako placeholder, `datetime('now')`), więc na Postgresie nie zadziałałyby także z istniejącymi kolumnami.
- `idx_scim_conflicts_org` to wyłącznie strata wydajnościowa (tabelę `scim_conflict_log` czyta `scimGroupMappingService.ts` i okolice — 27 odwołań do `scim_group_mappings`/`scim_conflict_log` w `server/src`).

## 6. Znalezisko dodatkowe: wiersz `failed`, który bramka JUŻ widzi

Przy odczycie `status <> 'success'` wyszedł jeszcze jeden wiersz, spoza listy 7:

```
add_response_feedback.sql | failed | applied_at 2026-08-13T09:13:53Z | checksum 8bd8ad809f453239… (64 hex, bez prefiksu)
```

Ten plik JEST w katalogu skanowanym (`server/migrations/add_response_feedback.sql`), więc wpada do `requiredSet` → `sql_ledger_no_failed` (`release-migration-gate.ts:121`) daje `failed=1`, a `sqlChainEvaluator.ts:71` ustawia `state='failed'`. Inaczej niż 7 wierszy `skipped`, ten jest dla bramki widoczny i ją blokuje. Zero naprawy w tym audycie (zakres = lista braków), zgłoszone do DLUG (§9).

Drugi wniosek o samym ledgerze: `assertLedgerRowIsTrusted` (`migrate.postgres.ts:504-528`) sprawdza dla `skipped` wyłącznie FORMĘ checksumu (`:511-519`), nigdy nie porównuje go z bieżącą treścią pliku — dlatego 7/7 ROZJECHANY przechodzi bez jednego ostrzeżenia.

## 7. Mutacje przyrządu (dowód, że liczby są mierzone)

Trzy mutacje, każda uruchomiona na żywym stagingu (tylko `SELECT`), wynik do `/tmp` (nie nadpisuje dowodów):

| Mutacja | Zmiana w kodzie | Oczekiwane | Zmierzone |
|---|---|---|---|
| **M1** fałszywy PASS | `istnieje()` zwraca `true` dla każdego typu | BRAKOW 5 → 0 | TABLE 5/5, INDEX 11/11, COLUMN 62/62, **BRAKOW 0** |
| **M2** fałszywy BRAK | `paraKolumn.clear()` przed raportem | COLUMN 59/62 → 0/62, BRAKOW 5 → 64 | COLUMN **0/62**, **BRAKOW 64** |
| **M3** wyłączone odcinanie komentarzy | `usunKomentarze(src)` → `src.split('\n')` | liczba obiektów musi się zmienić | 101 → **84** (TABLE 3, INDEX 11, COLUMN 52, DML 18), BRAKOW 5 → 4 |

M3 pokazuje kierunek: bez odcinania komentarzy instrukcje zaczynające się od `--` nie łapią się na zakotwiczone regexy, więc przyrząd **gubi** obiekty (a nie dodaje fałszywe). Odcinanie komentarzy jest też mierzalnie potrzebne w drugą stronę: surowe `grep -o 'ADD COLUMN'` daje w obecnej treści 63 trafienia, z czego 1 to komentarz (`666_v6_interview_runtime_answers.sql:68`) → parser poprawnie liczy **62**.

Niezależna kontrola krzyżowa (grep, bez parsera) dla treści historycznej: `CREATE TABLE` 1, `CREATE [UNIQUE] INDEX` 4, `ADD COLUMN` 60 (0 w komentarzach), `INSERT INTO` 10 + `UPDATE` 13 = 23 DML — **co do sztuki** tyle samo, co przyrząd (1/4/60/23).

Przegląd klas instrukcji (żeby wykazać brak ślepej plamki parsera): w 7 plikach historycznych występują wyłącznie `ALTER TABLE … ADD COLUMN`, `CREATE TABLE`, `CREATE [UNIQUE] INDEX`, `INSERT INTO`, `UPDATE`. Zero `DROP`, `DO`, `GRANT`, `REVOKE`, `TRUNCATE`, `COMMENT ON` (pomiar: `grep -ciE` per plik = 0 wszędzie). Cztery klasy przyrządu pokrywają więc 100% instrukcji DDL w tym zbiorze.

### Defekt przyrządu znaleziony i naprawiony w trakcie audytu
`historia-ledger.sh` v1 zdejmował z pola TSV tylko prefiks `skipped:`, a pole nazywa się `ledger=skipped:<sha>` → szukał sha256 równego `ledger=skipped:…` i zameldował `LEDGER_SHA_NIEZNALEZIONY_W_HISTORII` dla wszystkich 7 (fałszywy negatyw). Wychwycone, bo dla 656 miałem wcześniej dopasowanie zmierzone ręcznie (`ecb882ca8e`). Po poprawce (`sha="${ledger#ledger=}"; sha="${sha#skipped:}"`) — 7/7 dopasowane. Wersja v1 nie jest w dowodach; w repo jest tylko v2.

## 8. Ograniczenia pomiaru

1. **DML nie jest weryfikowane obiektowo** (23 instrukcji `INSERT`/`UPDATE` raportowane jako `n/d(DML)`): „czy dane są właściwe" to inne pytanie niż „czy obiekt istnieje"; nie da się go rozstrzygnąć katalogiem.
2. Istnienie sprawdzane **po nazwie**, nie po definicji: indeks o tej samej nazwie i innych kolumnach policzyłby się jako TAK.
3. `pg_dump -s` użyty ukierunkowanie (`-t` na 3 tabele), nie na cały schemat — wystarcza do potwierdzenia 5 braków i 5 kontroli pozytywnych, nie jest pełnym obrazem bazy.
4. Stan stagingu z chwili pomiaru (08:10–08:17 UTC 2026-09-19); baza żyje, więc liczby mogą się zmienić.
5. Audyt nie odpowiada na pytanie, **dlaczego** te 7 plików padło pod `--safe` w 2026-03-16 (komunikaty błędów z tamtego przebiegu nie są w ledgerze — kolumna `error` nie była odczytywana w tym przebiegu).
6. `applied_at` podane w UTC z `toISOString()`; wyświetlenie `psql` to CDT (-0500).

## 9. Co z tego wynika (propozycje, bez wykonania)

- **D-13x-A (produkt):** 3 brakujące kolumny `users.scim_*` + `idx_users_scim_external_id` a 12 odwołań w zamontowanych trasach SCIM. Do decyzji CTO: albo addytywna migracja z puli `20262304+` z `.down.sql` (5 obiektów, wszystkie `IF NOT EXISTS`), albo świadome wyłączenie tras SCIM. Bez decyzji nie ruszam — migracje tylko z jawnym GO w KANAL.md.
- **D-13x-B (bramka/ledger):** `add_response_feedback.sql|failed` blokuje `sql_ledger_no_failed` na stagingu dziś.
- **D-13x-C (higiena ledgera):** brak porównania `skipped:<sha>` z bieżącą treścią pliku (`migrate.postgres.ts:511-519` sprawdza tylko formę) — 7/7 ROZJECHANY przechodzi milcząco.
- **Korekta DLUG:155:** zdanie „nie istnieje juz w drzewie" zamienić na „leżą w `server/migrations/never-ran/`, wyłączone z runnera przez `migrate.postgres.ts:157`" — inaczej następny wykonawca znów zacznie od szukania treści w historii.

## 10. Pliki dowodowe i odtwarzalność

```
evidence/d126-skipped-migrations-20260919/
├── audyt-d126.mjs                     przyrząd (parser + odczyt katalogu; D126_SRC_DIR/D126_OUT_DIR)
├── historia-ledger.sh                 dopasowanie sha256 ledgera do bloba z historii git + diffy
├── wykonanie-baseline.log             przebieg na obecnej treści (stderr per plik + podsumowanie)
├── obiekty-vs-staging.tsv             102 linie = nagłówek + 101 obiektów (obecna treść)
├── checksum-ledger.tsv                7 wierszy: status|applied_at|ledger=|obecna=|werdykt
├── podsumowanie.txt                   liczniki + lista 5 BRAK (obecna treść)
├── pgdump-s-users-scim.txt            pg_dump -s (3 tabele, 325 linii) — potwierdzenie i kontrole
└── historia/
    ├── podsumowanie.txt               7/7 dopasowanych commitów +linie/DDL +/-
    ├── <plik>.ledger.sql  (×7)        treść, którą staging zapisał jako skipped
    ├── <plik>.diff        (×7)        ledgerowa → obecna
    ├── zrodla/            (×7)        kopie .ledger.sql pod nazwami z PLIKI (wejście D126_SRC_DIR)
    └── wynik/                         obiekty-vs-staging.tsv, checksum-ledger.tsv, podsumowanie.txt,
                                       wykonanie.log — przebieg na treści historycznej
```

Odtworzenie (sekret tylko w środowisku, REGUŁA 10 — w plikach evidence zero haseł i URL-i):

```bash
cd /Users/piotrwisniewski/Developer/qoder-wt/consultify-d
D126_DBURL_FILE=<plik-z-URL-bazy> node evidence/d126-skipped-migrations-20260919/audyt-d126.mjs
bash evidence/d126-skipped-migrations-20260919/historia-ledger.sh
D126_DBURL_FILE=<plik-z-URL-bazy> \
  D126_SRC_DIR=$PWD/evidence/d126-skipped-migrations-20260919/historia/zrodla \
  D126_OUT_DIR=$PWD/evidence/d126-skipped-migrations-20260919/historia/wynik \
  node evidence/d126-skipped-migrations-20260919/audyt-d126.mjs
```

Brama REGUŁA 10 dla tego katalogu: grep wzorcem z Wpisu 206 (przypisanie `PGPASSWORD` oraz przypisanie `password`) po `evidence/d126-skipped-migrations-20260919/` → **0 trafień**. Wzorzec ten nie łapie jedynej linii z słowem „password" w tym katalogu (`pgdump-s-users-scim.txt:72` = definicja kolumny `password text,` — schemat, bez wartości i bez znaku przypisania).
