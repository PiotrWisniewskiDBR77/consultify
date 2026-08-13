# CLOSEOUT-08 — runtime bootstrap DDL reintroduced the broken `initiatives.status` default

**Data:** 2026-08-10
**Gałąź:** `codex/finance-v3-closeout-co8-runtimeddl` (worktree `closeout-co8-runtimeddl`)
**Ryzyko resztkowe zgłoszone przez:** CLOSEOUT-2
**Werdykt:** ZAMKNIĘTE — naprawione u źródła, dowiedzione na realnym PostgreSQL, kontrola negatywna odtwarza produkcyjny objaw.

---

## 1. Co było zepsute

`initDb()` w `server/src/database/PostgresDatabase.ts` (runtime bootstrap DDL, wołany
z `getPool()` na starcie aplikacji) tworzył kolumnę:

```sql
CREATE TABLE IF NOT EXISTS initiatives(
    ...
    status TEXT DEFAULT 'step3',
```

`'step3'` **nie należy** do 13 kanonicznych statusów (SSOT:
`server/src/constants/initiativeStatuses.ts`), a migracja
`20260624_initiative_status_normalize.sql` zakłada `initiatives_status_check`
dokładnie na tych 13 wartościach. Tabela wyprodukowana przez runtime DDL nosi
więc DEFAULT, który jej własny CHECK odrzuca: każdy `INSERT INTO initiatives`
bez jawnego `status` pada na

```
new row for relation "initiatives" violates check constraint "initiatives_status_check"
```

CLOSEOUT-2 naprawił to migracją `20260821_initiatives_status_default_draft.sql`,
ale ta leczy **wyłącznie bazę, która przechodzi migracje**. Runtime DDL jest
DRUGIM, niezależnym producentem tej tabeli — odtwarzał wadę z definicji źródłowej.

**Uwaga o lokalizacji:** plik jest w `server/src/**database**/PostgresDatabase.ts`,
nie `server/src/services/` (zlecenie podawało błędną ścieżkę). Numer linii 2526 się zgadzał.

---

## 2. Realny wpływ — KIEDY ta ścieżka się wykonuje

`initDb()` startuje z `getPool()` (`PostgresDatabase.ts:490`) przy **pierwszym
kontakcie z pulą połączeń**, czyli praktycznie na każdym starcie backendu.
Pomijana jest tylko gdy:

| warunek | efekt |
|---|---|
| `DB_MANAGED_SCHEMA` = `false` / `0` / `off` | init pominięty |
| `NODE_ENV=test` **oraz** `POSTGRES_SKIP_INIT_IN_TEST` = `true`/`1`/`yes`/`on` | init pominięty |
| w pozostałych przypadkach | **init wykonuje się** |

Ale całe DDL to `CREATE TABLE IF NOT EXISTS` — na bazie, gdzie `initiatives` już
istnieje, to no-op. **Wada materializuje się dokładnie wtedy, gdy `initiatives`
jeszcze nie istnieje w momencie startu aplikacji**, czyli:

1. **Thin bootstrap** — świeża baza, aplikacja startuje przed uruchomieniem
   migracji (albo migracje w ogóle nie są uruchamiane). `initDb()` tworzy tabelę
   z DEFAULT `'step3'`. Potem migracja `20260624` dokłada CHECK → baza jest
   trwale w stanie „DEFAULT łamie własny CHECK" aż do `20260821`.
2. **`server/scripts/run-initdb.js`** — wykonuje `000_initdb_core_tables.sql`
   BEZPOŚREDNIO przeciw `DATABASE_URL`, całkowicie poza runnerem migracji.
   Ta ścieżka NIGDY nie dociera do `20260821`.
3. **Odtworzenie środowiska od zera** (nowy Railway/dev/CI PG), gdzie kolejność
   „app start → migracje" nie jest wymuszona.

Na bazie, która przeszła pełen łańcuch migracji (np. demo), `20260821` już
naprawiła DEFAULT i moja zmiana jest tam **no-opem** — potwierdzone empirycznie
(sekcja 6, `co8_fin_after` = `'DRAFT'::text`).

Wpływ jest zatem: **P1 dla każdego świeżo stawianego środowiska, P3 dla środowisk
już zmigrowanych.** Nie jest to defekt „tylko testowy" — `initDb()` to ścieżka
produkcyjnego boota.

---

## 3. Pełna lista trafień `step3` w repo, z klasyfikacją

Grep po całym repo (bez `node_modules`), z pominięciem `step3Completed`
(kreator sesji — inna domena).

### 3a. WYMAGAŁO NAPRAWY (naprawione w tym pakiecie)

