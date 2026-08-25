# Execution dzień 11 — raport dyżuru 2026-08-25

Baza: `codex/day11-instrukcja-20260825 @ 45f6f08d2436515655bd4d9594e78f12975dbb7a` (jawne polecenie nadzorcy zastępuje nominalną bazę z §0.1 instrukcji)  
Marker: `5f96e936ac` — POTWIERDZONY jako przodek HEAD  
Gałąź robocza: `codex/execution-day11-20260825`  
Worktree: `/private/tmp/consultify-execution-day11`  
Zgoda na flagę `execReportsIntelligence`: **NADANA IMIENNIE — DEC-2026-08-25-63**
Porty użyte: `3357` (dev-render); portu PG nie użyto  
Kontener PG: nie stawiałem  
Czas pracy: 2026-08-25 19:24–19:28 CEST; wznowienie od 20:35 CEST

## Oświadczenie o chronionym WIP (Z4/Z5)

Nie otwierałem, nie czytałem i nie kopiowałem katalogu
`/Users/piotrwisniewski/Developer/Consultify`. Jedynym źródłem wymagań były
kontrakt modułu, rejestr decyzji, instrukcja oraz kod w izolowanym worktree.
**TAK**.

## Materiały wiążące — potwierdzenie dostępu

| Plik                                                 | Widoczny | Przeczytany                 |
| ---------------------------------------------------- | -------- | --------------------------- |
| `modules/06_EXECUTION/MODULE_ACCEPTANCE.md` (308 l.) | TAK      | `:106-125`, `:127-286`      |
| `OWNER_DECISION_LEDGER_2026-08-24.md` (112 l.)       | TAK      | `:25` (`DEC-2026-08-24-03`) |
| `CODEX_DAY11_EXECUTION_INSTRUKCJA.md` (1300 l.)      | TAK      | całość                      |

## Warunki wstępne — wynik sprawdzenia

| Sprawdzenie                               | Oczekiwane                    | Wynik       | Dowód                                                   |
| ----------------------------------------- | ----------------------------- | ----------- | ------------------------------------------------------- |
| Marker przodkiem tipa                     | TAK                           | TAK         | `git merge-base --is-ancestor 5f96e936ac HEAD` → exit 0 |
| Materiały kontraktowe                     | 308 l.; identyfikatory obecne | TAK         | `wc -l` → 308; `grep -c` → 5                            |
| `ExecutionReportsSurface.tsx`             | 1222 l.                       | TAK         | `wc -l` → 1222                                          |
| `executionFeatureFlags.ts`                | instrukcja: 124 l.            | ROZBIEŻNOŚĆ | `wc -l` → 123; `changeSignals` na `:56/:105/:115`       |
| `reportRun.ts`                            | 299 l.; cykl DRAFT→PUBLISHED  | TAK         | `:29`, `:39-42`, `:183-243`                             |
| `managementReports.routes.ts`             | 460 l.                        | TAK         | `wc -l` → 460                                           |
| `ReportGeneratorWizard` montowany w Hubie | TAK                           | TAK         | import `ExecutionHub.tsx:59`, montaż `:5693`            |
| strażnik rejestru (przed)                 | PASS                          | 5/5 PASS    | Vitest, 2026-08-25 19:26 CEST                           |
| PDF (przed)                               | PASS                          | 4/4 PASS    | Vitest, 2026-08-25 19:26 CEST                           |
| reporting menu (przed)                    | PASS                          | 2/2 PASS    | Vitest, 2026-08-25 19:26 CEST                           |
| check-list-canon                          | dług nie rośnie               | PASS        | pełny skan: 174 pliki; 404 naruszenia / baseline 404    |

## ★ Mapa delty runtime vs kontrakt (E.0)

### EXE-WORK-REPORT-01

