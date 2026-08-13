# W10 — izolacja pakietu testowego Finance v3

**Zakres:** `server/src/services/finance/**` (36 plików testowych).
**Gałąź:** `codex/finance-v3-w10-testisolation`, baza `1271a0f721`.
**Zamrożone:** `codex/finance-v3-closeout-fanin` @ `19b4b06934` — nietknięte, nic nie scalane, nic nie pchane.
**Środowisko pomiaru:** efemeryczny PostgreSQL **15.15** (Homebrew), `initdb --locale=C` + `LC_ALL=C`,
port **57411** (sprawdzony `lsof`), gniazdo `/tmp/w10pg`, bazy `w10_iso` (mapa skażenia) i `w10_det`
(dowód determinizmu). Bramka za każdym razem jawna: `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres
DATABASE_URL=postgresql://postgres@127.0.0.1:57411/<db>`. Migracje **strict** (bez `--safe`),
`✅ Postgres migrations complete`, katalog KPI po migracji = **18 wierszy, wszystkie
`UNIVERSAL/ACTIVE/organization_id IS NULL`**. Instancje współdzielone Homebrew nietknięte,
klaster na koniec `pg_ctl -m fast stop` + `rm -rf`.

---

## 1. Co zostało zmierzone (a nie założone)

Diagnoza z `FC_GATES_STATUS_MATRIX.md` (M17) mówiła: „pliki testowe dzielą jedną bazę i
zanieczyszczają sobie `finance_analysis_kpi_catalog`". Zanim cokolwiek naprawiłem, zmierzyłem
**wszystkie** tabele, nie tylko tę jedną.

Metoda: świeża baza po migracjach → snapshot `count(*)` **każdej** z 1451 tabel `public.*`
(`query_to_xml`) → uruchomienie **pojedynczego** pliku testowego w osobnym procesie vitest →
ponowny snapshot → różnica. I tak 36 razy po kolei, na jednej bazie.

### 1.1. Pliki, które zostawiają wiersze w tabelach współdzielonych

Wszystkie 36 plików przechodzi uruchomione pojedynczo (638/638). **20 plików to testy czysto
jednostkowe — zero zapisów.** Pozostałe 16 zostawia po sobie wiersze:

