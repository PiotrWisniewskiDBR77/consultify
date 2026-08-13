# RN-G6-SRV — raport z domknięcia luk serwerowych

HEAD wejściowy: `c5852ace32`. HEAD po pracy: `995b2bfdd9`.

Trzy commity, w kolejności:
1. `0dbdeba273` — zadanie 1 (D08/B2: powód `not_calculable`).
2. `782ddd02da` — zadanie 2 (B3: trzy brakujące trasy GET).
3. `995b2bfdd9` — zadanie 3 (trasa dyspozycji szkicu Teresy dla OKR).

```
$ git status --short
(czysto — brak niezacommitowanych zmian)
```

Nie ruszyłem NIC poza allowlistą. `git log --stat` po każdym commicie
potwierdza dokładnie te pliki, które allowlist wymieniał (plus nowa
migracja i nowe pliki testowe w `tests/resultsVnext/**`).

---

## Zadanie 1 — D08/B2: persystencja powodu `not_calculable`

**Migracja**: `server/migrations/20260831_rvn_okr_not_calculable_reason.sql`
— czysto addytywna, trzy kolumny `TEXT NULL`, zero backfillu, zero zmiany
istniejących wierszy:
- `okr_vnext_sets.overall_progress_reason`
- `okr_vnext_sets.overall_confidence_reason`
- `okr_vnext_checkins.calculated_progress_reason`

Zweryfikowane na żywej bazie (`consultify_test`, port 55921):
```sql
SELECT table_name, column_name, is_nullable, data_type
  FROM information_schema.columns
 WHERE (table_name='okr_vnext_sets' AND column_name IN ('overall_progress_reason','overall_confidence_reason'))
    OR (table_name='okr_vnext_checkins' AND column_name='calculated_progress_reason');
```
→ wszystkie trzy kolumny obecne, `text`, `is_nullable=YES`.

### Zmienione pliki (plik:linia)

- `server/src/services/resultsVnext/okr/okrSetRollupCalculator.ts` —
  `ComputeSetRollupResult` dostał dwa nowe pola `overallProgressReason`
  (L~101) / `overallConfidenceReason` (L~103), wypełniane z JUŻ
  istniejących lokalnych zmiennych `progressReason`/`confidenceReason`
  (funkcja liczyła je od zawsze, tylko sklejała w jeden string i
  wyrzucała rozbicie). Pole `reason` (kombinowane) zostaje bez zmian dla
  wstecznej zgodności.
- `server/src/services/resultsVnext/okr/okrCheckInCommands.ts`:
  - `applySetRollupUpdate` (L~305-333): `UPDATE okr_vnext_sets` dostał
    dwie nowe kolumny w liście `SET` (`overall_progress_reason = $6,
    overall_confidence_reason = $7`), wartości z `rollup.overallProgressReason`
    / `rollup.overallConfidenceReason`.
  - `recordCheckIn` (L~513-545) i `correctCheckIn` (L~773-805): oba
    `INSERT INTO okr_vnext_checkins` dostały kolumnę
    `calculated_progress_reason`, wartość `progressCalc.reason` — TA SAMA
    wartość, która od zawsze była zapisywana na `okr_vnext_key_results
    .progress_calc_reason` w tej samej transakcji, tylko nigdy nie trafiała
    na wiersz check-inu.
- `server/src/services/resultsVnext/okr/okrSetTypes.ts` — `OkrSetRow`/
  `OkrSet`/`toOkrSet` dostały `overall_progress_reason`/
  `overall_confidence_reason` (snake) i `overallProgressReason`/
  `overallConfidenceReason` (camel).
- `server/src/services/resultsVnext/okr/okrCheckInTypes.ts` — analogicznie
  `calculated_progress_reason`/`calculatedProgressReason`.

### Dowód z realnej bazy, że powód dociera na drut

Test: `tests/resultsVnext/okr/okrSetCheckInReasonAndTeresaDispositionRoute.realdb.test.ts`.

1. **Świeży Set bez celów** (Program z jawnym `objectiveRollupModel:
   'equal_average'`, Set w statusie `draft`, zero Objectives) — wywołanie
   `applySetRollupUpdate` wprost (ten sam kod co check-in/scheduler) i
   odczyt SQL-em: `overall_progress_reason`/`overall_confidence_reason`
   oba zaczynają się od `not_calculable:` (regex `/^not_calculable:/`).
   `cancelObjective` jest zablokowany poza statusem `draft`/
   `changes_requested`, więc "zero nie-anulowanych Objectives na
   aktywnym Set" nie jest osiągalne przez normalny cykl życia — stąd
   bezpośrednie wywołanie `applySetRollupUpdate` na świeżym, wciąż
   `draft` Secie, zamiast przez pełny submit→approve→activate.
