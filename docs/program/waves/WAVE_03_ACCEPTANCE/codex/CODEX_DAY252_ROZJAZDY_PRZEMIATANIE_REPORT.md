# CODEX DAY 252 — ROZJAZDY: PRZEMIATANIE

## Streszczenie

Dyżur wykonano statycznie, bez modelu językowego, runtime'u i bez połączeń
zewnętrznych. Marker `df7f13056f` jest przodkiem gałęzi bazowej; praca ruszyła
dokładnie z markera. Wszystkie porty `6244`, `5224`, `5225` były wolne, a po
utworzeniu worktree wolne miejsce wynosiło 9,6 GiB. Wynik R1: **0 nowych
ZMIERZONYCH, 21 SZUM, 0 nierozstrzygniętych**. Nie zmieniono produktu.

Sanity, dosłownie:

```text
MARKER OK
df7f13056fa24995be07f64b0e8c877b3faeab45
```

Tip gałęzi bazowej uciekł przed marker; listę commitów i plików zmierzono
komendami z §0.1. Scalenie pozostawiono nadzorcy.

## R1 — 21 kandydatów

Werdykt SZUM oznacza tu dowiedziony brak spotkania stron: wystąpienia należą
do innych modułów/warstw albo są nazwą lokalnej zmiennej, metody, stałej stylu
czy obiektu wewnętrznego. `rg` wykonano bez `server/src/_backup` i testów.

| Kandydat | Werdykt | Dowód rozdzielenia stron |
|---|---|---|
| `validationEvidence` / `evidenceValidation` | SZUM | front: `src/toolPacks/readiness/types.ts:36`, manifest lokalnego kryterium `manifests.ts:498`; serwer: wewnętrzny kontekst generacji `InterviewInsightService.ts:1501,1515` i renderer paczki `interviewInsightReportPackService.ts:729`. Brak wspólnej trasy/komponentu. |
| `completedRuns` / `runsCompleted` | SZUM | frontowy kontrakt Playbook analytics: `src/types/core.ts:5006`, konsument `PlaybookTemplateAnalytics.tsx:94`; serwer rzeczywiście zwraca `completedRuns` w `aiPlaybookService.ts:1266-1280`. `runsCompleted` to prywatny licznik jobów `aiWatchdog.ts:79,149` i `aiLearningJob.ts:36,147`, nie pole tej odpowiedzi. |
| `changePercent` / `percentChange` | SZUM | `changePercent` jest lokalnym propem/obliczeniem UI (`TrendIndicator.tsx:17,191`, `VelocityTrend.tsx:141`); `percentChange` jest wynikiem niezależnego serwisu stress-test (`scenarioStressTestService.ts:41,145,151`). |
| `dataExport` / `exportData` | SZUM | `dataExport` jest nazwą permission/route (`src/types/domain/user.ts:381`, `Gateway.ts:121,1014`); `exportData` to lokalna zmienna wielu handlerów, m.in. `dataExport.routes.ts:232,238`. Nie są dwoma polami jednego JSON. |
| `textNeutral` / `neutralText` | SZUM | `textNeutral` to klasa Tailwind w `assessmentColors.ts:58`; `neutralText` to kolor palety dokumentów `themeRegistry.ts:30,55`. |
| `pageTitle` / `titlePage` | SZUM | `pageTitle` to prop notatnika/feedbacku (`NotebookGraphView.tsx:64,206`, `FeedbackSidePanel.tsx:78,121`); `titlePage` to opcja generatora DOCX (`documentDocxStyles.ts:121`, `documentDocxRenderer.ts:2020`). |
| `projectMemberIds` / `memberProjectIds` | SZUM | `projectMemberIds` to lokalna allow-lista UI decyzji `DecisionDetailView.tsx:3482-3503`; `memberProjectIds` jest serwerowym kontekstem kontroli sejfu `KnowledgeService.ts:794,812`, nie odpowiedzią dla tego komponentu. |
| `resultsSearch` / `searchResults` | SZUM | `searchResults` to lokalna wartość hooków Knowledge (`KnowledgeBaseHomePage.tsx:126-177`); `resultsSearch` występuje w niezależnym mechanizmie Results VNext. Brak wspólnego DTO i odczytu pola. |
| `statusDistribution` / `distributionStatus` | SZUM | wystąpienia należą do niezależnych agregacji/zmiennych lokalnych; pełny grep nie wykazał klienta czytającego serwerowe pole o przeciwnej nazwie. |
| `dataRecord` / `recordData` | SZUM | obie nazwy są lokalnymi określeniami rekordów w różnych przepływach; brak endpointu zwracającego jedną nazwę komponentowi czytającemu drugą. |
| `criticalMissing` / `missingCritical` | SZUM | frontowy wynik kompletności `useCompleteness.ts:71,98-107`; `missingCritical` to lokalna tablica walidacji finansowej rzucana w błędzie `financialModelingService.ts:379-382,504-509`. |
| `targetFill` / `fillTarget` | SZUM | `targetFill` jest tokenem wykresu assessment (`assessmentChartTokens.ts:61,84`); `fillTarget` jest kolorem raportu DOCX/DRD (`documentDocxStyles.ts:107`, `assessmentDrdReportSchemaService.ts:257`). |
| `stateContent` / `contentState` | SZUM | `stateContent` to lokalny ReactNode tabeli `StandardTable.tsx:528,580`; `contentState` jest serwerowym stanem rejestru artefaktów `artifactRegistry.ts:180`, `artifactRegistryService.ts:2719`. |
| `planVerification` / `verificationPlan` | SZUM | `planVerification` jest nazwą RPC po obu stronach (`workspaceApi.ts:715`, `actions.routes.ts:25,76`); `verificationPlan` jest wynikiem innego output service i renderera (`outputService.ts:223,277`, `reportRenderer.ts:164`). |
| `rawSeverity` / `severityRaw` | SZUM | werdykt przepisany z `AUDYT_ROZJAZDY_NAZW_POL.md:329`: `rawSeverity` jest lokalnym rename `x.severity` w `ExecutionControlSurface.tsx:311,346`; `severityRaw` to osobny Signals DTO `signalReadModel.ts:137`. |
| `coverageRatio` / `ratioCoverage` | SZUM | `coverageRatio` to lokalna metryka wielu serwisów/hooków (`kpiAttributionService.ts:173`, `pickWeakestRung.ts:35`); `ratioCoverage` to pole odpowiedzi Finance `finance.routes.ts:4286`, którego UI używa jako etykiety tłumaczenia, nie jako `coverageRatio`. |
| `modulesCompleted` / `completedModules` | SZUM | `modulesCompleted` jest tablicą w typie Partner `src/views/partner/types.ts:249`; API kursów i UI konsekwentnie używają `completedModules` (`partners.routes.ts:1620,1667`, `PartnerPortalView.tsx:1505,1842`). |
| `readyBlocks` / `blocksReady` | SZUM | `readyBlocks` to licznik V10 runtime `V10RuntimeWorkspaceView.tsx:16,71`; `blocksReady` to boolean finansowego reconcile `reconciliationService.ts:103,787-800`. |
| `codeRaw` / `rawCode` | SZUM | `codeRaw` jest lokalnym wynikiem parsowania błędu w API (`src/services/api.ts:2711-2714`); `rawCode` jest lokalną zmienną sanitizacji błędu Document Studio (`document-studio.routes.ts:5459-5461`). |
| `mapStatement` / `statementMap` | SZUM | `mapStatement` jest nazwą metody API Finance (`src/services/api/v8/finance.ts:1015`); `statementMap` to lokalna mapa danych w niezależnym `postInvestmentReviewService.ts:306-311`. |
| `rawMetadata` / `metadataRaw` | SZUM | `rawMetadata` to parametr lokalnego normalizatora store (`useConversationStore.ts:2127-2137`); `metadataRaw` to jawne pole diagnostyczne SuperAdmin (`SuperAdminController.ts:1479-1488`) oraz lokalna zmienna parsera My Work (`my-work.routes.ts:2319-2321`). |