| Element kontraktu                                     | Werdykt          | Dowód plik:linia                                                                           | Uwaga                                                                                                     |
| ----------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Operacyjne sekcje postępu, blokad, terminów i decyzji | JEST_CZĘŚCIOWO   | `src/components/Reports/reportContentGenerator.ts:164,218,245,316,425-428`                 | Typowany dokument operacyjny istnieje, lecz nie jest raportem Work Intelligence.                          |
| RAG i metryki dokumentu                               | JEST_CZĘŚCIOWO   | `reportContentGenerator.ts:22-66,121-157`                                                  | Brak kontraktowego num/denom, timestampu, klasy wartości i dokładnego drill-down dla każdego KPI.         |
| Pasek zaufania + Executive Pulse ≤8 KPI               | BRAK_API         | `MODULE_ACCEPTANCE.md:163-188`; brak odpowiadającego read-modelu w zweryfikowanych trasach | Istniejące generowanie nie zapewnia wspólnego, rekoncyliowalnego kontraktu KPI.                           |
| Horyzont i 12-tygodniowy trend                        | BRAK_API         | `MODULE_ACCEPTANCE.md:166,170,175-188`; `executionAnalytics.routes.ts:87-235`              | Analytics ma predict/triage/dependencies/intelligence, ale nie historyczny, wersjonowany trend raportowy. |
| BSC/objective-risk                                    | BRAK_API         | `MODULE_ACCEPTANCE.md:167,137`; brak mapowań objective/perspective w sprawdzonych trasach  | Poprawny przyszły wariant bez mapowań musi być nazwany operacyjnym backlogiem (E-O3).                     |
| FACT / INFERENCE / RECOMMENDATION                     | BRAK_UI_JEST_API | `executionAnalytics.routes.ts:87-235`; `MODULE_ACCEPTANCE.md:197-206`                      | Endpointy analityczne istnieją, brak kontraktowej powierzchni z cytowaniem/pewnością.                     |
| Auditable register i przejście do governed tool       | JEST_CZĘŚCIOWO   | `ExecutionReportsSurface.tsx:623,689,900,965`; kontrakt `MODULE_ACCEPTANCE.md:190-195`     | Kanoniczny rejestr istnieje i jest nietykalny; brak raportowego drill-down KPI→rekord.                    |
| Reprodukcja historycznego `as-of`                     | BRAK_API         | `reportRun.ts:34,198-211`                                                                  | `asOf` jest zamrażane w migawce, ale nie znaleziono rekonstrukcji źródeł na historyczny moment (E-O6).    |

### EXE-RESOURCES-REPORT-01

| Element kontraktu                                             | Werdykt          | Dowód plik:linia                                                                           | Uwaga                                                                                             |
| ------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Obliczenie demand/capacity i heatmapy                         | BRAK_UI_JEST_API | `executionAnalytics.routes.ts:13-18,145-190`                                               | Endpointy czystego modelu i sygnałów istnieją; brak kontraktowego raportu i rodowodu.             |
| Capacity timeline / alerty                                    | BRAK_UI_JEST_API | `executionControl.routes.ts:1011-1037`; `execution-control.ts:424-428`                     | Jest klient odczytowy, lecz komentarz serwera dokumentuje zastany shape mismatch przy alertach.   |
| Każda osoba, także bez zadania w tygodniu bazowym             | BRAK_API         | `MODULE_ACCEPTANCE.md:234-248`; brak takiej gwarancji w payloadach sprawdzonych endpointów | Nie wolno wyprowadzać pełnej populacji z samych allocations.                                      |
| Dostępność po absencjach, obowiązkach, rezerwacjach i buforze | BRAK_API         | `MODULE_ACCEPTANCE.md:244`; `executionAnalytics.routes.ts:145-190`                         | Endpoint przyjmuje capacities, ale nie dowodzi ich kanonicznego źródła ani kompletności (E-O5).   |
| Role/skills, widok osoba↔projekt, rejestry braków             | BRAK_API         | `MODULE_ACCEPTANCE.md:242-244`; brak kontraktu w zweryfikowanych trasach                   | Brak podstaw do uczciwego obliczania pokrycia.                                                    |
| Niezmienna opublikowana wersja                                | JEST_CZĘŚCIOWO   | `reportRun.ts:210-243`                                                                     | Runtime-v1 zamraża snapshot/hash i publikuje JSON, ale nie rozstrzyga kanonicznego backendu E-O1. |

