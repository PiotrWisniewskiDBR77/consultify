# Rejestr ResultsHub — co żywe, co martwe (pomiar 2026-09-02)

**Gałąź pomiaru:** `agent/resultshub-inwentarz-20260902` · **marker bazowy:** `6fe16e2bd4`
**Charakter dokumentu:** POMIAR. Nie usunięto ani jednej linii kodu. Decyzję o cięciu podejmuje właściciel.

---

## K1 — Teza o nieosiągalności: POTWIERDZONA

Teza brzmiała: `src/components/Results/ResultsHub.tsx` jest nieosiągalny z żadnej trasy od
commita `8df1cd413d` (2026-08-24). Zweryfikowano cztery niezależne dowody.

### D1. Commit istnieje i ma podaną datę
```
8df1cd413da8edd56f0e2deec8b3c3a5395372df  2026-08-24 05:19:02 +0200
fix(results): retire legacy root fallback
```
Data i treść zgadzają się z tezą.

### D2. Trasa `/results` przekierowuje BEZWARUNKOWO
`src/components/Results/ResultsOwnerReviewEntry.tsx` w całości (13 linii) sprowadza się do:
```tsx
export function ResultsOwnerReviewEntry() {
  return <Navigate to={ROUTES.RESULTS_KPI.ROOT} replace />;
}
```
Zero warunków, zero flag, zero odczytu `localStorage` czy query-param — mimo nazwy
sugerującej „owner review switch". Cel: `/results/kpi` → `AppRoutes.tsx:2968`
montuje `<ResultsKpiRegistryPage />` z `@/components/ResultsVNext/`.

### D3. Zero wołaczy JSX w kodzie produkcyjnym
`grep -rn "<ResultsHub" src/` zwraca **wyłącznie 5 trafień w pliku testowym**
`src/components/Results/__tests__/ResultsHub.smoke.test.tsx`. Ani jednego w `src/routes/`,
ani jednego w żadnym komponencie.

Jedyny nie-testowy odnośnik to reeksport w barrelu
`src/components/Results/index.ts:2` — a tego barrelu **nikt nie importuje**
(`grep` po `from '@/components/Results'` = zero trafień). Barrel jest ślepy.

### D4. Istnieje bezpiecznik CI, który MONTOWANIE ResultsHub uznaje za defekt
`scripts/dev/__tests__/verifyCanonical16Bindings.test.mjs` ma test o nazwie
*„rejects ResultsHub inside the canonical Results route block"* — czyli produkt ma już
mechaniczną bramkę pilnującą, żeby ResultsHub **nie wrócił** na trasę kanoniczną.
Dodatkowo `tests/resultsVnext/flagGateEnumeration.test.ts:95` asertuje
`expect(routes).not.toContain('<ResultsHub')`.

**Wniosek K1:** teza prawdziwa i mocniejsza, niż ją sformułowano. To nie jest przeoczenie —
to świadome, zabezpieczone testami wygaszenie. Rejestr można budować dalej.

### Sprostowanie do treści zlecenia
Zlecenie wymieniało `RecoveryCardPanel` (83 KB) wśród komponentów montowanych przez
`ResultsHub`. **To nieprawda.** `ResultsHub.tsx` nie importuje `RecoveryCardPanel`.
Jedynym jego wołaczem jest `KPITimeSeriesDrawer.tsx:35` (render w linii 1534).
RecoveryCardPanel jest więc **wnukiem**, nie dzieckiem — co ma znaczenie dla cięcia:
zniknie razem z KPITimeSeriesDrawer albo wcale.

### Zweryfikowane liczby z nagłówka zlecenia
| Twierdzenie zlecenia | Pomiar | Werdykt |
|---|---|---|
| `ResultsHub` montuje kilka tysięcy linii | 2228 linii samego huba (84 233 B) + drzewo dzieci | zaniżone, patrz K3 |
| `KPITimeSeriesDrawer` 104 KB | 104 463 B | zgadza się |
| `RecoveryCardPanel` 83 KB | 82 750 B | rozmiar zgadza się, ale to nie dziecko ResultsHub |
| commit `8df1cd413d` z 2026-08-24 | 2026-08-24 05:19:02 | zgadza się |

