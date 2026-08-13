# INTEGRITY-02 — zestaw CO-8 był fałszywie zielony bez bazy; teraz jest fail-closed i dowodzi fizycznego INSERT-u

**Data:** 2026-08-10
**Gałąź:** `codex/finance-v3-integrity-ic2-failclosed` (worktree `integrity-ic2-failclosed`)
**Zlecenie:** integrity closeout właściciela, punkty 3–4
**Plik:** `server/src/database/__tests__/closeoutCo8RuntimeDdlInitiativesStatusDefault.pg.test.ts` (jedyna zmiana w kodzie)
**Werdykt:** ZAMKNIĘTE — fałszywa zieleń usunięta, trzy konfiguracje przebadane, kontrola negatywna czerwona, `PostgresDatabase.ts` przywrócony bit w bit.

---

## 1. Co było zepsute (dowiedzione eksperymentalnie, nie z lektury kodu)

Zestaw miał bramkę `RUN_DB_TESTS`/`MOCK_DB`, ale przy KAŻDEJ degradacji ustawiał
`ready = false`, a każdy `it()` zaczynał się od `if (!ready) return;`. Test, który
nic nie sprawdził, jest w vitest testem zdanym. Skutek na nieosiągalnym porcie
(`127.0.0.1:59117`, brak serwera), przy pełnym komplecie „poprawnych" zmiennych:

```
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_MANAGED_SCHEMA=false \
DATABASE_URL=postgresql://postgres@127.0.0.1:59117/postgres npx vitest run …

 Test Files  1 passed (1)
      Tests  5 passed (5)          <-- exit 0
```

Cały łańcuch dowodowy CLOSEOUT-08 opierał się więc na zestawie, który w CI bez
Postgresa raportował sukces, nie dotknąwszy bazy. To nie była hipoteza —
powtórzyłem to przed zmianą (log `/tmp/ic2_...`, konfiguracja B poniżej).

Drugie ustalenie, które zmieniło projekt naprawy: **domyślny reporter vitest 4
NIE drukuje niczego z `console.*`**. Zweryfikowane — ten sam przebieg z
`--reporter=verbose` pokazuje pełny stdout, a bez niego log ma 9 linii. Zatem
„głośny skip" zrobiony przez `console.warn` byłby niewidoczny dokładnie w tym
środowisku, dla którego jest przeznaczony. Głośność musi iść kanałem, który
przeżywa domyślny reporter — czyli linią podsumowania.

---

## 2. Jak zaimplementowany jest fail-closed

**Bramka czytana RAZ, przy ładowaniu modułu** (`ENV_AT_LOAD`), zanim `beforeAll`
zacznie pisać po `process.env`. Poprzednia wersja ustawiała sobie sama
`MOCK_DB=false` i `RUN_DB_TESTS=1`, więc nie potrafiła odróżnić przebiegu
uczciwie skonfigurowanego od naprawionego w locie. Zestaw nie może wmówić sobie
własnych warunków wstępnych.

Bramka jest **asymetryczna**:

| `RUN_DB_TESTS` przy starcie | tryb | zachowanie przy degradacji |
|---|---|---|
| nieustawione | OPTIONAL | skip — jedyna legalna ścieżka pominięcia |
| `""` / `0` / `false` / `no` / `off` | OPTIONAL | skip (jawna rezygnacja wołającego) |
| cokolwiek innego (kanonicznie `1`) | **REQUIRED** | **twardy błąd z diagnostyką** |

W trybie REQUIRED błędem (a nie skipem) jest każde z: `MOCK_DB` różne od
dokładnie `"false"`, brak `DATABASE_URL`/`PGHOST`, serwer nieosiągalny, brak
uprawnień do `CREATE DATABASE`, wyjątek z `initDb()`, brak tabeli `initiatives`
w bazie scratch, przekierowanie puli na inną bazę. Realizuje to jeden punkt
decyzyjny — funkcja `abort(reason): never` — więc nie da się dopisać ścieżki,
która po cichu degraduje do „vacuous pass". Komunikat zawiera powód, kod błędu
sterownika i zrzut środowiska ze zredagowanym hasłem w `DATABASE_URL`.