2. **Po dodaniu realnego Objective+KR** do TEGO SAMEGO Setu i ponownym
   `applySetRollupUpdate`: `overall_progress` przestaje być `null`,
   `overall_progress_reason` przestaje mieć prefiks `not_calculable:` i
   zaczyna się od `set_rollup(...)`.
3. **Realny `recordCheckIn`** na aktywnym Secie (fixture E007, 2
   Objectives × 2 KR): `checkIn.calculatedProgressReason` — string
   zaczynający się od `reach:` (geometria KR) — zwrócony przez komendę
   ORAZ potwierdzony osobnym SELECT-em na `okr_vnext_checkins` (bajtowo
   identyczny). `set.overallProgressReason`/`overallConfidenceReason` —
   realne, nie-`not_calculable` wartości, potwierdzone SELECT-em na
   `okr_vnext_sets`.
4. **`GET /sets/:setId` zwraca nowe pole** — wywołanie DOKŁADNIE tej
   funkcji, którą importuje `okr.routes.ts` (`getOkrSet` z
   `okrSetRepository.ts`), z `userId` właściciela — `overallProgressReason`/
   `overallConfidenceReason` na zwróconym DTO równe temu, co zapisano.

Wynik testu (real DB, port 55921): **8/8 passed**.

---

## Zadanie 2 — B3: brakujące trasy odczytu

Trzy nowe trasy, wszystkie GET, wszystkie cienkie opakowania nad JUŻ
istniejącymi, w pełni visibility-scoped funkcjami repozytorium (żadna
funkcja repozytorium nie została zmieniona — poza allowlistą).

### 1. `GET /api/vnext/results/kpi/deviation-cases/:caseId/corrective-actions`
`server/src/routes/resultsVnext/kpiDeviation.routes.ts` — woła
`listCorrectiveActions` (`kpiDeviationRepository.ts:173`, niezmieniona).
Bramka: brak jawnej `assertCommandCapability` (trasa GET — sąsiednie
trasy GET w tym pliku, np. `listDeviationCases`, też jej nie mają;
odczyt bramkowany wyłącznie widocznością). Widoczność: dziedziczona po
`kpi_id` sprawy przez `buildVisibilityScopedCte(resourceType:'kpi')` —
ta sama ścieżka co `getDeviationCase`. Odmowa generyczna: brak wiersza
lub brak widoczności → pusta lista `[]`, nigdy 404-vs-pusta-200 leak.

### 2. `GET /api/vnext/results/kpi/deviation-cases/:caseId/effectiveness-verifications`
Analogicznie, woła `listEffectivenessVerifications`
(`kpiDeviationRepository.ts:223`, niezmieniona).

Query-param schematy (`ListCorrectiveActionsQuerySchema`/
`ListEffectivenessVerificationsQuerySchema`) zadeklarowane LOKALNIE w
`kpiDeviation.routes.ts` (import `zod` dodany do pliku) — plik walidatorów
`resultsVnextKpiDeviation.validators.ts` leży POZA allowlistą tego
przebiegu.

### 3. `GET /api/vnext/results/kpi/scorecards/for-kpi/:kpiId`
`server/src/routes/resultsVnext/kpiScorecard.routes.ts` — nowy,
route-lokalny helper `listVisibleScorecardsForKpi` (ten sam wzorzec co
już istniejący `loadVisibleScorecard` w tym pliku — wąska funkcja
zamiast rozszerzania eksportowanego kontraktu repozytorium). Dwuetapowa
widoczność (AC #4 z nagłówka `kpiScorecardRepository.ts`):
1. Czy WOŁAJĄCY widzi sam KPI (`resourceType:'kpi'`) — jeśli nie, `[]`
   bez dalszego zapytania.
2. Tylko wtedy: karty wyników zawierające ten `kpiId`, zawężone do kart,
   które wołający widzi NIEZALEŻNIE (`resourceType:'kpi_scorecard'`) —
   widoczność karty NIGDY nie jest domniemana z widoczności widocznego
   na niej KPI.

Dowód realną bazą (`kpiScorecardForKpiReverseLookupRoute.realdb.test.ts`,
3/3 passed): właściciel widzi kartę (oba PRIVATE, ten sam właściciel);
outsider z niewidocznym KPI dostaje `[]` mimo że karta jest OPEN_ORG;
outsider który WIDZI KPI (OPEN_ORG) ale NIE widzi karty (PRIVATE innego
właściciela) nadal dostaje `[]` — AC #4 zweryfikowane wprost (osobny
SELECT potwierdza, że KPI faktycznie jest widoczne dla tego usera, a
mimo to karta nie wycieka).