| Plik : linia | Treść | Dlaczego |
|---|---|---|
| `server/src/database/PostgresDatabase.ts:2526` | `status TEXT DEFAULT 'step3',` | **Źródło.** Runtime bootstrap DDL, ścieżka boota aplikacji. |
| `server/migrations/000_initdb_core_tables.sql:481` | `status TEXT DEFAULT 'step3',` | Mechaniczna KOPIA runtime DDL — `server/scripts/extract-initdb-migration.js` generuje ten plik regexując bloki `CREATE TABLE IF NOT EXISTS` z `PostgresDatabase.ts`. Wykonywany wprost przez `run-initdb.js`. |
| `server/migrations/000_z_core_baseline.sql:226` | `status TEXT DEFAULT 'step3',` (CREATE TABLE) | Ręcznie utrzymywany bliźniak tych samych tabel, baseline pod kontrolą migracji. |
| `server/migrations/000_z_core_baseline.sql:264` | `ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'step3';` | Self-healing ADD COLUMN w tym samym pliku — dokładał kolumnę z tym samym złym DEFAULT-em, gdy tabelę stworzył wcześniej `initDb()`. |

### 3b. WYMAGA NAPRAWY, ALE POZA ALLOWLISTĄ TEGO PAKIETU (do osobnego zgłoszenia)

| Plik : linia | Treść | Ocena |
|---|---|---|
| `server/seed/seed_demo_organization.js:1309-1310, 1339` | `IDEA: 'step3'`, `PLANNING: 'step3'`, `statusMap[init.status] \|\| 'step3'` | **Realny defekt.** Seed ZAPISUJE `'step3'` jawnie w `status` inicjatywy. Na bazie z `initiatives_status_check` ten seed pada. Naprawa = mapować na kanoniczne (`DRAFT`/`PLANNING`). |
| `server/seed/seed_technolex_demo_v3.js`, `seed_legolex_demo_v3.js`, `server/scripts/seedLegolexDemoOrg.js`, `server/scripts/seed-archilex-demo-org.js` | `status: 'step3_list'` (wielokrotnie) | **Do zweryfikowania.** Wartość `'step3_list'` przypisywana do `status` inicjatywy również nie jest kanoniczna → naruszy CHECK. Odrębna wartość niż `'step3'`, więc odrębna decyzja mapowania; nie ruszałem. |
| `server/scripts/migrate-to-postgres.js:137` | `status TEXT DEFAULT 'step3',` | Jednorazowy skrypt migracji SQLite→PG. Ten sam wzorzec, ale to narzędzie historyczne, nie ścieżka boota. |

### 3c. INNA DOMENA (bez związku — NIE ruszać)

| Plik | Powód |
|---|---|
| `config/helpContent.ts:108` (`/\/roadmap\|\/full-step3/`) | ścieżka routingu UI |
| `src/**` + `tests/components/dashboard/*`, `tests/views/FullRoadmapView.test.tsx` (`step3Completed`, `step3-workspace`) | kreator/roadmapa sesji — inne pojęcie „kroku 3" |
| `tests/unit/mywork/generateReadback.test.ts`, `tests/unit/backend/canvasToolSkeletons.test.ts`, `tests/unit/AIChat/agentPlanPanel.blocksToSteps.test.ts`, `tests/acceptance/j26-edit-step.e2e.test.ts` | lokalne nazwy węzłów grafu `step1/step2/step3` |
| `scripts/i18n-sweep/_bare_missing.json`, `_unmatched.json` (`security.mfa.step3`, `mfa.setup.step3`) | klucze i18n kreatora 2FA |

### 3d. MARTWE / POZA LINIĄ ŻYCIA (zgłoszone, nie ruszane)

| Plik : linia | Powód |
|---|---|
| `server/migrations-archive/000_initdb_core_tables.sql:481`, `000_z_core_baseline.sql:131` | katalog archiwalny, nie jest wykonywany |
| `server/migrations-v2/001_baseline_20260413.sql:15865` (`status text DEFAULT 'step3'::text`) | odrębna, równoległa linia migracji (`migrations-v2`) — poza allowlistą, ale **nosi ten sam defekt**; jeśli ta linia jest gdziekolwiek żywa, wymaga takiej samej poprawki |

### 3e. Poprawne odniesienia (dokumentacja defektu, zostawić)

`server/migrations/20260624_initiative_status_normalize.sql`,
`server/migrations/20260821_initiatives_status_default_draft.sql`,
`server/src/services/initiative/InitiativeDefinitionService.ts:168`,
`server/src/services/initiative/__tests__/initiativeCapabilityMatrix.pg.test.ts:241`,
`tests/integration/closeout-co2-initiatives-status-default.realdb.test.ts`,
`tests/e2e/uspojnienie/f1|f2|f3-*.spec.ts`, `tests/resultsVnext/kpi/legacyIsolation.realdb.test.ts`
— wszystkie nazywają `'step3'` śmieciem i asertują jego brak. Bez zmian.

---

## 4. Co naprawiłem