### EXE-CONTROL-REPORT-01

| Element kontraktu                                  | Werdykt          | Dowód plik:linia                                                    | Uwaga                                                                                                           |
| -------------------------------------------------- | ---------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Sygnały/interwencje i klient odczytowy             | JEST_CZĘŚCIOWO   | `executionControl.routes.ts:54-1026`; `execution-control.ts:1-591`  | Backend operacyjny jest szeroki, ale nie stanowi pełnego raportu tygodniowego.                                  |
| Predict/triage/dependency/capacity intelligence    | BRAK_UI_JEST_API | `executionAnalytics.routes.ts:87-235`                               | API analityczne istnieje; brak zunifikowanej raportowej powierzchni.                                            |
| Pełna pętla lineage signal→verification→reopen     | JEST_CZĘŚCIOWO   | `MODULE_ACCEPTANCE.md:250-264`; trasy control                       | Są elementy domenowe, lecz brak zweryfikowanego jednego read-modelu gwarantującego dwukierunkową rekoncyliację. |
| KPI i forward scenarios 2/4/8/12 tyg.              | BRAK_API         | `MODULE_ACCEPTANCE.md:258`; brak dedykowanego kontraktu raportowego | Nie wolno składać wartości z niejawnych progów.                                                                 |
| FACT/INFERENCE/RECOMMENDATION + stany epistemiczne | BRAK_UI_JEST_API | `MODULE_ACCEPTANCE.md:260`; analytics routes                        | Brak kontraktowej UI i cytowań mimo dostępnych analiz cząstkowych.                                              |
| Severity i reaction SLA                            | BRAK_API         | `MODULE_ACCEPTANCE.md:262`                                          | Wartości/taksonomia wymagają decyzji Piotra; nie zgadywano.                                                     |
| Niezmienna publikacja                              | JEST_CZĘŚCIOWO   | `reportRun.ts:210-243`                                              | Mechanika runtime-v1 istnieje, ale E-O1 pozostaje nierozstrzygnięte.                                            |

### EXE-REPORT-GENERATOR-01

| Element kontraktu                                                            | Werdykt        | Dowód plik:linia                                                    | Uwaga                                                                                    |
| ---------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Workbench „Generator raportu”                                                | JEST           | `ExecutionReportsSurface.tsx:1001`                                  | To część kanonicznego rejestru; nie zmieniono.                                           |
| Kreator typu, celu, nazwy, audytorium, sekcji i harmonogramu                 | JEST_CZĘŚCIOWO | `ReportGeneratorWizard.tsx:147-172,208-218,290-323,332-400,498-622` | Istniejący wizard jest realny, lecz nie ma pełnego 7-krokowego kontraktu Execution.      |
| Typowany generator treści                                                    | JEST_CZĘŚCIOWO | `reportContentGenerator.ts:10-66,164-316,744-810`                   | Generuje operacyjne bloki i Markdown; nie unijny raport intelligence.                    |
| Runtime-v1 definitions/runs                                                  | JEST_CZĘŚCIOWO | `runtimeApi.ts:1430-1460`; `reportRun.ts:29-42,183-243`             | Ma DRAFT→VALIDATED→FROZEN→APPROVED→PUBLISHED, snapshot/hash i tylko JSON.                |
| Management reports: generate/history/templates/schedules/approval/versioning | JEST_CZĘŚCIOWO | `managementReports.routes.ts:36-330`                                | Drugi dojrzały backend; brak decyzji, który jest SSOT (E-O1).                            |
| PDF/PPTX/bulk export                                                         | JEST_CZĘŚCIOWO | `managementReports.routes.ts:342-453`                               | PDF/PPTX istnieją; brak potwierdzonego XLSX z runtime-v1 (E-O7).                         |
| Kontraktowy lifecycle generatora                                             | BRAK_API       | `MODULE_ACCEPTANCE.md:278`; por. `reportRun.ts:29`                  | Żaden backend nie ma wymaganego cyklu 1:1.                                               |
| History/as-of/forecast jako trzy osobne osie                                 | JEST_CZĘŚCIOWO | `reportRun.ts:34,198-211`; wizard nie ma pełnego rozdziału          | `asOf` jest polem snapshotu, ale brak historycznego replay oraz pełnego kroku kreatora.  |
| Immutable atomic publication                                                 | JEST_CZĘŚCIOWO | `reportRun.ts:207-243`                                              | Hash/frozen snapshot istnieją; integracja z drugim backendem/exportem nierozstrzygnięta. |
| Czystość listy                                                               | JEST           | `ExecutionReportsSurface.tsx:623,689,900,965,1001`                  | Zastany rejestr używa StandardTable/Preview; nie dodano kart ani banerów.                |