| Plik testowy | Tabele, w których zostają wiersze po zakończeniu pliku |
|---|---|
| `artifactVersionSupersededImmutability.pg.test.ts` | `organizations`, `finance_artifacts`, `finance_business_versions`, `finance_working_revisions`, `finance_compute_snapshots`, `artifact_lifecycle_events` |
| `artifactVersionTerminalTransitions.pg.test.ts` | jw. |
| `canonicalServices.pg.test.ts` | jw. + `finance_exceptions`, `finance_lineage_edges`, `finance_valuation_advisor_outputs` |
| `commentReviewService.pg.test.ts` | jw. (bez valuation) + `finance_stmt_calendars`, `finance_stmt_periods`, `finance_stmt_entities`, `finance_stmt_lines` |
| `exceptionInboxService.pg.test.ts` | `organizations`, `finance_artifacts`, `finance_business_versions`, `finance_working_revisions`, `artifact_lifecycle_events`, `finance_exceptions` |
| `financeCompareService.pg.test.ts` | jw. + `finance_baseline_outputs`, `finance_prediction_outputs`, `finance_prediction_scenarios`, `finance_lineage_edges`, `finance_stmt_*` |
| `kpiComputeService.pg.test.ts` | jw. + `compute_jobs`, `compute_job_runs`, `compute_job_outputs`, `finance_analysis_definitions`, `finance_analysis_kpi_values` |
| `lineageFreshnessService.pg.test.ts` | `organizations` (×5), `finance_artifacts`, `finance_business_versions`, `finance_working_revisions`, `finance_compute_snapshots`, `finance_lineage_edges`, `artifact_lifecycle_events` |
| `roiActualProtectionSchemaQualified.pg.test.ts` | `organizations`, `initiatives`, `v8_kpi_definitions`, `v8_roi_realization_entries`, `roi_realized_values` |
| `roiFinanceLinkAdapter.pg.test.ts` | jw. + `rvn_roi_cases`, `rvn_roi_baselines`, `rvn_roi_calculation_policy`, `rvn_platform_events`, `rvn_platform_outbox`, `rvn_platform_obligations`, `rvn_platform_resource_acl`, `rvn_platform_resource_visibility`, `rvn_platform_visibility_policies`, `finance_*` |
| `roiFinanceReconciliationAdapter.pg.test.ts` | jw. + `digitization_analyses` |
| `savedViewService.pg.test.ts` | `organizations` (×2), `finance_artifacts`, `finance_business_versions`, `finance_working_revisions`, `artifact_lifecycle_events` — **`finance_analysis_kpi_catalog` sprząta poprawnie (delta 0)** |
| `statementCoverageAndJumps.pg.test.ts` | `finance_stmt_*` (w tym `finance_stmt_reconciliation` +581), `finance_exceptions`, `finance_reconciliation_runs`, `organizations`, `finance_artifacts/business_versions/working_revisions`, `artifact_lifecycle_events` |
| `statementServices.pg.test.ts` | jw. |
| `valuationAdvisorService.pg.test.ts` | `finance_valuation_*` (11 tabel, m.in. `finance_valuation_sensitivity_cells` +125), `organizations`, `finance_artifacts/business_versions/working_revisions/compute_snapshots`, `artifact_lifecycle_events` |
| `collaboration.pg.test.ts` | `organizations`, `finance_artifacts`, `finance_business_versions`, `finance_working_revisions`, `artifact_lifecycle_events` |

### 1.2. Które z tych wierszy naprawdę szkodzą — i dlaczego reszta nie

Resztki **nie są** same w sobie defektem. Każdy z tych plików tworzy **własną organizację o losowym
UUID** (`org-…-${randomUUID()}`) i wszystko wiesza pod nią; schemat jest append-only (wyzwalacze
deny-delete), więc `afterAll` fizycznie **nie może** tych wierszy usunąć — i to jest gwarancja
schematu działająca zgodnie z projektem, nie błąd testu. Każdy odczyt w tych plikach jest zawężony
do własnego `organization_id` / `business_version_id`, więc obcy wiersz jest niewidoczny.

Szkodzi dokładnie jeden wzorzec: **odczyt globalny (niezawężony) tabeli słownikowej, na którym
opiera się dokładna asercja.** Systematyczny przegląd wszystkich zapytań SQL w 36 plikach
(`grep` po `SELECT … FROM` z odsianiem zapytań zawężonych) dał **dwa** takie miejsca:

| # | Miejsce | Tabela współdzielona | Status |
|---|---|---|---|
| 1 | `kpiComputeService.pg.test.ts:165` — `SELECT id, kpi_code FROM finance_analysis_kpi_catalog WHERE status = 'ACTIVE'` + `expect(size).toBe(18)` | `finance_analysis_kpi_catalog` (18 wierszy seed) | **AKTYWNY DEFEKT** — to jest `expected 19 to be 18` |
| 2 | `financeCompareService.pg.test.ts:73` — `SELECT id FROM financial_statement_lines WHERE line_code = ?` | `financial_statement_lines` (32 wiersze taksonomii) | **LATENTNY** — dziś żaden test nie pisze do tej tabeli, ale zapytanie nie odróżnia wiersza kanonicznego (`organization_id IS NULL`) od nadpisania org-scoped |