Cztery deklaracje `DEFAULT 'step3'` → `DEFAULT 'DRAFT'`, każda z komentarzem
wskazującym SSOT:

- `server/src/database/PostgresDatabase.ts:2526` (runtime DDL — źródło)
- `server/migrations/000_initdb_core_tables.sql:481`
- `server/migrations/000_z_core_baseline.sql:226` (CREATE TABLE)
- `server/migrations/000_z_core_baseline.sql:264` (ADD COLUMN)

`'DRAFT'` — bo to udokumentowany stan wejściowy cyklu życia inicjatywy
(`initiativeStatuses.ts`) i to samo, co wybrała migracja `20260821` oraz jedyny
produkcyjny zapis (`InitiativeDefinitionService.ts:168` →
`push('status', data.status || 'DRAFT')`).

**Edycja już zaaplikowanych plików migracji jest tu bezpieczna:**
`server/scripts/migrate.postgres.ts` liczy i ZAPISUJE checksum do
`schema_migrations`, ale nigdzie go nie **porównuje** — nie ma bramki
drift/mismatch. Sprawdzone gerpem po `checksum` w runnerze.

### Rozbieżność CHECK vs SSOT — ZGŁOSZENIE, nie naprawa

Zlecenie kazało sprawdzić, czy CHECK tworzony w tym samym miejscu jest spójny
z SSOT. Ustalenie: **runtime DDL nie tworzy ŻADNEGO CHECK-a na
`initiatives.status`.** W całym `initDb()` nie ma `initiatives_status_check`
(ani żadnej klauzuli `CHECK` w bloku `CREATE TABLE ... initiatives`). Constraint
pochodzi wyłącznie z migracji `20260624` (i idempotentnie z `20260802`).

Konsekwencja: baza postawiona CZYSTĄ ścieżką thin-bootstrap (`run-initdb.js`,
bez migracji) **nie ma w ogóle walidacji statusu** — przyjmie dowolny śmieć.
Domknięcie tej luki = dołożenie CHECK-a do runtime DDL, czyli zmiana szersza
niż jedna linia. **Poza allowlistą tego pakietu — raportuję.**

Sama lista 13 wartości w `20260624` jest zgodna z SSOT co do znaku
(DRAFT, PENDING_REVIEW, REVIEW, PROMOTED, PLANNING, APPROVED, SCHEDULED,
EXECUTING, BLOCKED, DONE, TRACKING, CANCELLED, ARCHIVED) — tu rozjazdu nie ma.

---

## 5. Test — forma i uzasadnienie

**Plik:** `server/src/database/__tests__/closeoutCo8RuntimeDdlInitiativesStatusDefault.pg.test.ts`

Test **behawioralny na realnym PostgreSQL** — nie statyczny. Statyczny był
dopuszczalny tylko gdyby `initDb()` nie dało się odpalić w izolacji; **dało się**,
więc słabsza forma nie była potrzebna.

Przebieg:

1. tworzy **własną, jednorazową bazę** (`co8_runtime_ddl_<tag>`) — świeżość jest
   nośna: bez niej `CREATE TABLE IF NOT EXISTS` byłby no-opem na tabeli
   zostawionej przez wcześniejszy przebieg i asercja o runtime DDL byłaby
   przypadkowa, nie prawdziwa;
2. uruchamia **prawdziwy eksportowany `initDb()`** (72 tabele, ~0,5 s);
3. aplikuje **prawdziwy plik migracji** `20260624_initiative_status_normalize.sql`
   (nie ręcznie przepisany constraint — żeby nie mógł się rozjechać);
4. `INSERT INTO initiatives (id, organization_id, name)` **bez `status`** →
   musi przejść CHECK i wylądować jako `DRAFT`;
5. dodatkowo: jawny `'step3'` musi zostać odrzucony (dowód, że CHECK realnie
   egzekwuje, a nie że go nie ma).

Zabezpieczenia przed fałszywą zielenią:
- **bramka `RUN_DB_TESTS=1` + `MOCK_DB=false`** (opisana w nagłówku pliku);
- **strażnik `testDatabaseOverride`** — `PostgresDatabase.ts` po cichu przełącza
  się na bazę `postgres`, gdy login nie może stworzyć bazy; test sprawdza, że
  `initiatives` powstało w bazie SCRATCH, inaczej pomija się głośno;
- **skip jest głośny** — bez PG suite przechodzi jałowo, ale wypisuje
  `[CLOSEOUT-08] SKIPPED — <powód>` (zweryfikowane realnym przebiegiem bez `DATABASE_URL`);
- **`DB_MANAGED_SCHEMA=false`** jest tu nośne: tłumi automatyczny init z
  `getPool()`, żeby `initDb()` poszło DOKŁADNIE RAZ. Bez tego dwa równoległe
  przebiegi `CREATE TABLE IF NOT EXISTS` ścigają się i Postgres rzuca
  `duplicate key value violates unique constraint "pg_type_typname_nsp_index"`
  (napotkane realnie przy pierwszym podejściu).