### 4. `GET /api/vnext/results/roi/cases/:caseId/scenarios/:scenarioId/overrides`
`server/src/routes/resultsVnext/roi.routes.ts` — woła `listScenarioOverrides`
(`roiEconomicModelRepository.ts:443`, niezmieniona), dodana do istniejącego
importu z tego pliku. **Najważniejsza z trzech** (wg briefu): nadpisanie
dało się zapisać (`POST .../overrides`) i skasować
(`DELETE .../overrides/:overrideId`), ale nigdy odczytać. Widoczność:
dziedziczona po `case_id` scenariusza-rodzica przez
`wrapWithVisibilityScope(resourceType: ROI_RESOURCE_TYPE)`.

Dowód realną bazą (`roiScenarioOverridesReadRoute.realdb.test.ts`,
1/1 passed): override ustawiony przez `setScenarioOverride` odczytany z
powrotem z DOKŁADNIE tymi wartościami (`targetType`, `targetId`,
`overrideValue=150`, `note`); ACL-grantee widzi, ACL-outsider dostaje `[]`.

---

## Zadanie 3 — trasa dyspozycji szkicu Teresy dla refleksji OKR

`POST /api/vnext/results/okr/objectives/:objectiveId/reflection/teresa-draft-disposition`
w `server/src/routes/resultsVnext/okr.routes.ts`, bezpośrednio po istniejącej
`POST .../objectives/:objectiveId/reflection`.

Analogia do ROI (`roi.routes.ts`, `recordRoiPirTeresaDraftDisposition`):
ta sama struktura handlera (auth → istnienie/widoczność obiektu → resolveAccess
→ wywołanie komendy → mapowanie błędów), ta sama rodzina błędów
(`CommandCapabilityDeniedError`→403, `AtomicWriteConflictError`→409,
`OkrReflectionValidationError`→409, `AtomicWriteAggregateNotFoundError`/
`OkrReflectionNotFoundError`→404 — wszystkie JUŻ mapowane w istniejącym
`handleOkrRouteError`, zero nowych gałęzi błędów potrzebnych).

Komenda `recordOkrReflectionTeresaDraftDisposition` (`okrReflectionCommands.ts`)
JUŻ istniała i miała pełne pokrycie na poziomie serwisu
(`okrReflectionTeresaDraft.realdb.test.ts`, plik NIE ruszony w tym
przebiegu). Nowy kod trasy to wyłącznie: (a) pre-check `getObjective`
(D06, generyczne 404 — ten sam wzorzec co sąsiednia trasa reflection), (b)
przekazanie body do komendy. Body schema (`RecordOkrReflectionTeresaDraftDispositionSchema`)
zadeklarowana lokalnie w `okr.routes.ts` (walidator z tego samego powodu
co w zadaniu 2 — plik `resultsVnextOkr.validators.ts` poza allowlistą)
— węższa niż ROI-owa siostrzana schema: brak `finalLessonsText`, bo
komenda OKR świadomie NIE kopiuje żadnego pola narracyjnego (pięć
osobnych pól, brak jednego "final text" do skopiowania — patrz własny
komentarz komendy).

Test (`okrSetCheckInReasonAndTeresaDispositionRoute.realdb.test.ts`,
sekcja "Task 3", 6/6 passed): `getObjective` znajduje realny obiekt dla
właściciela; `getObjective` zwraca `null` dla losowego UUID (404
generyczne); `getObjective` zwraca `null` dla innej organizacji
(izolacja cross-org); pełny przebieg utworzenia szkicu → dyspozycji
(narracyjne pola pozostają `null`); bramka zdolności (aktor bez
uprawnień → `CommandCapabilityDeniedError`); nieaktualny `expectedVersion`
→ `AtomicWriteConflictError`.

---

## Środowisko testowe