W trybie OPTIONAL `beforeAll` unwinduje się przez sentinel `SoftSkip`, a każdy
test wołający `requireReady(ctx)` wywołuje **`ctx.skip()`** — jest więc
raportowany jako SKIPPED, nie PASSED. Dzięki temu podsumowanie domyślnego
reportera czyta się `Tests 1 passed | 4 skipped` zamiast `5 passed`. Baner
`console.warn` został zachowany (widoczny pod `--reporter=verbose`/TTY), ale nie
jest już jedynym nośnikiem sygnału.

Zniknął też wzorzec `if (!ready) return;` — wszystkie testy bazodanowe idą przez
`requireReady(ctx)`, który w trybie REQUIRED rzuca.

---

## 3. Kontrola „ready + fizyczny INSERT" (punkt 4 zlecenia)

Zielony wynik ma znaczyć „asercje wykonały się na realnej bazie". Pilnują tego
trzy niezależne kontrole; ich wyniki lądują w bloku dowodowym drukowanym na
koniec przebiegu i są dodatkowo asertowane w teście bramkowym.

**(a) Kontrola celu — czy `initDb()` trafił TAM, gdzie myślimy.**
`PostgresDatabase.ts` potrafi po cichu przekierować: przy loginie bez prawa
`CREATE DATABASE` ustawia `testDatabaseOverride = 'postgres'` i pisze do bazy
utrzymaniowej. Dlatego:
1. pytam **własną pulę aplikacji** (`acquirePgClient()` → `SELECT current_database()`)
   i wymagam równości z nazwą bazy scratch;
2. robię snapshot obecności `initiatives` w bazie `postgres` **przed** `initDb()`
   i sprawdzam, czy tabela nie pojawiła się tam **po** — różnicowo, żeby test
   działał także na serwerze, gdzie `postgres` coś już zawiera.

**(b) Kontrola schematu.** `initiatives` musi istnieć w bazie scratch — to czyni
fakt „runtime DDL się wykonał" faktem, a nie założeniem.

**(c) Kontrola zapisu.** Fixture organizacji wstawiany jest **bez `ON CONFLICT`**
(poprzednia wersja miała `ON CONFLICT DO NOTHING`, co zamienia `rowCount` w
bezużyteczny sygnał), z asercją `rowCount === 1`, po czym potwierdzany
**oddzielnym połączeniem** — dopiero potem jest używany. Właściwy INSERT
inicjatywy asertuje `rowCount === 1`, przyrost `count(*)` dokładnie o 1 oraz
odczyt wiersza i jego statusu przez **drugie, niezależne połączenie** do tej
samej bazy. To istotne: `SELECT` w tej samej sesji zobaczyłby również wiersz
niezacommitowany lub sesyjny; wiersz widoczny z innego połączenia jest wierszem
zacommitowanym. Ten wzorzec — „potwierdzone fixture rows przed każdą próbą" —
już raz w tym strumieniu obalił fałszywy dowód (`UPDATE 0` czytany jako PASS,
bo wiersz nigdy nie powstał).

Blok dowodowy z zielonego przebiegu:

```json
{
  "gate": "REQUIRED (fail-closed)",
  "scratchDatabase": "co8_runtime_ddl_msn7vift173",
  "appPoolCurrentDatabase": "co8_runtime_ddl_msn7vift173",
  "initiativesPresentInScratchDb": true,
  "initiativesLeakedIntoMaintenanceDb": false,
  "organizationInsertRowCount": 1,
  "initiativeInsertRowCount": 1,
  "initiativesRowDelta": 1,
  "readBackOnSecondConnection": "DRAFT"
}
```

---

## 4. Trzy konfiguracje — dowód, że fail-closed działa

