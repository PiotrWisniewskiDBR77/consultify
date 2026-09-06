# Runner bootowy migracji — diagnoza (2026-09-06)

Pytanie: **czy migracje wykonywane przy starcie serwera (ksiega `tp_migration_history`)
dzialaja na srodowiskach Railway — a jesli nie, to od kiedy i dlaczego?**

Metoda: odczyt kodu + odczyt zmiennych Railway (`railway variables`, wylacznie odczyt) +
odczyt zywych baz demo/staging przez `DATABASE_PUBLIC_URL` (wylacznie SELECT) + odczyt
`/api/health/migrations` i `/api/ready` na zywych domenach + eksperyment kolejnosci na
WLASNEJ, tymczasowej bazie PostgreSQL (kontener, port 55701, usuniety po pracy).
Zadnego zapisu na staging/demo/prod. Zadnej zmiany zmiennej srodowiskowej.

---

## §1. Co steruje uruchomieniem runnera bootowego — kazdy warunek

Sciezka: `server/src/index.ts` → `establishDatabaseReadiness()`
(`server/src/startup/databaseReadiness.ts:87`) → `runMigrations()`
(`server/src/services/tablePlatform/migrationRunner.ts`, ksiega `tp_migration_history`).

Warunki, ktore moga runnera **wylaczyc lub przerwac**, w kolejnosci wystepowania:

| # | Plik:linia | Warunek | Skutek |
|---|---|---|---|
| 1 | `server/src/index.ts:313` + `server/src/startup/testModeGates.ts:107` | `shouldInitializeTestDatabase()` — falsz gdy tryb testowy bez `E2E_MODE`/`ENABLE_TEST_GATEWAY`/realnej bazy | cala sekwencja (IIFE) NIE startuje; `dbReady` nigdy nie ustawione |
| 2 | `server/src/index.ts:324` | `db.isMock \|\| MOCK_DB` | `dbReady=true`, **return przed migracjami** |
| 3 | `server/src/index.ts:269-272` | **`DB_MANAGED_SCHEMA` = `false` \| `0` \| `off`** → `skipManagedSchema` | patrz #4 i #5 |
| 4 | `server/src/index.ts:330` | `skipManagedSchema` → pomija `initializeDatabase()` | brak weryfikacji schematu |
| 5 | **`server/src/index.ts:373-387`** | **`if (skipManagedSchema) { … return; }`** — „verify-only owner-review mode" | **`tpMigrationStatus='disabled_by_operator'`, `dbReady=true`, RETURN. `establishDatabaseReadiness()` NIGDY nie jest wolane. Runner bootowy nie startuje.** |
| 6 | `server/src/index.ts:466` | `DISABLE_TP_MIGRATIONS === 'true'` → `migrationsDisabled` | readiness zwraca `notReady` (fail-closed, serwer nie obsluguje ruchu) |
| 7 | `server/src/index.ts:422,430` | `DB_READINESS_TIMEOUT_MS` (domyslnie 120 000 ms) + `withTimeout` | po przekroczeniu: wyjatek → catch w linii 543 → `tpMigrationStatus='failed'`; przy `NODE_ENV=production` **`process.exit(1)`** |
| 8 | `server/src/index.ts:543` | globalny `catch (err)` | kazdy blad sekwencji → `dbReady=false`; w produkcji `process.exit(1)` |
| 9 | `server/src/index.ts:73` | `isProduction = NODE_ENV === 'production'` | decyduje, czy blad konczy sie wyjsciem procesu czy trybem DEGRADED |

Uwaga: warunki #6, #7, #8 sa **glosne** (fail-closed — serwer odmawia ruchu).
Warunek #5 jest **cichy**: aplikacja melduje `ready`, a migracje po prostu nie istnieja.
To jedyny warunek, ktory wylacza runner bez zadnego widocznego skutku dla uzytkownika.