## Pozycje — tabela zbiorcza

| Pozycja  | Zakres                         | Status               | Commit         | Testy                                          | Dowód OFF                                                 | Zrzut     | Uwagi                                                                                                                    |
| -------- | ------------------------------ | -------------------- | -------------- | ---------------------------------------------- | --------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| E.0      | flaga + mapa delty + dowód OFF | ZROBIONE_WG_DoD      | `481108c8ce`   | własne 5/5 + zastane 11/11 PASS                | PASS: obecny rejestr, brak nowej powierzchni, 0 requestów | `08`      | Jedna flaga, default OFF także demo; realny czytnik runtime-v1 przy ON.                                                  |
| E.1      | Work Intelligence Report       | CZĘŚCIOWO / BRAK_API | `c93dc2c36b`   | własne 7/7 + T.2 5/5 PASS                      | wspólny T.2 PASS                                          | `01`–`04` | 9 sekcji, 8 KPI, drill-down i partial failure; historia/BSC/wagi pozostają BRAK_API/STOP.                                |
| E.2      | Resources Capacity Report      | CZĘŚCIOWO / BRAK_API | `07135995b3`   | własne 4/4 + T.2 5/5 PASS                      | wspólny T.2 PASS                                          | `05`      | Realne allocations, heatmapa, Osoby/Projekt/rejestry; brak pełnego availability/progów E-O5.                             |
| E.3      | Control Loop Report            | CZĘŚCIOWO / BRAK_API | `44d3a7607b`   | własne 4/4 + T.2 5/5 PASS                      | wspólny T.2 PASS                                          | `06`      | Sygnały/interwencje, KPI, lineage i NOT_VERIFIED; scenariusze oraz severity/SLA pozostają BRAK_API/STOP.                 |
| E.4      | unijny generator               | CZĘŚCIOWO / BRAK_API | `b470536a91`   | własne 5/5 + strażnik listy 5/5 + T.2 5/5 PASS | wspólny T.2 PASS                                          | `07`      | Realny DRAFT runtime-v1, exact published definition, rozdział dat i wiele kart; pełny lifecycle/XLSX pozostają BRAK_API. |
| T.1..T.6 | testy przekrojowe              | ZROBIONE             | commit końcowy | własne 25/25; strażniki 11/11                  | T.2 PASS                                                  | `01`–`08` | Daty, rekoncyliacja, epistemika, OFF/ON/error/empty i semantyka 0≠RED pokryte behawioralnie.                             |
| R.1..R.2 | rejestr/dowody                 | ZROBIONE             | commit końcowy | kanon 404/baseline 404                         | PASS                                                      | `01`–`08` | Raport, zakres, testy i osiem docelowych zrzutów zapisane.                                                               |

## E.1 — tabele werdyktów

### Executive Pulse — osiem KPI

| KPI               | num/denom   | drill-down              | rodowód                                        | Werdykt                        |
| ----------------- | ----------- | ----------------------- | ---------------------------------------------- | ------------------------------ |
| overdue tasks     | TAK         | dokładny zbiór TASK     | runtime-v1 work + sourceVersion + calculatedAt | JEST                           |
| overdue decisions | TAK         | dokładny zbiór DECISION | runtime-v1 work + sourceVersion + calculatedAt | JEST                           |
| due today         | TAK         | dokładny zbiór          | runtime-v1 work                                | JEST                           |
| at-risk 1–7 dni   | TAK         | dokładny zbiór          | runtime-v1 work                                | JEST_CZĘŚCIOWO — bez wagi E-O4 |
| active blocks     | TAK         | dokładny zbiór BLOCKED  | runtime-v1 work                                | JEST                           |
| undated risk      | TAK         | dokładny zbiór bez daty | runtime-v1 work                                | JEST; nigdy overdue/green      |
| decision latency  | nie dotyczy | brak liczby             | `UNKNOWN/BRAK_API_HISTORY`                     | BRAK_API                       |
| data completeness | TAK         | pełna populacja         | siedem jawnych kryteriów na rekord             | JEST_CZĘŚCIOWO                 |