**Piąty test jest SŁABSZY i jest tak opisany w kodzie:** statyczny guard na
`000_initdb_core_tables.sql` i `000_z_core_baseline.sql` (asercja, że żadna
nie-komentarzowa linia nie deklaruje `status ... DEFAULT 'step3'`). Nie dowodzi
zachowania tych plików — dowodzi tylko, że literał zniknął. Wybrany świadomie:
dowód behawioralny pokrywa runtime DDL, czyli ŹRÓDŁO, którego oba pliki SQL są
kopiami; guard tylko blokuje ich cichy powrót. Nie wymaga bazy, więc chroni też
przebiegi CI bez PG.

---

## 6. Kontrola negatywna — DWIE, obie zaczerwieniły

**KN-1 (behawioralna).** Cofnięcie `PostgresDatabase.ts` do `DEFAULT 'step3'`:

```
× initDb() gives status a default drawn from the canonical status list
    AssertionError: expected 'step3' not to be 'step3'
× a status-less INSERT survives initiatives_status_check and lands as DRAFT
    error: new row for relation "initiatives" violates check constraint "initiatives_status_check"
 Tests  2 failed | 2 passed (4)
```

To **dokładnie produkcyjny objaw** z opisu CLOSEOUT-2, odtworzony przez test.
Naprawa przywrócona → 4/4 zielone.

**KN-2 (statyczna).** Cofnięcie `000_initdb_core_tables.sql` do `DEFAULT 'step3'`:

```
× no bootstrap SQL twin re-declares the broken default (static guard)
    AssertionError: 000_initdb_core_tables.sql still declares DEFAULT 'step3'
 Tests  1 failed | 4 passed (5)
```

Naprawa przywrócona → 5/5 zielone.

---

## 7. Regresja

Środowisko: efemeryczny PostgreSQL **15.15** (`postgresql@15`, `LC_ALL=C` przy
`initdb` i `pg_ctl start`), port **55100** (sprawdzony `lsof`), baza `co8_fin_after`
zmigrowana pełnym `migrate.postgres.ts --safe` (przeszła do końca:
`✅ Postgres migrations complete`). Bramka `RUN_DB_TESTS=1 MOCK_DB=false`.

| Suite | Wynik |
|---|---|
| `server/src/services/finance/` (baseline pakietu: 476) | **476/476 passed, 29/29 plików** |
| `server/src/database/` (nowy test CO8) | **5/5 passed** |
| `tests/integration/closeout-co2-initiatives-status-default.realdb.test.ts` + `tests/resultsVnext/kpi/legacyIsolation.realdb.test.ts` | **6/6 passed, 2/2 plików** |
| nowy test CO8 bez `DATABASE_URL` (ścieżka skip) | **5/5 passed**, głośny komunikat skip |

Kontrola stanu bazy po pełnej migracji:
`information_schema.columns.column_default` dla `initiatives.status` =
`'DRAFT'::text` — potwierdza, że dla baz przechodzących migracje zmiana jest
no-opem i nie wprowadza rozjazdu z `20260821`.

Uwaga metodyczna: pierwszy przebieg finansów na **niezmigrowanej** bazie dał
44 czerwone / 476 — to artefakt środowiska (brak schematu + wyścig `initDb()`
między równoległymi plikami testowymi), nie regresja. Po zmigrowaniu bazy i
`--no-file-parallelism` suite jest w 100% zielony. Liczba 476 zgadza się z
baseline'em w obu przebiegach.

Sprzątanie: `pg_ctl stop` + `rm -rf` katalogu danych; bazy scratch tworzone przez
test są kasowane w `afterAll` (`DROP DATABASE`).

---

## 8. Pozostałe ryzyko (do decyzji, poza tym pakietem)

1. **Runtime DDL nie zakłada `initiatives_status_check`** — czysty thin-bootstrap
   daje bazę bez jakiejkolwiek walidacji statusu (sekcja 4).
2. **`seed_demo_organization.js` zapisuje `'step3'` jawnie** — padnie na bazie
   z CHECK-iem (sekcja 3b).
3. **`'step3_list'` w czterech seedach demo** — również niekanoniczne, również
   naruszy CHECK (sekcja 3b).
4. **`server/migrations-v2/001_baseline_20260413.sql`** nosi ten sam DEFAULT;
   jeśli ta linia migracji jest gdziekolwiek żywa, wymaga tej samej poprawki.
5. **Runner migracji nie waliduje checksumów** — zapisuje je, ale nigdy nie
   porównuje. Wygodne tutaj, ale to znaczy, że edycja zaaplikowanej migracji nie
   jest nigdzie wykrywana.