Pozostałe tabele słownikowe (`finance_reason_codes`, `finance_prediction_driver_line_map`,
`finance_engine_manifests`, `financial_statement_lines`) — **zero `INSERT`/`UPDATE`/`DELETE` z testów**.
Sekwencje: żaden test nie asercjonuje wartości pochodzącej z sekwencji. Organizacje: każdy plik ma
własne losowe id, żaden nie liczy `organizations` globalnie. Klucze naturalne (`naturalKey:
'goldco-analysis-2026q2'` itd.) są stałe, ale unikalne **w obrębie organizacji**, a organizacja jest
losowa przy każdym uruchomieniu — stąd powtarzalność przy wielokrotnym uruchomieniu na tej samej bazie.

### 1.3. Kto dokłada 19-ty wiersz

**`savedViewService.pg.test.ts`** — i robi to **poprawnie**. Jego czwarty `describe` („column schema
migration") potrzebuje własnego wskaźnika, więc tworzy wiersz `ORG_CUSTOM` pod losowym
`kpi_code = GOLDCO_CUSTOM_RATIO_<8 hex>`, przypisany do własnej organizacji, i kasuje go w `afterAll`
(`DELETE FROM finance_analysis_kpi_catalog WHERE organization_id = ?`). Pomiar to potwierdza: delta
tej tabeli po pliku = **0**.

Czyli: **to nie jest wyciek po sprzątaniu, tylko okno nakładania się.** Wiersz *ma* istnieć przez
czas trwania swojego właściciela. Przy `--no-file-parallelism` kolejność alfabetyczna stawia
`kpiComputeService` (16.) **przed** `savedViewService` (24.), więc okna się nie nakładają i pakiet
jest zielony. Przy domyślnej równoległości pliki chodzą jednocześnie i `beforeAll` pliku KPI może
trafić w okno, w którym wiersz `ORG_CUSTOM` jest `ACTIVE` → `expected 19 to be 18`.

**Żaden `afterAll` tego nie zamknie.** Droga (a) jest tu już zastosowana i jest wypełniona
prawidłowo — to nie ona zawodzi.

### 1.4. Uczciwa uwaga o odtwarzalności

Nie udało mi się złapać czerwieni „naturalnie" na tej maszynie na tym SHA: przed naprawą
`vitest run src/services/finance` (domyślnie równolegle) przeszedł **5×** 638/638, a
`src/services/finance src/routes/v8/finance-v2` **3×** 641/641. Wyścig zależy od tego, czy
`beforeAll` pliku KPI (wolny start: import 4 modułów + 4 zapisy fixture) wypadnie po wewnętrznym
`beforeAll` czwartego `describe` w `savedViewService`. Na tej maszynie zwykle wypada wcześniej.

Dlatego zamiast polować na flaka **odtworzyłem mechanizm deterministycznie**: wstrzyknąłem ręcznie
jeden wiersz `ACTIVE/ORG_CUSTOM` (`W10_PROBE_RATIO`) do katalogu i uruchomiłem sam plik KPI:

```
PRZED naprawą:  AssertionError: expected 19 to be 18 → Test Files 1 failed, Tests 6 skipped
PO naprawie:    Test Files 1 passed, Tests 6 passed
```

Ten sam wiersz-sonda przepuszczony przez **cały** pakiet (`finance` + `routes/v8/finance-v2`,
serialnie) przed naprawą zaczerwienił **dokładnie jeden plik** — `kpiComputeService.pg.test.ts`
(`Tests 635 passed | 6 skipped (641)`). To jest twardy dowód, że wrażliwy na globalny stan katalogu
jest wyłącznie ten jeden odczyt, a nie „cały pakiet".

---

## 2. Naprawa — którą drogą i dlaczego

Wybrana **droga (b) zastosowana po stronie CZYTAJĄCEGO**: dane globalne czyta się w zakresie, o
którym asercja faktycznie mówi.

- **(a) symetryczne sprzątanie** — już jest i działa (delta katalogu = 0). Nie jest przyczyną.
- **(c) osobna baza/schemat per plik** — **odrzucona**. Zmiana infrastruktury o szerokim zasięgu
  (`vitest.config.ts` jest poza allowlistą), ~2 min migracji × 36 plików, a leczyłaby objaw:
  asercja „18 aktywnych wierszy w całej bazie" byłaby nadal nieprawdziwa jako opis intencji.
- **(b) po stronie czytającego** — jedyne, co domyka okno nakładania, bo nie wymaga, żeby cudzy
  poprawny wiersz przestał istnieć.

### 2.1. `kpiComputeService.pg.test.ts`

```diff
-      tx.queryAll(`SELECT id, kpi_code FROM finance_analysis_kpi_catalog WHERE status = 'ACTIVE'`)
+      tx.queryAll(`SELECT id, kpi_code FROM finance_analysis_kpi_catalog
+                    WHERE status = 'ACTIVE' AND tier = 'UNIVERSAL' AND organization_id IS NULL`)
     catalogIdByCode = new Map(catalogRows.map((r) => [r.kpi_code, r.id]));
-    expect(catalogIdByCode.size).toBe(18);
+    expect(catalogRows).toHaveLength(18);   // 18 wierszy seed WP-D03b jest…
+    expect(catalogIdByCode.size).toBe(18);  // …i wszystkie kpi_code są różne
```

**To nie jest osłabienie asercji — to jej wzmocnienie.** Liczba pozostaje twardym `toBe(18)`, a
sprawdzenie robi się **ostrzejsze**: w wersji niezawężonej układ „17 wierszy seed + 1 obcy
`ORG_CUSTOM`" też dawał 18 i **zamaskowałby brakujący wiersz seed**. Po zawężeniu nie ma takiej
możliwości. Dodatkowa asercja `toHaveLength` rozdziela dwa różne błędy, które wcześniej wyglądały
identycznie: „brak wiersza seed" i „zduplikowany `kpi_code`".

Stan bazy po migracjach potwierdza, że zawężenie trafia dokładnie w zbiór seed:
`SELECT tier, status, organization_id IS NULL, count(*) … GROUP BY 1,2,3` → **jeden wiersz wyniku:
`UNIVERSAL | ACTIVE | t | 18`**.

### 2.2. `financeCompareService.pg.test.ts`

```diff
-      tx.queryOne(`SELECT id FROM financial_statement_lines WHERE line_code = ?`, [code])
+      tx.queryOne(`SELECT id FROM financial_statement_lines WHERE line_code = ? AND organization_id IS NULL LIMIT 1`, [code])
```

Ta sama klasa defektu na taksonomii linii, złapana zanim wybuchła. Wzorzec skopiowany z
`kpiComputeService.pg.test.ts`, który dla swojego `writeLine` **już** czytał tę tabelę poprawnie.

**Czego NIE zrobiono:** żadna asercja nie została zamieniona na `toBeGreaterThanOrEqual`, żaden
`expect` nie został usunięty, nie tknięto kodu produkcyjnego, migracji ani `vitest.config.ts`.

---

## 3. Dowód determinizmu

Świeża baza `w10_det` (migracje strict od zera), **wszystkie pięć pomiarów po kolei na tej samej
bazie**, każdy w osobnym procesie vitest:

| # | Pomiar | Wynik |
|---|---|---|
| 1 | Cały `src/services/finance`, domyślna równoległość — przebieg 1 | **36 plików / 638 testów / 0 failed** |
| 2 | jw. — przebieg 2 | **36 / 638 / 0** |
| 3 | jw. — przebieg 3 | **36 / 638 / 0** |
| 4 | Jawna lista 36 plików w **odwróconej** kolejności, `--no-file-parallelism` | **36 / 638 / 0** |
| 5 | **Plik po pliku**, 36 osobnych procesów vitest, suma | **36 / 638 / 0** |

Kontrolnie kolejność **normalna** serialnie: 36 / 638 / 0.

**638 = 638 = 638 = 638 = 638.** Wynik nie zależy ani od flagi równoległości, ani od kolejności
plików, ani od tego, ile razy pakiet już chodził po tej bazie.

### 3.1. Kontrola negatywna bramki

Bez `RUN_DB_TESTS=1` / `MOCK_DB=false` / `DATABASE_URL` oba zmienione pliki muszą **pominąć**, a nie
przejść na sucho:

```
NODE_ENV=test npx vitest run kpiComputeService.pg.test.ts financeCompareService.pg.test.ts
→ Test Files 2 skipped (2) ; Tests 8 skipped (8)
```

Zielony bez bazy nie jest możliwy — bramka trzyma.

### 3.2. Kontrola adwersaryjna naprawy

Naprawa musi **wytrzymać** dokładnie ten stan, który wcześniej ją zabijał — a nie tylko
„nie wywalać się, bo nikt nie przeszkadza". Z wstrzykniętym wierszem `ACTIVE/ORG_CUSTOM` w katalogu:
przed naprawą 1 failed / 6 skipped, po naprawie **6 passed**. Sonda usunięta po pomiarze.

---

## 4. Prawdziwe czerwone po naprawie

**Zero.** Żaden test nie okazał się czerwony „naprawdę" — 638/638 w każdym z pięciu trybów.
Skażenie maskowało dokładnie jeden defekt (ten sam, który je ujawniał), nie chowało innych.

---

## 5. Wpływ na wcześniejsze pomiary programu

Liczby **638/638** (`src/services/finance`) i **641/641** (`+ routes/v8/finance-v2`) z raportów
`APWAVE_FINAL_VERIFICATION` i `FC_GATES_STATUS_MATRIX` (M16) były **prawdziwe** — mierzono je
serialnie, a przy kolejności alfabetycznej okno nakładania nie występuje. Nieprawdziwe było
natomiast założenie, że **tryb uruchomienia nie ma znaczenia**: M17 słusznie to złapał. Po tej
naprawie obie liczby są niezależne od trybu i od kolejności, więc **przestają wymagać przypisu
„tylko serialnie"**.

Uwaga metodyczna, którą warto przenieść dalej: w tym repo `count(*)` bez `WHERE organization_id`
/ `tier` w teście integracyjnym na współdzielonej bazie jest **zawsze** kandydatem na wynik zależny
od kolejności — nawet jeśli każdy plik sprząta po sobie idealnie.

---

## 6. Reprodukcja

```bash
PGBIN=/opt/homebrew/opt/postgresql@15/bin
PGDATA=<scratchpad>/pgdata ; PGSOCK=/tmp/w10pg ; PORT=57411   # lsof-sprawdzony
rm -rf "$PGDATA" "$PGSOCK" && mkdir -p "$PGDATA" "$PGSOCK"
LC_ALL=C $PGBIN/initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
LC_ALL=C $PGBIN/pg_ctl -D "$PGDATA" -o "-p $PORT -k $PGSOCK -c listen_addresses=127.0.0.1" \
  -l /tmp/w10_pg.log start
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE w10_det;"

DBURL="postgresql://postgres@127.0.0.1:$PORT/w10_det"
NODE_ENV=test DB_TYPE=postgres DATABASE_URL="$DBURL" npx tsx server/scripts/migrate.postgres.ts

cd server
export DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL"
for i in 1 2 3; do npx vitest run src/services/finance; done          # 3× 638/638
FILES=$(find src/services/finance -name '*.test.ts' | sort)
npx vitest run $FILES --no-file-parallelism                           # 638/638
npx vitest run $(echo "$FILES" | sort -r) --no-file-parallelism       # 638/638
for f in $FILES; do npx vitest run "$f"; done                         # suma 638

$PGBIN/pg_ctl -D "$PGDATA" -m fast stop && rm -rf "$PGDATA" "$PGSOCK"
```

Sprzątanie wykonane. Drzewo robocze poza tym raportem i dwoma plikami testowymi — czyste.