### Dziewięć sekcji w kolejności kontraktu

| #   | Sekcja                    | Werdykt        | Dowód                                                  |
| --- | ------------------------- | -------------- | ------------------------------------------------------ |
| 1   | Kontekst i pasek zaufania | JEST           | state date, sync, scope, partial-source alert          |
| 2   | Executive Pulse           | JEST_CZĘŚCIOWO | osiem kart, maks. 8, num/denom i drill-down            |
| 3   | Co boli dziś              | JEST           | FACT z dokładnego rejestru                             |
| 4   | Co się zbliża             | JEST           | sześć kubełków + NO DUE                                |
| 5   | Co jest zagrożone         | BRAK_API       | jawnie „operacyjny”, nie BSC                           |
| 6   | Dlaczego                  | JEST_CZĘŚCIOWO | tylko zadeklarowane blokady/zależności, bez zgadywania |
| 7   | Jak system się zmienia    | BRAK_API       | `UNKNOWN/BRAK_API_HISTORY`                             |
| 8   | Co zarząd ma zrobić       | STOP E-O4      | brak rekomendacji bez wag i dowodów                    |
| 9   | Audytowalny rejestr       | JEST           | StandardTable, sourceVersion, exact task/decision open |

Formuły możliwe z obecnego read-modelu: `formalBackorder`, `slaBackorder`,
`undatedRisk`, bieżący `agingDays`, `dataCompleteness`. Formuły wymagające
historii lub decyzji konfiguracyjnej pozostają uczciwie niedostępne:
`decisionLatency`, `blockedDays`, `throughputRatio`, `netBackorderChange`,
`impactWeightedBackorder`.

## E.2 — tabela werdyktów

| Element                                                   | Werdykt        | Dowód                                                       |
| --------------------------------------------------------- | -------------- | ----------------------------------------------------------- |
| Populacja osób/role z projektów                           | JEST_CZĘŚCIOWO | runtime-v1 allocations; osoba bez taska pozostaje widoczna  |
| Heatmapa osoba×tydzień                                    | JEST_CZĘŚCIOWO | tydzień i zakres load z allocation; brak load → UNKNOWN     |
| Widok Osoby                                               | JEST           | StandardTable z availability/demand/saturation/confidence   |
| Widok Projekt                                             | JEST_CZĘŚCIOWO | projekty z Execution cases; role/skills brakujące → UNKNOWN |
| Rejestry konfliktów/braków                                | JEST           | jawne NOT_VERIFIED/UNKNOWN + sourceVersion                  |
| Dostępność po absencjach/obowiązkach/rezerwacjach/buforze | BRAK_API       | E-O5; nie wyliczono 0 ani bezpiecznej saturacji             |
| Progi saturacji i bufor                                   | STOP E-O5      | nie zaszyto wartości domyślnych                             |
| Niezmienna publikacja                                     | JEST_CZĘŚCIOWO | wspólny runtime-v1 SSOT z DEC-63; raport jest read-only     |

## E.3 — tabela werdyktów