Środowisko: postgresql@15 (15.15, Homebrew), `initdb` i `pg_ctl start` pod
`LC_ALL=C`, port 55731 sprawdzony `lsof`, gniazdo w `/tmp/ic2pg`; port martwy do
prób negatywnych: 59117. Vitest uruchamiany z katalogu `server/`.
`DB_MANAGED_SCHEMA=false` — bez tego `getPool()` odpala drugi, równoległy
`initDb()` i Postgres wywala `pg_type_typname_nsp_index`.

### A. `RUN_DB_TESTS=1` + działająca baza → ZIELONY, z widocznym INSERT-em

```
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_MANAGED_SCHEMA=false \
DATABASE_URL=postgresql://postgres@127.0.0.1:55731/postgres \
npx vitest run --reporter=verbose src/database/__tests__/closeoutCo8RuntimeDdlInitiativesStatusDefault.pg.test.ts

 ✓ INTEGRITY-02 gate: green means a real database was reached, or the run is loudly skipped
 ✓ initDb() gives status a default drawn from the canonical status list
 ✓ a status-less INSERT physically lands, survives initiatives_status_check, and reads back as DRAFT
 ✓ still rejects an explicit step3, so the CHECK is genuinely enforcing
 ✓ the runtime DDL source declares the canonical default and not step3 (static guard)

 Test Files  1 passed (1)
      Tests  5 passed (5)              exit 0
```

plus blok dowodowy z §3 (`initiativeInsertRowCount: 1`, `initiativesRowDelta: 1`,
`readBackOnSecondConnection: "DRAFT"`).

### B. `RUN_DB_TESTS=1` + baza nieosiągalna → CZERWONY (przedtem: zielony)

```
… DATABASE_URL=postgresql://postgres@127.0.0.1:59117/postgres npx vitest run …

 FAIL  src/database/__tests__/closeoutCo8RuntimeDdlInitiativesStatusDefault.pg.test.ts
Error: [CLOSEOUT-08 / INTEGRITY-02] FAIL-CLOSED: RUN_DB_TESTS demanded a real PostgreSQL,
so this suite refuses to report a vacuous pass.
  reason: cannot reach the configured PostgreSQL — ECONNREFUSED: connect ECONNREFUSED 127.0.0.1:59117
  environment as read at module load:
    RUN_DB_TESTS      = "1"
    MOCK_DB           = "false"
    DB_TYPE           = "sqlite"
    DB_MANAGED_SCHEMA = "false"
    DATABASE_URL      = "postgresql://postgres@127.0.0.1:59117/postgres"
    PGHOST            = <unset>
    DB_HOST           = <unset>
  to run without a database, unset RUN_DB_TESTS (the suite then skips loudly).

 Test Files  1 failed (1)
      Tests  5 skipped (5)             exit 1
```

Wariant dodatkowy — baza działa, ale `MOCK_DB` nieustawione (dokładnie ta
pułapka, o której ostrzegał nagłówek pliku, a której nie egzekwował):

```
  reason: MOCK_DB must be exactly "false" when RUN_DB_TESTS is set, otherwise the data
          layer serves an in-memory mock and nothing below touches Postgres
 Test Files  1 failed (1)              exit 1
```

**Uboczne ustalenie z tego zrzutu:** `DB_TYPE` przy ładowaniu modułu to
`"sqlite"`, mimo `DB_TYPE=postgres` w linii poleceń — `server/vitest.config.ts`
ma `test.env.DB_TYPE = 'sqlite'`, które nadpisuje środowisko powłoki. Dlatego
bramka celowo NIE opiera się na `DB_TYPE`; zestaw sam ustawia `postgres` przed
importem warstwy danych. Ktokolwiek będzie pisał podobną bramkę w tym repo,
niech nie liczy na `DB_TYPE` z CLI.

### C. Brak `RUN_DB_TESTS` → głośny skip, exit 0