Postgres 17 lokalny: `initdb --locale=C -D /tmp/rn-g6-srv-pgdata`,
`pg_ctl start -o "-p 55921 -k /tmp/rn-srv-sock -c listen_addresses=127.0.0.1"`,
baza `consultify_test`. Migracje: `NODE_ENV=test DB_TYPE=postgres
DATABASE_URL=postgresql://postgres@127.0.0.1:55921/consultify_test npx tsx
server/scripts/migrate.postgres.ts` (bez `--safe`) — **wszystkie migracje
przeszły**, łącznie z nową `20260831_rvn_okr_not_calculable_reason.sql`.
Testy: `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=...`.
Port 55821 (PID 38806, inne tory) nie tknięty.

## Wyniki testów — trzy stany

Uruchomienie wszystkich 5 nowych/zmienionych plików testowych razem
(jedna komenda vitest, ten sam proces, ta sama baza):

```
Test Files  5 passed (5)
     Tests  33 passed (33)
```

Rozbicie:
- `tests/resultsVnext/okr/okrSetRollupCalculator.test.ts` — 18/18 passed
  (czysta funkcja, bez DB) — 4 nowe asercje dla `overallProgressReason`/
  `overallConfidenceReason`, reszta niezmieniona.
- `tests/resultsVnext/okr/okrSetCheckInReasonAndTeresaDispositionRoute.realdb.test.ts`
  — 8/8 passed (real DB).
- `tests/resultsVnext/kpi/kpiDeviationCorrectiveEffectivenessReadRoutes.realdb.test.ts`
  — 3/3 passed (real DB).
- `tests/resultsVnext/kpi/kpiScorecardForKpiReverseLookupRoute.realdb.test.ts`
  — 3/3 passed (real DB).
- `tests/resultsVnext/roi/roiScenarioOverridesReadRoute.realdb.test.ts`
  — 1/1 passed (real DB).

**Failed: 0. Skipped: 0** (żaden plik nie miał powodu do skip — baza była
skonfigurowana i osiągalna w każdym uruchomieniu; `DB_CONFIGURED` był
`true` przez cały przebieg).

Znane tło (NIE naprawiane, poza zakresem — potwierdzone, że mnie NIE
dotyczy, bo moje pliki testowe albo nie dotykają `initiatives`, albo
jawnie ustawiają `status='DRAFT'` przy insertach): 26 plików
`tests/resultsVnext` padających w `beforeAll` na `initiatives.status
DEFAULT 'step3'`. Mój plik `roiScenarioOverridesReadRoute.realdb.test.ts`
faktycznie o to zahaczył (patrz kontrola negatywna niżej — CHECK
constraint `initiatives_status_check` odrzucał domyślny `'step3'`),
naprawione LOKALNIE w fixture (jawny `status='DRAFT'` w INSERT), zero
zmian w kodzie produkcyjnym ani w migracjach.

## Kontrola negatywna ×3

**#1 (zadanie 1)** — w `okrCheckInCommands.ts::applySetRollupUpdate`
podmieniłem `rollup.overallProgressReason, rollup.overallConfidenceReason`
na `null, null` w liście parametrów `UPDATE`. Ponowne uruchomienie
`okrSetCheckInReasonAndTeresaDispositionRoute.realdb.test.ts`:
```
AssertionError: expected null not to be null
 ❯ ...:366:43
    expect(set.overallProgressReason).not.toBeNull();
```
— czerwień, komunikat trafny (dokładnie ta asercja, którą naprawa miała
uczynić prawdziwą). Cofnięte, ponowny przebieg: **8/8 passed**.

**#2 (zadanie 2)** — w kopii lokalnego helpera `listVisibleScorecardsForKpi`
wewnątrz `kpiScorecardForKpiReverseLookupRoute.realdb.test.ts` (verbatim
copy tej samej funkcji z `kpiScorecard.routes.ts` — funkcja
nieeksportowana, więc test trzyma własną kopię, ten sam wzorzec co
istniejący `kpiScorecardRepositoryRoutesRealdb.test.ts` dla
`loadVisibleScorecard`) podmieniłem drugi `resourceType: 'kpi_scorecard'`
na `'kpi'` (łamiąc krok 2 — widoczność karty). Ponowny przebieg:
```
AssertionError: expected [] to include '7e0a...' (asOwner)
AssertionError: expected [] to include 'e12b...' (asOwner)
```
— czerwień na WŁAŚCICIELU (bo `rvn_visible_resources` z resourceType `kpi`
nie zawiera w ogóle id kart wyników — złamanie jest widoczne natychmiast,
nawet ostrzej niż zakładałem). Cofnięte, ponowny przebieg: **3/3 passed**.