---

## K2 — Inwentarz. Stan każdego pliku

### Metoda i jej ograniczenie
Pomiar mechaniczny (`find` + dopasowanie wzorców importu) po `src/`, `tests/`, `server/src/`,
`server/scripts/`, `scripts/`, `dev-render/`, `e2e/`. Każdy wynik „ma innego wołacza"
zweryfikowany **drugą metodą** (bezpośredni `grep` po ścieżce), bo to kolumna, która decyduje
o życiu i śmierci. Dwa fałszywe alarmy własnego wzorca wykryte i odrzucone (patrz „Zaskoczenia").

Kolumna **render?** = czy hub faktycznie ma `<Komponent` w JSX, nie tylko import
(kształt „wołacz istnieje ≠ renderuje się"). **Wszystkie 26 bezpośrednich dzieci mają realny
render w `ResultsHub.tsx`** — na tej warstwie nie ma martwych importów. Martwa jest warstwa
wyżej: sam hub nigdy nie trafia na ekran.

### Legenda stanów
- **ŻYWY** — ma wołacza spoza poddrzewa `ResultsHub`
- **MARTWY** — jedyna droga wiedzie przez `ResultsHub` (lub przez jego dziecko)
- **ZASTĄPIONY** — martwy, ale funkcja żyje w `ResultsVNext/` pod inną nazwą
- **SIEROTA** — zero wołaczy produkcyjnych, nawet z `ResultsHub`

### A. ŻYWE — 2 pliki, 62 linie. To wszystko, co w tym katalogu naprawdę pracuje.

| Plik | L | Wołacz | Dowód |
|---|---:|---|---|
| `ResultsOwnerReviewEntry.tsx` | 14 | `src/routes/AppRoutes.tsx:21` | trasa `/results`, redirect |
| `resultsOwnerReviewMode.ts` | 48 | `src/components/ResultsVNext/resultsVNextFeatureFlags.ts:29` | bramka ŻYWEGO VNext |

### B. MARTWE — bezpośrednie dzieci ResultsHub (26 pozycji)

| Komponent | L | KB | render? | Flaga (miejsce odczytu) | Testy | Odpowiednik w ResultsVNext |
|---|---:|---:|:-:|---|:-:|---|
| `KPITimeSeriesDrawer` | 2233 | 104,5 | tak | — (sam czyta 2 flagi) | 4 | `kpiMeasurements/ResultsKpiMeasurementsPanel.tsx` + `kpiTool/KpiDeviationCaseSubview.tsx` |
| `ResultsReportingEnterpriseViews` | 1388 | 49,0 | tak (3 widoki) | — | 0 | **BRAK** (zero wallboard/schedule/connector w VNext) |
| `ResultsKpiReportsView` | 1248 | 52,1 | tak | — | 3 | **BRAK** |
| `StrategicLayerPanel` | 1187 | 48,6 | tak | `strategicLayer` — `ResultsHub.tsx:471,2007` | 1 | `okr/OkrAlignmentsView.tsx` (NIEPEWNE, częściowe) |
| `ROIAnalysisView` | 836 | 34,5 | tak | — | 2 | `roi/RoiCaseToolPage.tsx`, `roi/RoiCaseFullTool.tsx` |
| `ResultsKPITable` (`ResultsGridView`) | 781 | 29,8 | tak | — | 1 | `ResultsKpiRegistryPage.tsx` (to jest cel redirectu) |
| `KpiQueueView` | 763 | 30,6 | tak | — | 0 | `attention/ResultsAttentionPage.tsx` (NIEPEWNE) |
| `ResultsInitiativesView` | 700 | 29,5 | tak (×2) | — | 0 | **BRAK** (inicjatywy = własny moduł `InitiativesHub`) |
| `ROITrackingView` | 640 | 25,3 | tak | — | 2 | `roi/ResultsRoiHub.tsx` |
| `PortfolioInsightsPanel` | 551 | 22,0 | tak | `portfolioInsights` — `ResultsHub.tsx:2030` | 1 | `attention/ResultsAttentionPage.tsx` (NIEPEWNE) |
| `ROIDetailDrawer` | 530 | 24,0 | tak | — | 5 | `roi/RoiCaseFullTool.tsx` |
| `KpiSignalSheetView` | 447 | 19,8 | tak | — | 1 | `kpiTool/KpiToolPage.tsx` (NIEPEWNE) |
| `KpiOverviewView` | 392 | 17,2 | tak | — | 0 | `kpiTool/KpiToolPage.tsx` |
| `AIInsightsPanel` | 374 | 15,1 | tak | `aiInsights` — `ResultsHub.tsx:2029` | 1 | **BRAK** |
| `ValueDriverTree` | 281 | 9,3 | tak (×2) | `valueDriverTree` — `ResultsHub.tsx:1968,2017` | 1 | **BRAK** |
| `ResultsRoiReviewsTable` | 251 | 8,6 | tak | — | 2 | `roi/ResultsRoiPirOutcomesPage.tsx` |
| `ResultsScorecardsTable` | 241 | 8,5 | tak | — | 2 | `kpiScorecards/ResultsKpiScorecardDetailPage.tsx` |
| `TransformationScorecard` | 231 | 7,7 | tak | `transformationScorecard` — `ResultsHub.tsx:1956,1958` | 0 | **BRAK** |
| `ResultsOkrSetsTable` | 218 | 6,9 | tak | — | 2 | `okr/ResultsOkrHub.tsx`, `okr/OkrSetToolPage.tsx` |
| `M14HandoffInbox` | 197 | 7,8 | tak (×2) | `m14Handoff` — `ResultsHub.tsx:1956,1963` | 1 | `teresa/TeresaProposalPanel.tsx` (NIEPEWNE) |
| `ROIOpenModal` | 191 | 7,6 | tak | — | 1 | `roi/RoiCaseCreateModal.tsx` |
| `ResultsKpiScorecardsView` | 35 | 1,4 | tak | `kpiRegistry` (VNext) — `ResultsHub.tsx:1190` | 1 | `kpiScorecards/…` |
| `resultsShowcaseData.ts` | 540 | 15,5 | n/d | — | 0 | dane demo, bez odpowiednika |
| `kpiDomain.ts` | 281 | 10,1 | n/d | — | 1 | `kpiTool/kpiToolMappers.ts` |
| `kpiRuntime.ts` | 161 | 5,8 | n/d | — | 4 | `kpiApi.ts` |
| `resultsFeatureFlags.ts` | 136 | 5,5 | n/d | **definicja 8 flag** | 0 | `resultsVNextFeatureFlags.ts` |
| `kpiSignalSheetTypes.ts` | 34 | 0,9 | n/d | — | 0 | — |

### C. MARTWE — wnuki (osiągalne tylko przez dziecko z tabeli B)

| Komponent | L | KB | Wołacz | Flaga | Testy | Odpowiednik |
|---|---:|---:|---|---|:-:|---|
| `RecoveryCardPanel` | 2102 | 82,8 | `KPITimeSeriesDrawer.tsx:35` (render :1534) | `recoveryCard` — `KPITimeSeriesDrawer.tsx:1099,1531` | 1 | `kpiTool/KpiDeviationCaseSubview.tsx` |
| `PostInvestmentActualForm` | 562 | 20,5 | `ROIDetailDrawer.tsx` | — | 1 | `roi/RoiPirOutcomesTab.tsx` |
| `ReconciliationPanel` | 503 | 18,6 | `ROITrackingView.tsx` | — | 1 | `roi/RoiCaseRealizeValueWorkspace.tsx` (NIEPEWNE) |
| `ResultsUIPrimitives` | 465 | 15,4 | Portfolio/Strategic/AIInsights | — | 0 | — |
| `OkrKeyResultModal` | 266 | 10,2 | `StrategicLayerPanel.tsx` | — | 0 | `okr/OkrKeyResultFormModal.tsx` |
| `PostInvestmentReviewPanel` | 213 | 7,9 | `ROIDetailDrawer.tsx` | — | 1 | `roi/RoiPirOutcomesTab.tsx` |
| `OkrObjectiveModal` | 190 | 7,6 | `StrategicLayerPanel.tsx` | — | 0 | `okr/OkrObjectiveFormModal.tsx` |
| `OkrCheckInModal` | 176 | 7,4 | `StrategicLayerPanel.tsx` | — | 0 | `okr/OkrCheckInRecordDialog.tsx` |
| `ROIAssumptionEditor` | 175 | 6,6 | `ROIDetailDrawer.tsx` | — | 0 | `roi/RoiAssumptionFormModal.tsx` |
| `resultsLineage.ts` | 69 | 2,2 | `KPITimeSeriesDrawer.tsx` | — | 1 | — |

### D. SIEROTY — zero wołaczy produkcyjnych, nawet z ResultsHub

| Plik | L | Uwaga |
|---|---:|---|
| `index.ts` | 8 | barrel reeksportujący 7 nazw; **nikt go nie importuje** (zweryfikowane dwiema metodami) |
| `ResultsSummaryView.tsx` | 26 | stub, komentarz: „functionality has been merged into ResultsHub" |
| `OperationalAnalysisView.tsx` | 10 | stub, ten sam komentarz |

### E. Poza katalogiem Results — martwe przez ResultsHub

| Plik | L | KB | Uwaga |
|---|---:|---:|---|
| `src/components/Execution/CorrectiveActions.tsx` | 548 | 21,9 | **Jedyny wołacz produkcyjny to `ResultsHub.tsx:20` (render :2136).** `ExecutionHub` go nie używa mimo katalogu. Ma własny test (`tests/components/Execution/CorrectiveActions.states.test.tsx`). VNext ma swoją obsługę działań korygujących w `kpiTool/kpiDeviationApi.ts` (`listCorrectiveActionsForCase`) — ta jest ŻYWA. |

`src/components/Initiatives/InitiativeDocumentView.tsx` (lazy z huba) jest **ŻYWY** — ma
7 innych wołaczy (InitiativesHub, ExecutionHub, AssessmentHub, BenefitsHub, DiscoveryToolsHub…).
Nie tykać.

---

## K3 — Koszt

| Grupa | Plików | Linii | Bajtów | KB |
|---|---:|---:|---:|---:|
| `src/components/Results/` — MARTWE (wszystko poza dwoma żywymi) | 41 | **21 861** | 862 066 | **841,9** |
| `src/components/Execution/CorrectiveActions.tsx` | 1 | 548 | 21 888 | 21,4 |
| **RAZEM MARTWE** | **42** | **22 409** | **883 954** | **863,2** |
| ŻYWE w `Results/` (zostają) | 2 | 62 | 2 099 | 2,1 |

Sam `ResultsHub.tsx` to 2229 linii / 84,2 KB — czyli **10 % kosztu**. Pozostałe 90 % to drzewo
pod nim; największe pojedyncze pozycje to `KPITimeSeriesDrawer` (104,5 KB) i `RecoveryCardPanel`
(82,8 KB), razem 187 KB, czyli **22 % całości**.

**Koszt towarzyszący:** 39 plików testowych, **5 654 linie** w
`src/components/Results/__tests__/` + `tests/components/Results/`. Nie wliczam ich do liczby
powyżej — właściciel powinien je zobaczyć osobno, bo część z nich to jedyny dziś wykonywany kod
dotykający tych komponentów.

### Twarde kotwice — usunięcie pliku zepsuje te miejsca (readFileSync po ścieżce)
| Czyta | Plik czytany |
|---|---|
| `server/src/services/legacyCutover/__tests__/resultsCutover.registry.test.ts` (6 miejsc) | `ResultsHub.tsx`, `KPITimeSeriesDrawer.tsx`, `KpiSignalSheetView.tsx`, `ResultsKpiScorecardsView.tsx`, `ROIDetailDrawer.tsx` |
| `tests/components/Results/ResultsHub.r15-wiring.source-anchor.test.ts` | `ResultsHub.tsx` |
| `tests/resultsVnext/flagGateEnumeration.test.ts` | `ResultsHub.tsx`, `ResultsKpiScorecardsView.tsx` |
| `server/scripts/smoke-a03-ui-hub-compliance.ts` | `ResultsHub.tsx` |
| `server/scripts/smoke-v3-results-ai-integrations.ts` | `KPITimeSeriesDrawer.tsx` |

To nie są wołacze produktu — to strażnicy asertujący *treść* pliku (np. „hub nie woła już
`V8ResultsApi.createKpi`"). Każde cięcie **musi** iść w parze z ich zdjęciem, inaczej CI padnie
na `ENOENT`, a nie na regresji produktu.

---

## K4 — Rekomendacja w trzech grupach

### Grupa 1 — można ciąć od razu, bez ryzyka dla produktu (3 pliki, 44 linie)

| Plik | L | Dlaczego bez ryzyka |
|---|---:|---|
| `src/components/Results/index.ts` | 8 | barrel bez ani jednego importera; jego jedyna funkcja to utrzymywanie ResultsHub przy życiu w oczach czytelnika |
| `src/components/Results/ResultsSummaryView.tsx` | 26 | stub sam deklarujący, że funkcja przeniesiona; jedyny konsument to test tego stuba |
| `src/components/Results/OperationalAnalysisView.tsx` | 10 | j.w. |

Koszt operacji: zdjąć 2 pliki testowe testujące stuby. Zysk: symboliczny (44 linie), ale
**usuwa ostatni nie-testowy odnośnik do nazwy `ResultsHub` w kodzie produkcyjnym** — po tym
cięciu grep na `ResultsHub` w `src/` zwraca wyłącznie komentarze.

### Grupa 2 — wymaga decyzji właściciela (39 plików, ~22 365 linii, ~863 KB)

To cała reszta. Decyzja nie jest techniczna („czy da się usunąć" — da się), tylko produktowa:
**czy funkcje bez odpowiednika w VNext mają zniknąć razem z hubem.**

**2a. Ma dobry odpowiednik w VNext, cięcie = czysta redukcja długu** (~15 000 linii):
KPI: `ResultsKPITable`, `KpiOverviewView`, `KpiSignalSheetView`, `KpiQueueView`,
`ResultsScorecardsTable`, `ResultsKpiScorecardsView`, `KPITimeSeriesDrawer`, `RecoveryCardPanel`;
ROI: `ROIAnalysisView`, `ROITrackingView`, `ROIDetailDrawer`, `ROIOpenModal`,
`ROIAssumptionEditor`, `PostInvestmentActualForm`, `PostInvestmentReviewPanel`,
`ResultsRoiReviewsTable`, `ReconciliationPanel`;
OKR: `ResultsOkrSetsTable`, `OkrCheckInModal`, `OkrObjectiveModal`, `OkrKeyResultModal`;
oraz warstwa danych: `kpiDomain`, `kpiRuntime`, `kpiSignalSheetTypes`, `resultsLineage`,
`resultsShowcaseData`, `resultsFeatureFlags`, `ResultsUIPrimitives`.

**★ Uwaga do „aktywnego rozwoju".** Zlecenie zakładało, że diagnostyka odchyleń i karta
naprawcza są w aktywnym, osobno flagowanym rozwoju i dlatego trzeba je oszczędzić.
Pomiar mówi co innego:
- `RecoveryCardPanel` (82,8 KB) jest **nieosiągalny z produktu** — droga to
  `ResultsHub → KPITimeSeriesDrawer → RecoveryCardPanel`, a pierwszy człon nie istnieje na żadnej
  trasie. Flaga `recoveryCard` jest domyślnie OFF **na każdym hoście** (jawny early-return
  w `resultsFeatureFlags.ts`), więc nawet gdyby hub żył, panel byłby niewidoczny.
- Nowocześniejszy odpowiednik **już jest żywy i osiągalny**: trasa
  `/results/kpi/:kpiId/deviation-cases/:caseId` → `kpiTool/KpiDeviationCaseSubview.tsx` (1260 linii),
  a `kpiTool/kpiDeviationApi.ts` obsługuje pełny cykl (`recovery-observation`,
  `effectiveness-verifications`, eskalacja, zamknięcie) — to samo, co panel legacy.
- Ostatnie commity legacy (`2026-08-19`) to `cut over … commands` / `retire legacy … writers`,
  czyli **prace migracyjne**, nie rozwój funkcji. Ostatni commit funkcjonalny: `2026-08-01`.

Nie oznacza to „ciąć na pewno" — oznacza, że argument „to jest w aktywnym rozwoju" nie broni
tych plików. Jeśli mają zostać, powodem musi być coś innego niż rozwój.

**2b. NIE ma odpowiednika w VNext — cięcie kasuje funkcję** (~4 000 linii). Tu potrzebna
świadoma zgoda właściciela, bo znikną możliwości, nie tylko kod:
| Co znika | L | Uwaga |
|---|---:|---|
| `ResultsReportingEnterpriseViews` — konektory KPI, harmonogramy raportów, wallboardy | 1388 | zero śladu w VNext (sprawdzone gres|em po `wallboard`/`reportSchedule`/`kpiConnector`) |
| `ResultsKpiReportsView` — raporty KPI ze snapshotami | 1248 | serwer nadal wystawia `/api/results` snapshot create+refresh |
| `ResultsInitiativesView` — inicjatywy w kontekście wyników | 700 | inicjatywy mają własny moduł, ale nie ten przekrój |
| `AIInsightsPanel` | 374 | |
| `ValueDriverTree` | 281 | |
| `TransformationScorecard` | 231 | |
| `StrategicLayerPanel` | 1187 | `okr/OkrAlignmentsView` pokrywa tylko część |
| `PortfolioInsightsPanel` | 551 | `attention/ResultsAttentionPage` pokrywa tylko część |
| `M14HandoffInbox` | 197 | |

**2c. `src/components/Execution/CorrectiveActions.tsx` (548 L).** Leży w katalogu Execution,
ale `ExecutionHub` go nie woła — jedynym wołaczem jest `ResultsHub`. Osobna pozycja, bo łatwo
ją przeoczyć przy cięciu „katalogu Results".

**Warunek techniczny dla całej Grupy 2:** każde cięcie musi zdjąć razem odpowiednich
**strażników plikowych** z tabeli w K3 — inaczej CI wywali się na `ENOENT`, co wygląda jak
regresja produktu, a jest tylko martwym testem czytającym nieistniejący plik.

### Grupa 3 — zostaje bezwarunkowo (2 pliki, 62 linie)

| Plik | Dlaczego |
|---|---|
| `ResultsOwnerReviewEntry.tsx` | to jest trasa `/results` — usunięcie wywala moduł Wyniki |
| `resultsOwnerReviewMode.ts` | czyta go **żywy** `ResultsVNext/resultsVNextFeatureFlags.ts` |

Oraz — poza katalogiem — `src/components/Initiatives/InitiativeDocumentView.tsx`: hub go ładuje
leniwie, ale ma 7 innych wołaczy. Nie tykać.

---

## Co mnie zaskoczyło

1. **Nie ma tu „częściowo martwego" huba — cały katalog jest martwy poza dwoma plikami.**
   Spodziewałem się mieszanki. `src/components/Results/` ma 43 pliki; **41 z nich prowadzi
   wyłącznie do ResultsHub albo donikąd.** Dwa żywe zajmują 62 linie z 21 923.

2. **„Aktywny rozwój" okazał się migracją.** Teza zlecenia (nie ruszać diagnostyki odchyleń
   i karty naprawczej, bo trwa nad nimi praca) nie broni się przy pomiarze: nowa wersja żyje
   w VNext na własnej trasie, a commity z sierpnia na plikach legacy to wygaszanie writerów.
   To najważniejsza korekta w tym rejestrze.

3. **`RecoveryCardPanel` nie jest dzieckiem ResultsHub, tylko wnukiem.** Zlecenie wymieniało
   go wśród komponentów montowanych przez hub. To ma praktyczne znaczenie: nie da się go
   usunąć bez ruszania `KPITimeSeriesDrawer`.

4. **Flagi tej rodziny nie są OFF, mimo komentarza „default OFF, live-safe".**
   `isResultsFlagEnabled` kończy się `return !isPublicProductionHost(...)` — na demo, stage
   i dev **wszystkie** flagi Results (poza `recoveryCard`, który ma jawny early-return)
   czytają jako **ON**. Nagłówek pliku mówi „default false". Tu akurat nie ma skutku, bo hub
   się nie renderuje, ale wzorzec jest ten sam, który już raz kosztował sesję.

5. **Produkt ma dwa mechaniczne bezpieczniki pilnujące, żeby ResultsHub nie wrócił**
   (`verifyCanonical16Bindings`, `flagGateEnumeration`) — a mimo to plik i całe jego drzewo
   stoją w repo. Bramka broni trasy, nikt nie bronił kodu.

6. **Serwerowy rejestr writerów kłamie o tym kodzie.**
   `server/src/services/results/resultsWriterInventory.ts:81` opisuje `/api/benefits` jako
   „Legacy KPI CRUD … with **live production UI callers** (KPICreateModal, KPITimeSeriesDrawer,
   KpiSignalSheetView, ResultsHub)". Od 2026-08-24 żaden z tych czterech nie jest osiągalny
   z produktu, a `KPICreateModal` **nie istnieje w tym katalogu** — leży w
   `src/components/Benefits/`. Rejestr wymaga sprostowania niezależnie od decyzji o cięciu.

7. **Dwa artefakty po nieistniejącym pliku.** `tests/components/Results/KPICreateModal.v8-write.test.tsx`
   importuje `src/components/Results/KPICreateModal` — takiego pliku nie ma. Ten sam duch
   siedzi w `scripts/a11y-jsx.baseline.json:292` i `scripts/hardcoded-colors.baseline.json:1205`.
   Ślad po wcześniejszym, niedokończonym sprzątaniu.

8. **Mój własny przyrząd skłamał dwa razy** i oba razy w stronę „to żyje":
   wzorzec importu dla pliku o nazwie `index` łapał każde `from './index'` w repo (11 fałszywych
   wołaczy barrelu), a dopasowanie po ścieżce myliło wzmiankę w komentarzu z importem.
   Obie kolumny przeliczone drugą metodą; liczby w rejestrze są po korekcie.

---

## Czego ten rejestr NIE dowodzi

- Nie uruchamiałem aplikacji ani bazy — to pomiar statyczny na kodzie z `6fe16e2bd4`.
- Przypisania „odpowiednik w VNext" oznaczone **NIEPEWNE** to moja ocena z lektury, nie pomiar
  parytetu funkcji. Przed cięciem pozycji z Grupy 2b ktoś musi zobaczyć oba ekrany obok siebie.
- Nie sprawdzałem, czy ResultsHub bywa osiągalny na innych gałęziach niż ta.