```
DB_TYPE=postgres NODE_ENV=test DB_MANAGED_SCHEMA=false \
DATABASE_URL=postgresql://postgres@127.0.0.1:59117/postgres npx vitest run …

 Test Files  1 passed (1)
      Tests  1 passed | 4 skipped (5)  exit 0
```

Jedyne „passed" to statyczny strażnik, który bazy nie potrzebuje. Cztery testy
bazodanowe są SKIPPED — widoczne w domyślnym reporterze, bez `--reporter=verbose`.
Pod verbose dochodzi baner `NOTHING BELOW WAS VERIFIED` z powodem i instrukcją.

---

## 5. Kontrola negatywna merytoryczna — czy test nadal mierzy to, co ma mierzyć

Tymczasowo (bez commita) cofnąłem naprawę w `server/src/database/PostgresDatabase.ts`,
linia 2533: `status TEXT DEFAULT 'DRAFT'` → `status TEXT DEFAULT 'step3'`.
Konfiguracja A:

```
 Test Files  1 failed (1)
      Tests  3 failed | 2 passed (5)   exit 1

 × initDb() gives status a default drawn from the canonical status list
     AssertionError: expected 'step3' not to be 'step3'
 × a status-less INSERT physically lands, survives initiatives_status_check, and reads back as DRAFT
     error: new row for relation "initiatives" violates check constraint "initiatives_status_check"
 × the runtime DDL source declares the canonical default and not step3 (static guard)
     AssertionError: runtime DDL for `initiatives` re-declares the broken DEFAULT 'step3'
```

Wada jest wykrywana trzema niezależnymi drogami, w tym realnym naruszeniem
CHECK-a na żywej bazie — czyli produkcyjnym objawem, nie parafrazą.

Przywrócenie i weryfikacja:

```
$ shasum -a 256 -c /tmp/ic2_pgdb.sha
server/src/database/PostgresDatabase.ts: OK
$ git diff --stat server/src/database/PostgresDatabase.ts
(pusto)
$ git status --porcelain server/src/database/PostgresDatabase.ts
(pusto)
```

Plik wrócił bit w bit (suma SHA-256 `24e4c6d3418354c097e243debe534f48772714f73770fd2042fe9ecde8a6f324`),
`git diff` czysty.

---

## 6. Co zrobiłem ze statycznym strażnikiem i dlaczego

**Stan poprzedni:** strażnik sprawdzał, że `server/migrations/000_initdb_core_tables.sql`
i `000_z_core_baseline.sql` nie deklarują `DEFAULT 'step3'`.

**Wycofany, celowo, z dwóch powodów.**

1. **Kodował ZŁĄ naprawę.** Oba pliki to migracje JUŻ ZAAPLIKOWANE. Edycja
   zaaplikowanej migracji produkuje cichy migration drift: rejestr/suma
   kontrolna każdej bazy, która wykonała starą treść, przestaje pasować do
   pliku, a w samych bazach nic się nie zmienia. Poprawna architektura naprawy —
   ta, która zostaje po rewercie IC1 — to (i) poprawka runtime DDL w
   `PostgresDatabase.ts` oraz (ii) **addytywna** migracja
   `20260821_initiatives_status_default_draft.sql`. W tej architekturze pliki
   historyczne MAJĄ PRAWO zachować oryginalne `DEFAULT 'step3'`; strażnik tego
   zabraniający oblewałby repozytorium za to, że jest poprawne. Po rewercie IC1
   ten strażnik zacząłby padać — nie dlatego, że coś się zepsuło.
2. **Pilnował kopii zamiast oryginału.** Oba pliki SQL są pochodnymi runtime DDL
   (`000_initdb_core_tables.sql` jest mechanicznie regenerowany z
   `PostgresDatabase.ts` przez `server/scripts/extract-initdb-migration.js`).
   Źródłem jest `PostgresDatabase.ts`.