Zakres runnera bootowego (nie „wszystko"):
`isRuntimeMigrationFile()` = `MIGRATION_PATTERN = /^(7\d{2}|\d{8})_.*\.sql$/` + jawna
allowlista (`server/src/services/tablePlatform/migrationIdentity.ts:58,153`).
Pomiar realnym kodem na `server/migrations` (1117 plikow `.sql`):
- runner **bootowy** odkrywa **757** plikow,
- runner **strict** (`isExecutableMigration`, `server/src/services/releaseGate/migrationExecutionPolicy.ts:71`) wykonuje **907**,
- **delta „tylko bootowy" = 11 plikow** (nazwa zawiera `seed`/`mock`/`demo`, wiec strict je stale wyklucza):

```
771_demo_mock_seed_cleanup.sql
784_dbr77_template_seeds.sql
785_dbr77_template_seeds_f32.sql
20260409_p25d_help_seed_and_lifecycle.sql
20260409_p26_kb_fts5_search.sql
20260411_consultify_partner_kb_seed.sql
20260412_seed_business_templates.sql          <- ZAWEZA CHECK do 7 wartosci
20260608_megatrends_seed.sql
20260628_finance_seed_readiness_fix.sql
20260720_seed_v6_interview_library_templates.sql
20262105_seed_business_templates_origin_runtime_repair.sql   <- naprawa Z6
```

Wazny mechanizm: `reconcileTablePlatformLedgerFromCanonical()`
(`migrationRunner.ts:104`) przepisuje do `tp_migration_history` te pliki, ktore
`schema_migrations` ma jako `success` z pasujaca suma kontrolna — **bez ponownego
wykonania SQL**. Dlatego przy starcie runner bootowy wykonuje realnie tylko te 11 plikow
delty (reszte tylko „ksieguje").

---

## §2. Stan zmiennych na Railway (odczyt 2026-09-06, projekt `consultify`, serwis `consultify`)

| Srodowisko | `DB_MANAGED_SCHEMA` | `DISABLE_TP_MIGRATIONS` | `MOCK_DB` | `DB_READONLY` | Runner bootowy |
|---|---|---|---|---|---|
| **staging** | **`off`** | brak | brak | brak | **WYLACZONY** |
| **demo** | **BRAK zmiennej** | brak | brak | brak | **DZIALA** |
| **production** | **`off`** | brak | brak | brak | **WYLACZONY** |
| **dev** | **`off`** | brak | brak | brak | **WYLACZONY** |

**Odpowiedz wprost: na stagingu runner bootowy wylacza zmienna `DB_MANAGED_SCHEMA=off`**
(warunek #5, `server/src/index.ts:373`). To samo dotyczy `production` i `dev`.
Na **demo** zmiennej nie ma — runner bootowy tam **dziala**.

Potwierdzenie na zywym runtime (GET, bez zapisu):

```
staging.consultify.ai /api/health/migrations
  "migrations":{"state":"disabled_by_operator",
                "detail":"DB_MANAGED_SCHEMA=off; Table Platform ledger not evaluated"}
  "sqlMigrations":{"state":"error","detail":"DB_MANAGED_SCHEMA=off; SQL migration ledger not evaluated"}
  "databaseReady":true      <- aplikacja melduje gotowosc mimo niezweryfikowanego schematu
  buildSha a05a749fcc7f6f99b6df18ed01b5ade4a6993d2e

demo.consultify.ai /api/health/migrations
  "migrations":{"state":"ok","detail":"0 applied, 556 already up to date"}
  "sqlMigrations":{"state":"ok","detail":"chain complete; 32 approved historical variant(s); …"}
  buildSha f3237e94230481d2bf4ad0a9c0dc10b1391191c9   <- demo na STARSZYM buildzie niz staging
```

Stan ksiag (odczyt bezposredni, `SELECT`):

| | demo (`trolley`) | staging (`thomas`) |
|---|---|---|
| `tp_migration_history` | 656 wierszy, max `executed_at` = **2026-08-22 14:57:50Z** | 656 wierszy, max `executed_at` = **2026-08-22 14:57:50Z** |
| `schema_migrations` | 948 success / 1 failed / 7 skipped, ostatni 2026-08-28 | 997 success / 1 failed / 7 skipped, ostatni **2026-09-06 21:12Z** |
| CHECK `…origin_runtime_check` | 10 wartosci (z `work_canvas`) | 10 wartosci (z `work_canvas`) |
| wierszy `origin_runtime='work_canvas'` | **0** | **0** |

To sa **dwie rozne instancje** (rozne `inet_server_addr`, rozny `pg_postmaster_start_time`,
rozny stan `schema_migrations`), ale o wspolnym pochodzeniu — identyczna liczba wierszy TP,
identyczny znacznik czasu ostatniego wpisu i identyczne 1434 uzytkownikow wskazuja na klon
jednej bazy z okolic 22-28.08.

**Sprostowanie tezy z instrukcji:** ksiega TP milczy od 22.08 na OBU srodowiskach, ale
z **dwoch roznych powodow**. Na stagingu runner jest wylaczony zmienna. Na demo runner
dziala i przy kazdym starcie melduje „0 applied, 556 already up to date" — po prostu nie ma
tam nic nowego do zrobienia, bo demo stoi na starszym buildzie (f3237e94), ktorego
komplet 556 odkrywanych plikow juz jest w ksiedze.

---

## §3. Co sie zmienilo okolo 2026-08-22

**Commit `2b5bcb2593` — „preserve and reconcile quarantined worktrees", 2026-08-22 23:01:15 +0200.**
Dodal do `server/src/index.ts` dokladnie ten blok (diff):

```diff
+        // A verify-only owner-review runtime may connect to an already
+        // qualified shared database, but it must not run any DDL, migrations
+        // or seeders. DB_READONLY remains the independent write guard.
+        if (skipManagedSchema) {
+          tpMigrationStatus = { state: 'disabled', detail: 'DB_MANAGED_SCHEMA=off' };
+          sqlMigrationStatus = { state: 'disabled', failed: 0, pending: 0, applied: 0 } as any;
+          dbReady = true;
+          dbInitError = null;
+          logger.info('[Server] Database connected in verify-only owner-review mode');
+          return;
+        }
```

Przed tym commitem `DB_MANAGED_SCHEMA=off` pomijalo **tylko** `initializeDatabase()`
(`index.ts:330`) — sekwencja szla dalej i runner bootowy **wykonywal sie mimo tej zmiennej**.
Po tym commicie `off` oznacza pelny `return` przed `establishDatabaseReadiness()`.

Zbieznosc jest dokladna: ostatni wpis w `tp_migration_history` obu srodowisk ma znacznik
**2026-08-22 14:57:50Z**, commit powstal **2026-08-22 21:01Z**. Od nastepnego deployu
staging/prod/dev przestaly wykonywac cokolwiek z listy 11 plikow delty.

Czego tu NIE zmierzylem: **kiedy** ustawiono `DB_MANAGED_SCHEMA=off` na stagingu.
Railway CLI nie udostepnia historii zmian zmiennych, a ja nie mam prawa jej zmieniac.
Mozliwe, ze zmienna byla tam od dawna i dopiero commit `2b5bcb2593` nadal jej to znaczenie —
to najbardziej prawdopodobny przebieg, ale nie jest zmierzony.

---

## §4. Co realnie stanie sie z NOWA, PUSTA baza postawiona na Railway

Sciezka wdrozenia (`railway.json` / `railway.api.json`):
`preDeployCommand: node dist/scripts/release-migration-gate.js` →
`server/scripts/release-migration-gate.ts:325-355` uruchamia **pelny lancuch strict**
(`migrate.postgres`, bez `--only`/`--safe`/`--allow-checksum-drift`), a po nim weryfikuje stan.
Dopiero potem startuje aplikacja (`server/src/index.ts`).

### Wariant A — srodowisko z `DB_MANAGED_SCHEMA=off` (staging, production, dev)

1. Bramka wdrozenia wykonuje 907 plikow strict w kolejnosci fazowej
   (faza 0: numerowane wg numeru; faza 1: datowane wg kalendarza).
   Pliki dotykajace CHECK, w tej kolejnosci: `20260330` (8 wartosci) → `20260724` (8) →
   `20260807` (10, z `work_canvas`) → `20260808` (9, swiadomie usuwa `work_canvas`).
2. Start aplikacji: `skipManagedSchema` → **return, runner bootowy nie startuje**.
   Zadnego z 11 plikow delty (w tym `20260412_seed_business_templates.sql`) nie ma.

**Koncowy CHECK: 9 wartosci** — `report, presentation, sheet, native_artifact,
assessment_report, report_template, presentation_template, sheet_template, document_template`.
Bez `work_canvas`. **Schemat poprawny.**

**Wniosek: scenariusz „swieza baza wstaje cicho uszkodzona" NIE dotyczy stagingu,
produkcji ani dev.** Tam `20260412` nie ma jak sie wykonac.

### Wariant B — srodowisko BEZ `DB_MANAGED_SCHEMA` (**demo — to, na ktorym ma byc pilotaz**)

1. Bramka wdrozenia — jak wyzej, CHECK konczy na 9 wartosciach.
2. Start aplikacji: `establishDatabaseReadiness()` → `runMigrations()`.
   `reconcileTablePlatformLedgerFromCanonical()` przepisuje do TP wszystko, co strict
   wykonal (bez ponownego SQL), zostaje **11 plikow pending**. Runner wykonuje je
   w kolejnosci `compareMigrationFilenames` (dlugosc prefiksu, potem prefiks, potem nazwa):
   `771…` → `784…` → `785…` → `20260409×2` → `20260411` → **`20260412` (ZAWEZA CHECK do 7)** →
   `20260608` → `20260628` → `20260720` → **`20262105` (PRZYWRACA 9)**.

**Koncowy CHECK zalezy od tego, czy build zawiera plik naprawczy `20262105`:**

| Build | Koncowy CHECK na swiezej bazie demo |
|---|---|
| **bez `20262105`** (np. dzisiejszy build demo `f3237e94`) | **7 wartosci** — brak `document_template` i `assessment_report`. Baza wstaje CICHO USZKODZONA: `/api/ready` = ready, a zapisy z `document-studio.routes.ts` i `AssessmentWorkbenchService` lecą na naruszenie CHECK. |
| **z `20262105`** (paczka 15, obecna na stagingu) | **9 wartosci** — identycznie jak Wariant A. Poprawnie. |

Eksperyment potwierdzajacy (wlasna baza PostgreSQL 16 w kontenerze, port 55701, usunieta po pracy —
odtworzone obie fazy w realnej kolejnosci, realnymi trescia plikow):

```
  strict 20260330…: 8
  strict 20260724…: 8
  strict 20260807…: 10
  strict 20260808…: 9
PO FAZIE A (bramka wdrozenia, strict): 9
  boot 20260412_seed_business_templates.sql: 7      <- zawezenie
  boot 20262105_…_origin_runtime_repair.sql: 9      <- naprawa
PO FAZIE B (boot TP) — KONCOWY CHECK: 9
```

Kolejnosc plikow i przynaleznosc do runnerow zmierzone realnym kodem repo
(`isRuntimeMigrationFile`, `compareMigrationFilenames`, `isExecutableMigration`), nie z lektury.

---

## §5. Rekomendacja

**Odpowiedz na pytanie postawione w §5 zlecenia brzmi: OBIE rzeczy naraz, zaleznie od srodowiska.**

- Na **stagingu / produkcji / dev** naprawa Z6 (`20262105`) jest **bezczynna i niepotrzebna** —
  runner bootowy jest tam wylaczony, `20260412` nigdy nie zawezi CHECK, a sam plik naprawczy
  (celowo z `seed` w nazwie) jest niewidoczny dla stricta. Dlatego nie figuruje w zadnej ksiedze
  na stagingu — i to jest **oczekiwane**, a nie defekt paczki 15.
- Na **demo** naprawa Z6 jest **potrzebna i wykona sie sama** — ale dopiero przy pierwszym
  deployu, ktory przyniesie na demo build zawierajacy plik `20262105`. Dzis demo stoi na
  starszym buildzie i tego pliku nie ma.

Kolejnosc dzialan (rekomendacja, nie wykonanie):

1. **Nie zmieniac `DB_MANAGED_SCHEMA` na zadnym srodowisku bez osobnej decyzji.**
   Wlaczenie runnera bootowego na stagingu/prod (usuniecie `off`) uruchomiloby tam naraz
   11 plikow seed/demo na zywej bazie z danymi klientow demo — to nie jest zmiana „jednolinijkowa".
2. **Przed pilotazem: wdrozyc na demo build zawierajacy `20262105`.** Ryzyko zmierzone i niskie:
   plik jest idempotentny (`DROP CONSTRAINT IF EXISTS` + `ADD`), ma guard na brak tabeli,
   a na demo jest **0 wierszy** z `origin_runtime='work_canvas'`, wiec zawezenie o te wartosc
   nie moze wywrocic walidacji istniejacych wierszy. `work_canvas` nie jest zapisywany jako
   `origin_runtime` przez zaden kod runtime (`work-canvas.routes.ts:4557` jawnie go odrzuca).
3. **Jesli kiedykolwiek stawiamy demo od zera** — pamietac, ze bez `20262105` w buildzie
   swieza baza demo konczy na 7 wartosciach CHECK i wstaje jako „ready". Bramka wdrozenia
   tego nie zlapie, bo `evaluateSqlChain` liczy „pending" tym samym predykatem co strict,
   ktory tych 11 plikow nie widzi.
4. **Jesli kiedys uznamy, ze delta 11 plikow MA sie wykonywac takze na stagingu/prod** —
   wlasciwym miejscem nie jest zmienna srodowiskowa, tylko **bramka wdrozenia**: dolozyc
   w `release-migration-gate.ts` (po kroku 1, przed weryfikacja) drugi przebieg po
   `isRuntimeMigrationFile() && !isExecutableMigration()`, ksiegowany w `tp_migration_history`.
   Wtedy obie sciezki (bramka i boot) daja ten sam wynik i przestaje istniec klasa bledu
   „plik, ktory wykonuje sie tylko na jednym srodowisku". **Propozycja, nie wykonanie —
   to zmiana kodu produkcyjnego poza zakresem tej paczki diagnostycznej.**

### Ryzyko dla pilotazu 4 osob na demo — ocena

Niskie po stronie tej konkretnej sprawy. Demo ma **dzis** CHECK z 10 wartosciami
(z `document_template` i `assessment_report`), wiec zapisy Document Studio i Assessment
dzialaja. Realne ryzyko pojawiloby sie tylko przy odtwarzaniu bazy demo od zera na buildzie
bez `20262105`.

Ryzyko **poboczne, powazniejsze i osobne**: staging/production melduja
`/api/ready: ready` przy `sqlMigrations.state = "error"` i `migrations.state =
"disabled_by_operator"`. Bramka gotowosci, ktora miala nie dopuscic do serwowania ruchu na
niezweryfikowanym schemacie, jest na tych srodowiskach obchodzona jednym `return`
(`index.ts:373-387`). To zasluguje na osobna decyzje CTO — nie jest przedmiotem tej diagnozy.

---

## §6. Czego NIE zmierzylem i dlaczego

1. **Kiedy ustawiono `DB_MANAGED_SCHEMA=off` na stagingu/prod/dev.** Railway CLI nie
   udostepnia historii zmian zmiennych, a zmiana/odczyt przez API poza `variables` byl poza
   zakresem uprawnien tego zlecenia. Teza „zmienna byla wczesniej, znaczenie nadal jej commit
   2b5bcb2593" jest spojna z danymi, ale nie udowodniona.
2. **Czy `preDeployCommand` jest faktycznie ustawiony w ustawieniach serwisu Railway
   (a nie tylko w `railway.json` repo).** Dowod posredni: `schema_migrations` na stagingu
   przyrasta w dniach deployow (dzis 20:13 i 21:12 UTC), na demo 28.08. Nie wykluczam recznego
   uruchomienia runnera strict przez czlowieka. Nie sprawdzalem ustawien serwisu, bo wymagaloby
   to wejscia w panel/API poza odczytem zmiennych.
3. **Pelny przebieg lancucha na naprawde pustej bazie (907 + 11 plikow).** Eksperyment
   ograniczylem do 6 plikow dotykajacych spornego CHECK, bo pelny przebieg wymaga rozszerzen
   (`pgvector`) i kilkudziesieciu minut, a pytanie dotyczylo kolejnosci i koncowego CHECK.
   Nie wiem wiec, czy pelny lancuch na pustej bazie w ogole przechodzi bezbledne — w
   szczegolnosci czy 11 plikow delty wykonuje sie bez bledu w limicie
   `DB_READINESS_TIMEOUT_MS` (120 s domyslnie; przekroczenie = `process.exit(1)` w produkcji).
4. **Srodowisko `dev` i `production` sprawdzilem wylacznie po zmiennych** — nie odpytywalem
   ich baz ani endpointow zdrowia.
5. **Nie sprawdzalem pozostalych 10 plikow delty pod katem tego, co robia na swiezej bazie
   demo** (poza `20260412`/`20262105`). Trzy z nich to `*_seeds*`/`demo_mock_seed_cleanup` —
   moga miec wlasne skutki uboczne na swiezej bazie demo, ktorych nie zmierzylem.