## R2 — trzecia klasa

Nie ogłaszam fałszywego pełnego porównania. Statyczny przegląd wskazał trzy
kandydackie powierzchnie A/B: `Audyty — Sesje`/Results, `Financial Statement
Workspace`/Finance oraz `Karta decyzji`/Moja praca. Pierwsza jest jednak
wyłączona przez zakres (Audyty), a dwie pozostałe mają rozgałęzione odpowiedzi
z kilku endpointów i nie dały się uczciwie sprowadzić do jednego kompletnego
`res.json` w czasie tego przebiegu. Nie zaklasyfikowano żadnego pola-sieroty.
To jest **NOT_PROVEN**, a nie dowód czystości. Do dokończenia potrzebny jest
osobny przebieg, który zinwentaryzuje każdy endpoint każdej powierzchni, a nie
próbkę pól. Nie uruchomiono runtime'u ani bazy, ponieważ nie były potrzebne do
statycznego R1 i nie powstało twierdzenie o działaniu.

## Zasięg testów (§0.4a)

Nie uruchomiono żadnego pakietu testowego i nie zmieniono produktu, zatem nie
ogłaszam wyniku testów ani liczby PASS. `przed-nazwy.txt`/`po-nazwy.txt` nie
powstały; nie ma porównania nazw do przedstawienia. Dowód R1 jest statycznym
rozstrzygnięciem braku wspólnego kontraktu, nie dowodem egzekucji HTTP.

Pułapki §0.2d (a)-(d) nie dotyczą statycznego `rg`; pułapka (e) jest osią
pomiaru i została obsłużona przez wymaganie dowodu rozdzielenia stron.

## Liczby programu

Nie przepisuję `25 + 21 = 46` jako pomiar własny. Ten dyżur prześledził 21
imiennych par, wszystkie jako SZUM. Liczba unikalnych kandydatów całego programu
pozostaje **NIEZWERYFIKOWANA**, ponieważ dwa dokumenty mają nakładające się
zbiory, a instrukcja sama używa wartości przybliżonych (`~90`, `~157`).

## TWIERDZENIA NIEZWERYFIKOWANE

- Pełny kształt odpowiedzi i konsumpcji dla trzech ekranów R2: NOT_PROVEN.
- Globalna liczba unikalnych kandydatów i liczba pozostająca: NOT_PROVEN.
- Działanie realnych tras HTTP: nie badano i nie twierdzono, że działa.

## Korekty wobec instrukcji

- T1, T2, T3, T4, T5, T6 i T7 potwierdzono. T3: `naprawa 251 OBECNA`.
- Polecenie wyboru ekranu „Execution/Results” nie może być spełnione przez
  `Audyty — Sesje`, mimo że dokument źródłowy wiąże właśnie tę powierzchnię z
  Results; Audyty są jawnie wykluczone z R2. Wybrano bezpieczniejszą
  interpretację i nie sfabrykowano pełnego porównania.
- Nie zastosowano domyślnych liczb autora jako własnego pomiaru (`Z24`).

## Bezpieczeństwo i zakres

Nie dotknięto checkoutu właściciela poza symlinkiem `node_modules`; nie
uruchomiono Railway, LLM, poczty, runtime'u, migracji ani bazy. Zapis ogranicza
się do dwóch licencjonowanych dokumentów. Push wyłącznie `github-backup`.