**Stan obecny:** strażnik czyta `server/src/database/PostgresDatabase.ts`, wycina
blok `CREATE TABLE IF NOT EXISTS initiatives(…)`, usuwa komentarze SQL (w tym
bloku jest komentarz objaśniający, który sam zawiera literał `DEFAULT 'step3'` —
bez usuwania komentarzy strażnik dawałby fałszywy alarm) i sprawdza dwustronnie:

- negatywnie: żadna linia kodu nie deklaruje `status … DEFAULT 'step3'`;
- pozytywnie: kolumna nadal deklaruje default, ten default należy do 13
  kanonicznych statusów i równa się `DRAFT`. Bez tej połowy strażnik przechodziłby
  także wtedy, gdyby kolumnę skasowano lub przemianowano.

Uzasadnienie jest zapisane w komentarzu nad testem w pliku, nie tylko w tym
raporcie. Strażnik jest nadal **słabszy** od dowodu behawioralnego i nie jest
jego substytutem — działa z bazą i bez niej, więc nie wolno go mylić z dowodem,
że zestaw dotarł do Postgresa. Dlatego właśnie liczy się jako to jedno „passed"
w konfiguracji C.

---

## 7. Regresja

Porównanie przed/po na tej samej instancji Postgresa, zakres:
`server/src/database/__tests__/` + `server/src/services/finance/canonical/__tests__/`.

**Konfiguracja CI (bez `RUN_DB_TESTS`, bez `DATABASE_URL`)** — to jest przebieg,
którego dotyczy cała naprawa:

| | Test Files | Tests | exit |
|---|---|---|---|
| przed | 9 passed \| 15 skipped (24) | **147 passed** \| 190 skipped | 0 |
| po | 9 passed \| 15 skipped (24) | **143 passed** \| 194 skipped | 0 |

Różnica to dokładnie 4 testy, które przestały udawać sukces i zaczęły
raportować się jako pominięte. Zero nowych czerwonych, exit nadal 0.

**Konfiguracja z realną bazą (`RUN_DB_TESTS=1`)**: `15 failed | 9 passed` plików
zarówno przed, jak i po zmianie — `diff` zbiorów plików czerwonych przed/po jest
**pusty (IDENTICAL)**. Zestaw CO-8 nie jest wśród nich w żadnym przebiegu.
Te 15 to awarie **przedistniejące i środowiskowe**: suity `*.pg.test.ts` z
`finance/canonical` wymagają bazy przeprowadzonej przez runner migracji, a ja
podstawiłem im goły, świeży Postgres. Liczba czerwonych TESTÓW dryfuje między
przebiegami (20 → 7 → 3) wraz z narastającym stanem serwera — sama w sobie jest
niestabilna i zależna od kolejności; stabilny i porównywalny jest zbiór plików.

Type-check pliku: `tsc --noEmit --strict` → 0 błędów.
Po przebiegach na serwerze nie zostały żadne bazy `co8_runtime_ddl_*`
(`pg_database` = `postgres`, `template0`, `template1`); instancja zatrzymana
`pg_ctl stop` i katalog danych usunięty.

---

## 8. Ograniczenia

- Zielona konfiguracja A dowodzi runtime DDL na **świeżej** bazie. Nie mówi nic
  o bazach istniejących — te leczy migracja `20260821`, mierzona osobno (CLOSEOUT-2).
- Bramka ufa, że `RUN_DB_TESTS=1` w CI faktycznie oznacza dostępny Postgres. Jeśli
  pipeline nie ustawia tej zmiennej, zestaw legalnie się pominie — teraz jednak
  widać to w podsumowaniu (`4 skipped`), a nie jako `5 passed`. Domknięcie tej
  luki to decyzja o konfiguracji CI, nie o treści testu, i wykracza poza allowlist
  tego pakietu.
- 15 czerwonych plików `finance/canonical/*.pg.test.ts` przeciwko gołemu
  Postgresowi to osobny, przedistniejący temat (brak przebiegu migracji przed
  suitą); nie dotykałem go.