| Element                                   | Werdykt             | Dowód                                                       |
| ----------------------------------------- | ------------------- | ----------------------------------------------------------- |
| Sygnały i interwencje                     | JEST                | realne `listManagementSignals/listInterventions` runtime-v1 |
| KPI rekoncyliowalne                       | JEST_CZĘŚCIOWO      | 4 KPI z num/denom względem jednego rejestru                 |
| Zunifikowany rejestr                      | JEST                | StandardTable, sourceVersion, jawne stany                   |
| Rodowód signal→decision→work→verification | JEST_CZĘŚCIOWO      | identyfikatory źródłowe; brakujące relacje = UNKNOWN        |
| Zamknięcie bez dowodu                     | JEST                | wymuszona prezentacja `NOT_VERIFIED`                        |
| Forward scenarios                         | BRAK_API            | base/optimistic/pessimistic jawnie UNKNOWN                  |
| Severity/reaction SLA                     | STOP decyzji Piotra | nie zaszyto taksonomii ani wartości                         |
| FACT/INFERENCE/RECOMMENDATION             | JEST                | semantyczne etykiety; rekomendacja wstrzymana bez dowodów   |

## E.4 — tabela werdyktów

| Element                                  | Werdykt           | Dowód                                                                       |
| ---------------------------------------- | ----------------- | --------------------------------------------------------------------------- |
| Czystość listy Raporty                   | JEST / NIETKNIĘTA | `ExecutionReportsSurface` bez diffu; strażnik 5/5 PASS                      |
| Wejście „Zrób raport”                    | JEST              | kontekstowa karta Menu 3 wyłącznie przy fladze ON                           |
| Exact published definition               | JEST              | generator dopuszcza tylko wersję `PUBLISHED` odczytaną z runtime-v1         |
| History/as-of/reporting week/forecast    | JEST_CZĘŚCIOWO    | osobne kontrolki; runtime-v1 utrwala period/asOf, pozostałe jawnie BRAK_API |
| Utworzenie szkicu                        | JEST              | realne `createReportRun`, owner/approver z definicji, autoryzowany scope    |
| Wiele raportów                           | JEST              | niezależnie otwierane pozycje z licznikiem kart                             |
| Publikacja niezmienna                    | JEST              | opublikowany run pokazuje contentHash; brak kontroli mutacji snapshotu      |
| Lifecycle kontraktowy                    | BRAK_API          | runtime-v1 zachowuje własny DRAFT→VALIDATED→FROZEN→APPROVED→PUBLISHED       |
| Eksport                                  | JEST_CZĘŚCIOWO    | management-reports: PDF/PPTX; runtime-v1 JSON; XLSX BRAK_API                |
| Resumable section failure / refresh diff | BRAK_API          | brak pól i endpointu w dozwolonym backendzie                                |

## Pozycje otwarte — STOP-y do zatwierdzenia

### STOP — E-O1 kanoniczny backend generatora

**ROZSTRZYGNIĘTY — DEC-2026-08-25-63:** runtime-v1 `report-runs` jest SSOT
niezmiennej publikacji; management-reports jest pipeline'em eksportowym.

Powód: runtime-v1 daje frozen snapshot/hash i publikację JSON, a
`/api/management-reports` daje generate/versioning/PDF/PPTX; kontraktowy cykl
życia nie pasuje dokładnie do żadnego.  
Dowód: `reportRun.ts:29-42,183-243`; `managementReports.routes.ts:36-453`.  
Co zrobiłbym, gdyby zapadła decyzja: rekomenduję runtime-v1 jako SSOT
niezmiennej publikacji oraz management-reports jako kontrolowany pipeline
eksportowy, ale implementacja wymaga wiążącego mapowania lifecycle.  
Stan: **ZREALIZOWANO w dozwolonym zakresie**; brakujące mapowanie lifecycle/export pozostaje `BRAK_API`.

### STOP — E-O2 zgoda i granulacja flagi

**ROZSTRZYGNIĘTY — DEC-2026-08-25-63:** imienna zgoda na dokładnie jedną
umbrella flagę `execReportsIntelligence`, default OFF wszędzie, w tym demo.

Powód: instrukcja wymaga imiennej zgody nadzorcy; przekazane polecenie nakazuje
zacząć od E.0, ale nie zawiera sformułowania udzielającego zgody na flagę.  
Dowód: instrukcja §krytyczne ograniczenie pkt 1, §1.7 E-O2 i §E.0 pkt 1.  
Co zrobiłbym po zgodzie: dodałbym dokładnie jedną umbrella flagę
`execReportsIntelligence`, kopiując fail-closed special-case `changeSignals`,
a następnie behawioralny test OFF z zerem wywołań nowych endpointów.  
Stan: **ZREALIZOWANO** w `481108c8ce`, wraz z rzeczywistym czytnikiem i dowodem OFF.

