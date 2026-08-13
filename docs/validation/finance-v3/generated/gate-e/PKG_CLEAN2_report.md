# PKG_CLEAN2 — Consistency-debt payoff (Comments/SavedViews DTO shape · enum-label leaks · Decimal precision)

Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-e-analysis`
Branch: `codex/fv3p-clean2-shape`
Base: `2b797bdeb1` (fan-in candidate, 88 endpoints)
Final SHA: **`1978d126d1955c3c40070f217e9134577e7ef56d`**

Three commits, one per task, each independently verified before moving on:

| SHA | Commit |
|---|---|
| `a4adaa0c99` | `fix(finance-v3/routes-exposure): map comments/saved-views endpoints to camelCase DTOs` |
| `5a220396cc` | `fix(finance-v3): stop leaking raw SCREAMING_SNAKE_CASE enums to the UI` |
| `1978d126d1` | `fix(finance-v3): computeYoyDelta uses Decimal, not float` |

Allowlist respected: `server/src/routes/v8/finance-v2/{comments,saved-views}.routes.ts` (+ their
`__tests__`), `src/components/Finance/Analysis/**`, `src/components/Finance/Valuation/**`, plus the
shared label layer `src/services/api/financeV2.types.ts` and
`tests/unit/finance/rawEnumLeakScanner.test.ts` (new file, added with `git add -f`). Never touched
`src/components/Finance/StatementPack/**` or
`server/src/routes/v8/finance-v2/__tests__/valuation-independent-verifier.pg.test.ts` — the parallel
agent's (`codex/fv3p-clean1-types`) allowlist.

```
git diff --stat 2b797bdeb1 HEAD
 .../__tests__/comments.routes.pg.test.ts           |  27 +++-
 .../__tests__/saved-views.routes.pg.test.ts        |  14 +-
 server/src/routes/v8/finance-v2/comments.routes.ts |  85 +++++++++--
 .../src/routes/v8/finance-v2/saved-views.routes.ts |  45 +++++-
 .../Finance/Analysis/AnalysisCreatorWizard.tsx     |  18 ++-
 .../Finance/Analysis/AnalysisKpiDetailCard.tsx     |   3 +-
 .../__tests__/analysisKpiTable.contract.test.ts    |  25 ++++
 .../Finance/Analysis/analysisKpiCatalog.ts         |  14 ++
 .../Finance/Analysis/analysisKpiTable.contract.ts  |  29 +++-
 .../Finance/Valuation/steps/AdvisorStep.tsx        |  22 ++-
 .../Finance/Valuation/steps/MethodsWeightsStep.tsx |  10 +-
 .../Finance/Valuation/steps/ResultsStep.tsx        |  15 +-
 .../Finance/Valuation/steps/SensitivityStep.tsx    |  13 +-
 .../Finance/Valuation/steps/SourceStep.tsx         |  11 +-
 src/services/api/financeV2.types.ts                | 137 ++++++++++++++++++
 tests/unit/finance/rawEnumLeakScanner.test.ts      | 161 +++++++++++++++++++++
 16 files changed, 570 insertions(+), 59 deletions(-)
```

---

## Zadanie 1 — surowe wiersze bazy w odpowiedziach API

**23 endpointów przerobionych, potwierdzone** (17 w `comments.routes.ts` + 6 w
`saved-views.routes.ts` — dokładnie liczba z briefu). Rozbicie:

- `comments.routes.ts`: 9 endpointów komentarzy (create/resolve/reopen/assign/get-assignment/
  get/list/search-by-cell/mentions-me) + 5 endpointów checklisty (add/check/uncheck/required/list)
  = **14 endpointów** przeszło z surowego wiersza na `toCommentDto`/`toCommentAssignmentDto`/
  `toChecklistItemDto`. Pozostałe 3 endpointy tego pliku (`has-unresolved-blocking-comments`,
  `all-required-checked`, `changed-cells`) już zwracały czysty camelCase (booleany/DTO z serwisu) —
  nie wymagały zmiany, ale są policzone w 17, bo brief liczy WSZYSTKIE endpointy pliku.
- `saved-views.routes.ts`: **5 endpointów** (create/list/shared/get/patch) przerobione na
  `toSavedViewDto`. `DELETE` (6. endpoint) zwraca `204` bez ciała — nie ma czego mapować.

**14 + 5 = 19 realnych row→DTO konwersji**, reszta (4) już była czysta — razem 23 endpointy
pliku, zgodnie z oczekiwaniem briefu.

**Konwencja: REUŻYTA, nie wymyślona od nowa.** `crosscutting.routes.ts:54-66` miało już lokalny
`toDto`-style mapper (funkcja `toDto` obok routera, jawnie wymienione pola, brak generycznego
serializera). Dodane `toCommentDto`/`toCommentAssignmentDto`/`toChecklistItemDto`/`toSavedViewDto`
są tą samą konwencją, zastosowaną konsekwentnie w obu plikach.

**`organization_id` — świadomie USUNIĘTY z każdego DTO.** Uzasadnienie: każde zapytanie w obu
plikach jest już `WHERE organization_id = ?` (własny org callera), więc pole niesie zero informacji
dla klienta — tylko wewnętrzny szczegół implementacji. Inne wewnętrzne kolumny (`business_version_id`
zostało, bo jest częścią kontraktu API — callerzy filtrują po nim) zostały ocenione per-pole, nie
hurtowo.

**Semantyka NIE zmieniona.** Żaden serwis (`commentService.ts`, `reviewChecklistService.ts`,
`savedViewService.ts`) nie był dotknięty — zmiana jest wyłącznie w warstwie routera (mapowanie
odpowiedzi). Macierz cross-tenant (oba pliki testów) przechodzi bez osłabienia ani jednej asercji —
zaktualizowano WYŁĄCZNIE nazwy pól czytanych z `res.body.data` (np. `is_blocking`→`isBlocking`),
dodając PRZY OKAZJI nowe asercje `not.toHaveProperty('organization_id'/'is_blocking'/...)`, nigdy nie
usuwając istniejącej asercji cross-tenant.

**Konsumenci sprawdzeni — ZERO poza testami.** `grep` po `finance-v2/comments`, `finance-v2/review-
checklist`, `finance-v2/saved-views`, `canonical/commentService`, `canonical/reviewChecklistService`,
`canonical/savedViewService` w całym `server/src`, `src`, `tests` — jedyne trafienia to same pliki
routerów/serwisów i ich `__tests__`, plus jeden niepowiązany legacy `tests/unit/backend/services/
commentService.test.ts` (inny moduł — SQLite `comments` table, Interview/legacy, nie Finance v3).
Potwierdza nagłówek plików: "ZERO HTTP routes and ZERO callers" przed tym pakietem.

**GET-y wyceny pakietu B3 (WACC/Bridge/Terminal/Sensitivity):** NIE dotknięte — poza allowlistą tego
zadania (`src/components/Finance/Valuation/**` i `Analysis/**` to frontend; backendowe trasy wyceny
to inny plik routera, `valuation.routes.ts`, poza moim allowlistą backendową). Zgłaszam jako pozycję
na kolejną falę, zgodnie z instrukcją "jeśli starczy budżetu" — nie starczyło w ramach tej allowlisty
(dodatkowo backend valuation.routes.ts nie był wymieniony w mojej allowlist backendowej, więc go nie
ruszałem, żeby nie wejść na terytorium innego agenta).

---

## Zadanie 2 — surowe enumy jako etykiety w UI

**Reużyto istniejące rozwiązanie #110** (`src/components/Benefits/ValuationWorkspace.tsx`'s
`valuationStatusLabel`/`valuationSourceLabel`, `tests/unit/finance/valuationEnumLabels.test.ts`) jako
WZORZEC — sama funkcja nie mogła być reużyta 1:1 (inna domena enumów: metody wyceny/gotowość/pewność/
typ artefaktu/status wersji/branża, nie status/źródło pojedynczej wyceny), więc rozszerzono ten sam
kształt (`switch` z wyczerpującym `never`-guard, Polish label, fallback dla nieznanych kodów) do
NOWEGO wspólnego miejsca — `src/services/api/financeV2.types.ts` (frontendowy port typów serwera,
już miał precedens: `financeValueDisplayReasonLabel` obok `FinanceValueStatus`) — zamiast pisania
czwartej niezależnej implementacji.

Dodane funkcje (wszystkie w `financeV2.types.ts`, obok swoich enumów):
`valuationMethodTypeLabel`, `valuationMethodReadinessLabel`, `valuationAdvisorConfidenceLabel`,
`financeArtifactTypeLabel`, `businessVersionStatusLabel`, `financeLineageTransformationKindLabel`.
Plus `industryLabelForCode` w `src/components/Finance/Analysis/analysisKpiCatalog.ts` (obok
`ANALYSIS_INDUSTRY_PRESETS`, reużyty przez DWA miejsca — Kreator i kartę szczegółową KPI, patrz
niżej).

**Osiem wycieków naprawionych** (dwa z briefu + sześć znalezionych przy przeglądzie tego samego pliku
podczas naprawy):

| Plik | Pole | Przykładowa surowa wartość |
|---|---|---|
| `AnalysisCreatorWizard.tsx:198` | `opt.status` | `APPROVED` (z briefu) |
| `AnalysisCreatorWizard.tsx:381` | `state.industryCode` | `MANUFACTURING` (z briefu) |
| `MethodsWeightsStep.tsx` (×4: komórka, dropdown nowej metody, `notReadyMethodTypes.join`) | `m.methodType` | `DCF_FCFF`, `TRADING_COMPS` |
| `MethodsWeightsStep.tsx` | `m.readiness` | `READY`, `NOT_CONFIGURED`, `DATA_INCOMPLETE` |
| `ResultsStep.tsx` | `m.methodType` | j.w. |
| `SensitivityStep.tsx` (dropdown metody) | `m.methodType` | j.w. |
| `AdvisorStep.tsx` | `f.confidence` | `HIGH`, `MEDIUM` |
| `AdvisorStep.tsx` | banner statusu blokady | surowy `BusinessVersionStatus` |
| `SourceStep.tsx` | `sourceEdge.sourceArtifactType` | np. `BASELINE_MODEL` |
| `SourceStep.tsx` | `sourceEdge.transformationKind` | `VALUATION_FROM_BASELINE` (z briefu) |
| **`AnalysisKpiDetailCard.tsx:147`** (★ NIE w brifie — znaleziony przez skaner) | `kpiValue.benchmark.industryCode` | `MANUFACTURING`-style |

**NA / NOT_APPLICABLE / MISSING pozostają rozróżnialne** — nie dotykane, bo już poprawnie rozwiązane
(`financeValueDisplayReasonLabel`, `ValuationValueCell.tsx`, trzy różne teksty powodu, sprawdzone
istniejącym testem i ponownie w regresji tej sesji — 170/170 zielono w `Finance/Analysis`+
`Finance/Valuation`, w tym testy DOM `ValuationWorkspace.test.tsx`'s "N/A vs PLN 0" kontrole).

**Skróty kanoniczne** (`DCF`, `WACC`) zachowane jako skróty w etykietach (np. `"DCF (FCFF)"`, nie
tłumaczone na pełne słowa) — zgodnie z instrukcją.

### Test wykrywający NOWE wycieki

`tests/unit/finance/rawEnumLeakScanner.test.ts` — statyczny skaner (bez renderowania), przeszukuje
KAŻDY `.tsx` w `src/components/Finance/Analysis/` i `src/components/Finance/Valuation/` regexem
łapiącym gołą interpolację JSX (`{x.y.znanaWłaściwość}`) dla ośmiu nazw pól-nośników enumów
(`methodType`, `readiness`, `confidence`, `status`, `industryCode`, `sourceArtifactType`,
`targetArtifactType`, `transformationKind`), z filtrem fałszywych trafień (atrybuty JSX `attr={...}`
i interpolacje w template-literalach `${...}` wewnątrz `data-testid`).

**Load-bearing, zweryfikowane empirycznie:**
1. Pierwszy przebieg skanera (przed dopisaniem filtra fałszywych trafień) złapał **prawdziwy,
   nieopisany w briefie wyciek** w `AnalysisKpiDetailCard.tsx` — naprawiony w tym samym pakiecie.
2. Po naprawie: cofnięto ręcznie jedną poprawkę (`AdvisorStep.tsx`'s `f.confidence`) — skaner poszedł
   na czerwono, nazwał dokładny plik i dopasowany fragment (`{f.confidence}`). Przywrócono
   (`git diff` potwierdza identyczny stan), ponownie zielono.
3. Sanity-check chroni przed cichym pustym skanem (asercja, że katalogi realnie istnieją i skan
   widzi znane pliki) — gdyby ścieżki się przesunęły, test i tak by nie przeszedł fałszywie.

---

## Zadanie 3 — float w ścieżce produkcyjnej

`analysisKpiTable.contract.ts`'s `computeYoyDelta` (kolumna "Zmiana r/r") przepisana na `Decimal`
(`decimal.js`, ten sam wzorzec co `analysisKpiCompute.ts` — `valueDecimal` string prosto do
`Decimal`, cała arytmetyka pośrednia `Decimal`, `.toNumber()` RAZ na granicy prezentacji, zgodnie z
komentarzem w `analysisKpiCompute.ts`: "zaokrąglanie WYŁĄCZNIE na granicy prezentacji").

**Kontrola negatywna (dokładnie przypadek z briefu):** `current="0.2"`, `prior="-0.1"` →
`Number('0.2') - Number('-0.1')` = `0.30000000000000004` (IEEE-754, ten sam artefakt co `0.1+0.2`,
zweryfikowane `node -e`) zamiast dokładnego `0.3`. Test pinuje OBIE strony: surowy float-artefakt
(dowód, że problem jest realny) ORAZ że `computeYoyDelta` zwraca dokładnie `0.3`. Drugi test
regresyjny pokrywa `percentDelta` (dzielenie) analogicznie.

**Sprawdzone przy okazji — inne miejsca na float w tym samym pliku i w `analysisKpiCompute.ts`:**
`grep -n "Number("` na obu plikach — `analysisKpiTable.contract.ts` miał TYLKO te dwie linie (teraz
naprawione); `analysisKpiCompute.ts` ma `Number(` wyłącznie w KOMENTARZU wyjaśniającym, dlaczego
`Number()` jest zakazany (plik już przeszedł tę samą naprawę wcześniej, "korekta koordynatora
2026-08-12" — potwierdzone czytaniem, nie zgadywaniem).

**Drobne (starczyło budżetu):** brak spacji tysięcznych naprawiony w DWÓCH miejscach z briefu:
- `ResultsStep.tsx` — most EV→Equity renderował `results.bridge.header.enterprise_value_decimal`
  wprost jako string (brak formatowania w ogóle) → nowy `fmtDecimalString()` (pl-PL, grupowanie
  tysięcy).
- `SensitivityStep.tsx` — komórki siatki 5×5 (`cell_value_decimal`, duże liczby EV) renderowały się
  bez grupowania → nowy `fmtCellValue()`. Wartości osi (WACC/g, małe procenty) świadomie NIE
  ruszone — grupowanie tysięcy nie ma tam znaczenia, a próba "poprawy" bez realnego zgłoszonego
  problemu byłaby scope creep.

---

## Testy i tsc — wyniki z jawnymi kodami wyjścia

Baza: `postgresql://piotrwisniewski@127.0.0.1:54330/clean2_e_verify` (własna nazwa, NIE `clean2` —
uniknięcie kolizji z równoległym agentem `codex/fv3p-clean1-types` na tym samym klastrze), sprzątnięta
`dropdb` po zakończeniu weryfikacji.

**Backend (`server/`), real Postgres, `RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL=...`:**

| Zakres | Wynik | Exit |
|---|---|---|
| `comments.routes.pg.test.ts` + `saved-views.routes.pg.test.ts`, `--maxWorkers=2` | 33/33 | **0** |
| Cały `finance-v2/` (17 plików, wyłączając `valuation-independent-verifier.pg.test.ts` — patrz niżej) | 149/149 | **0** (po jednym retry — patrz notatka o obciążeniu) |

**★ `valuation-independent-verifier.pg.test.ts` — WYŁĄCZONY ze zliczeń, POZA moją allowlistą.**
Uruchomiony osobno (izolowanie, `--maxWorkers=1`, dwa przebiegi): **konsekwentnie CZERWONY** (1/1
failed, `INDEPENDENT VERIFIER — Pakiet B3 claim #8 (DCF idempotent-replay 500)`), nawet w izolacji —
to dokładnie plik, który brief przypisuje RÓWNOLEGŁEMU agentowi
(`codex/fv3p-clean1-types`) do naprawy. Nie dotykałem go ani jego trasy. Zgłaszam jako
przedistniejące, cudze.

**★ Obciążenie maszyny (potwierdzone, zgodnie z ostrzeżeniem briefu):** pierwszy przebieg pełnego
`finance-v2/` (17 plików naraz, 43,9s) dał `Error: socket hang up` w NIEZWIĄZANYM teście
(`saved-views.routes.pg.test.ts`'s shared-token test) + sześć `EnvironmentTeardownError` z
`valuation-b3-review.routes.pg.test.ts` (inny, niezmieniony przeze mnie plik) — klasyczny objaw
wyczerpania zasobów pod obciążeniem, nie regresja. Powtórzony pomiar (identyczna komenda, bez
żadnej zmiany kodu): **17/17 plików, 149/149 testów, exit 0**, czysto.

**Frontend (root `vitest`), `Finance/Analysis` + `Finance/Valuation` + oba pliki skanera enumów:**

| Zakres | Wynik | Exit |
|---|---|---|
| `src/components/Finance/Analysis` + `src/components/Finance/Valuation` + `rawEnumLeakScanner.test.ts` + `valuationEnumLabels.test.ts` | 184/184 | **0** |

**`tsc` — oba zakresy, jawne kody wyjścia (z podbitym heapem — bez tego OOM-uje i wygląda na
sukces, dokładnie ostrzeżenie z briefu):**

- `-p server/tsconfig.json`: **exit 0**, zero błędów (plik wyjścia PUSTY — `wc -l` = 0 — potwierdzone
  procesem zakończonym, nie zawieszonym).
- root `tsconfig.json` (`NODE_OPTIONS=--max-old-space-size=8192`): **exit 2**, **dokładnie 9 błędów**,
  WSZYSTKIE w `src/components/Finance/statementPackWorkspaceV2/` (znane, cudze — naprawia równolegle
  `codex/fv3p-clean1-types`). Zmierzone DWA razy w tej sesji (przed i po moich zmianach Zadania 2/3) —
  liczba błędów identyczna (9), żaden nowy nie doszedł.

---

## Co NIE zostało dostarczone (z powodem)

1. **GET-y pakietu B3 (WACC inputs/Bridge/Terminal/Sensitivity) w backendzie** — poza allowlistą tej
   sesji (backendowa allowlista to tylko `comments.routes.ts`/`saved-views.routes.ts`; trasa wyceny to
   inny plik routera). Pozycja na kolejną falę, jak przewidział brief.
2. **`category` KPI (`string | null`, wolny tekst)** — świadomie NIE dodany do skanera/etykiet: to nie
   jest zamknięty enum (brak stałej listy wartości w kodzie), więc "etykieta" byłaby zgadywaniem, nie
   tłumaczeniem. Udokumentowane w komentarzu w pliku testu.
3. **Wartości osi siatki wrażliwości (WACC/g)** — nie dotknięte formatowaniem tysięcy (małe procenty,
   nieistotne dla czytelności, brief nie zgłaszał ich konkretnie).

Wszystko trzy powyżej to świadome decyzje zakresu, nie luki przeoczone.