**#3 (zadanie 3)** — w teście bramki zdolności podmieniłem
`access: { capabilities: [], platformRole: null }` na
`{ capabilities: ['*'], platformRole: null }` (aktor bez własności
obiektu, ale teraz z wildcardem). Ponowny przebieg:
```
AssertionError: promise resolved "{...disposition result...}" instead of rejecting
 ❯ ...:488:7  .rejects.toBeInstanceOf(CommandCapabilityDeniedErrorCtor)
```
— czerwień, komunikat trafny (odrzucenie oczekiwane, otrzymano sukces).
Cofnięte, ponowny przebieg: **8/8 passed**.

## Bramki z exit code

`NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p server`,
exit code czytany bezpośrednio przez `$?` po komendzie (nie przez
`PIPESTATUS` po `tail`):
```
$ npx tsc --noEmit -p server > /tmp/tsc_final.txt 2>&1; echo "EXIT:$?"
EXIT:1
$ grep -c "error TS" /tmp/tsc_final.txt
18
$ grep "error TS" /tmp/tsc_final.txt | grep -v roiCalculationEngine
(pusto)
```
18 błędów, wszystkie w `roiCalculationEngine.ts` (Decimal.js) — dokładnie
tyle, ile brief deklaruje jako PRZEDISTNIEJĄCE. **Zero nowych błędów.**

`git diff --check`: exit 0, brak konfliktów białych znaków.

## Czego to NIE dowodzi

- Nie dowodzi, że front-end faktycznie woła którąkolwiek z czterech nowych
  tras GET ani nową trasę POST — to zadanie serwerowe; podłączenie UI
  (jeśli w ogóle zaplanowane) to osobny krok, poza tym przebiegiem.
- Nie dowodzi zachowania pod współbieżnością (dwa równoległe
  `applySetRollupUpdate` na tym samym Secie) — nie było to częścią
  zadania (D08 to kwestia persystencji jednej wartości, nie CAS).
- Nie dowodzi, że `assertCommandCapability`/widoczność działają
  poprawnie dla RÓL innych niż "właściciel" / "wildcard" / "pusty zestaw
  uprawnień" — testowane trzy skrajne przypadki, nie cała macierz ról.
- Nie dowodzi zachowania na środowisku demo/staging — wszystko
  zweryfikowane na lokalnym, jednorazowym Postgresie 17
  (`/tmp/rn-g6-srv-pgdata`, port 55921), nie na żywej bazie Railway.
- Test dla reverse-lookupu (`kpiScorecard.routes.ts::listVisibleScorecardsForKpi`)
  weryfikuje kopię zapytania, nie samą nieeksportowaną funkcję —
  rozjazd między kopią a oryginałem byłby błędem kopiuj-wklej, nie
  nieprzetestowaną ścieżką kodu (ten sam, świadomy kompromis co
  `kpiScorecardRepositoryRoutesRealdb.test.ts` już przyjął dla
  `loadVisibleScorecard`).
- Nie uruchomiłem pełnego `tests/resultsVnext` (26 znanych, niezwiązanych
  awarii tła) — tylko plików zmienionych/nowych w tym przebiegu.

## Czy ruszyłem coś poza allowlistą

Nie. `git show --stat` na wszystkich trzech commitach:
- `0dbdeba273`: migracja + 4 pliki `okr/` z allowlisty + 2 pliki testowe
  w `tests/resultsVnext/okr/**`.
- `782ddd02da`: `kpiDeviation.routes.ts` + `kpiScorecard.routes.ts` +
  `roi.routes.ts` (wszystkie trzy z allowlisty) + 3 nowe pliki testowe
  w `tests/resultsVnext/{kpi,roi}/**`.
- `995b2bfdd9`: wyłącznie `okr.routes.ts`.

Zero dotknięć: `PostgresDatabase.ts`, trzech zakazanych plików
`kpi/*.realdb.test.ts`, migracji `20260810_fix_initiatives_status_default.sql`,
`src/components/ResultsVNext/**`, `roi/**`/`okr/**` poza wskazanymi
plikami, żadnego pliku `*.validators.ts` (schematy zadeklarowane lokalnie
w plikach tras zamiast tego — patrz uzasadnienie w każdym pliku).
`.claude/launch.json` nie tknięty, nic nie zcommitowane spoza tego zakresu.