### STOP — E-O3 mapowania BSC

Powód: nie znaleziono wiarygodnego kontraktu mapowań initiative/milestone →
objective/BSC. Dowód: zweryfikowane routes analytics/control/reportRun oraz
`MODULE_ACCEPTANCE.md:137`. Po decyzji raport musi jawnie pozostać
„operacyjnym backlogiem”, dopóki mapowania nie będą obronione. Stan:
**NIE ZACOMMITOWANO**.

### STOP — E-O4 progi/wagi Work

Powód: kontrakt nie podaje wag wpływu, krytyczności zależności, progu at-risk
ani SLA decyzji. Nie zaszyto propozycji. Stan: **NIE ZACOMMITOWANO**.

### STOP — E-O5 źródło dostępności + progi saturacji

Powód: API oblicza demand/capacity, ale nie dowodzi pełnego źródła absencji,
obowiązków, rezerwacji, bufora, ról i umiejętności. Brak danych musi pozostać
`UNKNOWN`. Stan: **NIE ZACOMMITOWANO**.

### STOP — E-O6 replay historycznej daty as-of

Powód: snapshot przechowuje `asOf`, ale nie znaleziono endpointu rekonstruującego
historyczne źródła na tę datę. Zmiana serwera jest zabroniona Z16. Stan:
**NIE ZACOMMITOWANO**.

### STOP — E-O7 eksport PDF/XLSX + Analiza AI

Powód: management-reports ma PDF/PPTX, runtime-v1 eksportuje JSON; nie
potwierdzono XLSX. Analytics ma endpointy, ale brak kontraktowej powierzchni
FACT/INFERENCE/RECOMMENDATION. Silnika AI nie wolno budować (Z14). Stan:
**NIE ZACOMMITOWANO**.

## Znaleziska — nie naprawiane

| #   | Plik:linia                        | Co znalazłem                                                       | Dlaczego nie naprawiłem                             |
| --- | --------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------- |
| 1   | `executionControl.routes.ts:1011` | Komentarz dokumentuje shape mismatch opróżniający capacity alerts. | Serwer jest read-only (Z16).                        |
| 2   | `dev-render/main.tsx:784`         | Vite ostrzega o duplikacie klucza `document-studio-blocks-i18n`.   | Poza czterema raportami i poza ramką WOLNO.         |
| 3   | Docker host                       | 14 zastanych dangling volumes.                                     | Nie uruchamiałem PG i nie usuwałem cudzych zasobów. |

## Korekty wobec instrukcji

- Jawne polecenie nadzorcy wskazało bazę `codex/day11-instrukcja-20260825`
  (`45f6f08d24`), a nie nominalny tip `codex/m03-admin-20260824`. Marker jest
  przodkiem wskazanej bazy.
- `executionFeatureFlags.ts` ma 123, nie 124 linie; pozycje `changeSignals`
  zgadzają się (`:56/:105/:115`).
- Aktualny skrypt kanonu raportuje baseline 404 na 174 plikach, nie historyczne
  143; dług nie wzrósł.

## Testy

### Testy własne

`npx vitest run src/components/Execution/reports-intelligence/__tests__`:
**5 plików, 25/25 PASS**. Obejmuje flagę OFF/ON/error, zero requestów przy OFF,
daty i okresy, KPI↔drill-down, dane bez terminu, osobę bez taska, partial failure,
`UNKNOWN/BRAK_API`, `NOT_VERIFIED`, niezmienny published snapshot oraz regułę
semantyczną `0 ≠ RED/AMBER`.

### Testy istniejące

| Test                                        | Zmieniony | Wynik    |
| ------------------------------------------- | --------- | -------- |
| `executionReportsSurface.test.tsx`          | NIE       | 5/5 PASS |
| `executionReportPdfExport.test.ts`          | NIE       | 4/4 PASS |
| `ExecutionHub.reportingMenu.smoke.test.tsx` | NIE       | 2/2 PASS |

### Zasięg

**ZASIĘG PEŁNY DLA DOZWOLONEGO FRONTENDU; KONSUMENCI Z ZASTANYMI AWARIAMI.**
Własne testy 25/25, trzy strażniki 11/11 oraz komponenty Execution 18/18 i
dwa panele 10/10 przeszły. Pełne katalogi konsumentów ujawniły niezwiązane
awarie: `tests/unit/initiatives-execution` — oczekiwano jednego wywołania
`['execution-case-1']`, otrzymano dodatkowo zastane `initiative-card-ui`;
`tests/unit/execution` — 242 PASS / 4 FAIL w
`benefitsRegisterService.test.ts` z literalnym `Unhandled dbRun SQL: INSERT
INTO initiative_benefits (...)`. Nie zmieniano tych obszarów. Testów RealPG nie
uruchomiono: implementacja nie zmienia serwera ani bazy i nie stawiano PG.

## Dowody zakresu i higieny

- Nie zmieniono globalnej infrastruktury testowej.
- Nie zmieniono `server/**`.
- Dodano dokładnie jedną zatwierdzoną flagę `execReportsIntelligence`; czytnik
  produkcyjny występuje w Hubie, a default jest fail-closed także dla demo.
- Nie zmieniono `ExecutionReportsSurface.tsx` ani rejestrów pięciu powierzchni.
- Nie zmieniono baseline kanonu.
- Nie uruchamiano kontenera PG; listing kontenerów dnia 11 był pusty.
- Listing dangling volumes nie był pusty (14 zastanych identyfikatorów); nie
  usunięto ich, ponieważ nie należą do tego dyżuru.
- `df -h /`: `/dev/disk3s1s1`, 1.8 TiB, 12 GiB użyte, 13 GiB dostępne, 47%.
- Addytywne wpisy `dev-render/main.tsx` i ekran fixture są wyłącznie
  dozwolonym przez §2.11 harness-em dowodowym; nie są ścieżką produkcyjną.

## Zrzuty

| #   | Ekran                           | Motyw/stan | Ścieżka                                                | Wynik harnessu |
| --- | ------------------------------- | ---------- | ------------------------------------------------------ | -------------- |
| 01  | Work Intelligence               | light      | `evidence/execution-day11/01-work-light.png`           | OK             |
| 02  | Work Intelligence               | dark       | `evidence/execution-day11/02-work-dark.png`            | OK             |
| 03  | Work Intelligence               | empty      | `evidence/execution-day11/03-work-empty.png`           | OK             |
| 04  | Work Intelligence               | error      | `evidence/execution-day11/04-work-error.png`           | OK             |
| 05  | Resources Capacity              | light      | `evidence/execution-day11/05-resources.png`            | OK             |
| 06  | Management Control Loop         | light      | `evidence/execution-day11/06-control.png`              | OK             |
| 07  | Unified generator               | light      | `evidence/execution-day11/07-generator.png`            | OK             |
| 08  | zastany rejestr przy fladze OFF | light      | `evidence/execution-day11/08-reports-registry-off.png` | OK             |

Inspekcja wizualna wykryła i usunęła semantyczny błąd zerowych KPI oznaczonych
RED/AMBER; zrzuty `01`–`03` wygenerowano ponownie po korekcie. Wszystkie osiem
przebiegów zakończyło się `OK`, bez wpisów `KONSOLA-BLEDY` i `SIEC-4XX5XX`.

## Gotowość

Gotowe do zrzutu przez nadzorcę: **TAK — E.1, E.2, E.3 i E.4 w zakresie
zaimplementowanym; flaga pozostaje domyślnie OFF.**
E-O1 i E-O2: **ROZSTRZYGNIĘTE w DEC-2026-08-25-63**.
Status E.0: **ZROBIONE_WG_DoD** — mapa delty, jedna flaga fail-closed, realny
czytnik runtime-v1, behawioralny OFF/ON/error i zero requestów przy OFF.
