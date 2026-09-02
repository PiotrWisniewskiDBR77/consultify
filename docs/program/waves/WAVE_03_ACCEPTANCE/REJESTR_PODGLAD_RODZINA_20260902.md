# Rejestr rodziny "podgląd nie sięga do dołu" — 2026-09-02

Zlecenie: naprawa karty podglądu objęła pięć zakładek Realizacji (0 px luki,
zmierzone `scripts/dev/measure-preview-canon.mjs --wysokosc`). Zadanie tego
dyżuru: **PRZEMIEŚĆ RODZINĘ, NIE NAPRAWIAJ** — spisać wszystkich konsumentów
`TableWithPreviewLayout`/`PreviewPaneShell` poza Realizacją, zmierzyć co się
da kanonicznym przyrządem, zarejestrować resztę uczciwie.

Marker startowy: `6fe16e2bd4`. Branch: `agent/podglad-rodzina-20260902`.

## K1 — spis rodziny: moja liczba vs liczba właściciela

Właściciel: **"około 48 konsumentów"** (grep `TableWithPreviewLayout`).

Mój grep (`TableWithPreviewLayout` + `PreviewPaneShell` bezpośrednio, bez
testów i plików infrastruktury samego komponentu) dał **51 plików** w `src/`,
które rozkładają się na trzy bardzo różne kategorie — i to jest główne
odkrycie tego dyżuru:

| kategoria | liczba plików |
| --- | ---: |
| ŻYWI właściciele layoutu (renderują `<TableWithPreviewLayout>` lub własną powłokę `<aside><PreviewPaneShell>`) | **29** |
| Treść podglądu jadąca na layoucie RODZICA (nie własny layout — np. `AnalysisKpiDetailCard` w cudzej tabeli) | ~9 |
| **MARTWY KOD — nie renderowany NIGDZIE w aplikacji** (patrz niżej) | **13** |

Moja liczba żywych właścicieli layoutu (29) jest niższa niż "48" właściciela,
bo blisko jedna czwarta tego, co łapie grep, to pliki bez ani jednego
wołacza — zweryfikowane, nie zgadywane.

### Martwy kod (13 plików) — dowód, nie hipoteza

`src/components/MyWork/__tests__/MyWorkHub.decisionsOwnerFeedback.test.ts`
sprawdza WPROST, że `MyWorkHub.tsx` montuje `<DecisionsPanelContent>` i
**explicit asercją `not.toContain`** wyklucza import/montowanie 12 "kolejek":

```
AIAnalysisProposalReviewQueue · AnalysisDecisionQueue · ClosureDecisionQueue ·
DefinitionDecisionQueue · DefinitionRemediationQueue ·
DeliveryResultsAcceptanceQueue · EffectivenessClosureQueue ·
GateSignoffQueue · HandoffAcceptanceQueue · MaterialChangeQueue ·
PortfolioDecisionQueue · ScheduleDecisionQueue
```

Te 12 plików (`src/components/MyWork/*Queue.tsx`) mają WŁASNE użycie
`TableWithPreviewLayout` i WŁASNY grep-hit — ale zero wołających w
`src/` poza samym sobą i testem, który dowodzi ich emerytury. To jest znany
kształt "Biblioteka bez wywołania": zielone/istniejące, zero konsumentów.

Trzynasty plik, `src/components/Benefits/BenefitsHub.tsx`, ma zero
wołających gdziekolwiek (`grep -rln BenefitsHub src/` = tylko sam plik) i
zero wpisu w `src/routes/`.

**Wniosek:** te 13 plików NIE wymaga pomiaru luki — luka w martwym kodzie
nie wyświetla się nikomu. Warto je oznaczyć do usunięcia osobnym dyżurem
(poza zakresem tego zlecenia — zero naprawiania).

## K2 — co się da zmierzyć dziś

Z 29 żywych właścicieli layoutu, **20 ekranów w harnessie `dev-render`
otwiera realny komponent z realnym podglądem** (jeden plik bywa mierzony
przez >1 ekran/wariant — np. `ResultsVNextRegistryShell` przez 3 domeny).
Poniższe dopisałem NA TRWAŁE do `EKRANY_WYSOKOSC` w
`scripts/dev/measure-preview-canon.mjs` (ten sam wzorzec co wykonawca
Realizacji), z komentarzami źródłowymi przy każdym wpisie, który wymagał
dochodzenia (zły ekran/zła zakładka/brakujący query param).

Reszta (9 plików) dzieli się tak:

- **Wymaga dołożenia ekranu w harnessu** (plik żywy, ale `dev-render` go
  nigdzie nie montuje jako pełnej listy+podglądu): `CanonicalInitiativeRegister`,
  `DecisionsPanelContent` (żywy następca 12 martwych kolejek — **brak ekranu
  to dziura, bo to jest DZIŚ produkcyjny ekran decyzji w Mojej Pracy**),
  `ResultsInitiativesView`/`ResultsKpiReportsView`/`ResultsReportingEnterpriseViews`
  (klasyczny `ResultsHub`, harness ma tylko `ResultsVNext`), `FocusView`,
  `ReportsHub`, `KpiQueueView`, `MyTasksListContent` (tylko swatch/evidence,
  nie pełny ekran).
- **Niemierzalny obecnym przyrządem, nie z braku danych** —
  `ResultsVNextRegistryShell`: nie ma ANI JEDNEGO wystąpienia
  `data-preview-pane` w kodzie (`grep -n data-preview-pane
  src/components/ResultsVNext/ResultsVNextRegistryShell.tsx` = pusto).
  Znacznik istnieje TYLKO w `TableWithPreviewLayout.tsx` — ten plik buduje
  własne `<aside>` (patrz `ResultsVNextRegistryShell.tsx:241-262`) i kanoniczny
  przyrząd go po prostu nie widzi (`BRAK PANELU` mimo że podgląd fizycznie
  się otwiera — zweryfikowane zrzutem). Ręczna inspekcja DOM przez
  `javascript_tool` (poza kanonicznym przyrządem, wyłącznie do wglądu, NIE
  jako zamiennik pomiaru) pokazała dla wszystkich trzech domen (kpi/roi/okr)
  przy 1600×1000: `kartaBottom` 12 px od dołu, `luka wrappera` 0 px — **wygląda
  OK**, ale to nie jest zmierzone kanonicznym narzędziem i nie wolno tego
  wpisać jako "OK" do rejestru poniżej. Wymaga dołożenia `data-preview-pane`
  do pliku (naprawa — poza zakresem tego dyżuru).

Zero pozycji w kategorii "niemierzalne bez danych/logowania" — wszystko, co
ma ekran w harnessie, miało też dane demo wystarczające do otwarcia
podglądu.

## K3/K4 — pomiar (kanoniczny przyrząd, viewport 1600×1000, tolerancja 2 px)

`node scripts/dev/measure-preview-canon.mjs --port=5260 --wysokosc`

| moduł · plik | ekran harnessu | luka | ma ekran w harnessie |
| --- | --- | ---: | :-: |
| Realizacja / ExecutionResourcesSurface.tsx *(referencja, już naprawiona)* | execution-tab-resources | 0 px OK | tak |
| Realizacja / ExecutionWorkSurface.tsx | execution-tab-work | 0 px OK | tak |
| Realizacja / (execution-tab-list) | execution-tab-list | 0 px OK | tak |
| Realizacja / ExecutionControlSurface.tsx | execution-tab-control | 0 px OK | tak |
| Realizacja / ExecutionReportsSurface.tsx (przez zakładkę Menu 1) | execution-tab-resources+Raporty | 0 px OK | tak |
| Realizacja / ExecutionReportsSurface.tsx (**trasa samodzielna** `report=registry`) | execution-report-day11 | **216 px LUKA** | tak — patrz zastrzeżenie niżej |
| Realizacja / (execution-tab-summary — dashboard, brak podglądu z założenia) | execution-tab-summary | brak panelu (oczekiwane, nie z rodziny TWPL) | tak |
| Realizacja / (execution-tab-rollout — jw.) | execution-tab-rollout | brak panelu (oczekiwane) | tak |
| Moja praca / IdeasTableContent.tsx | idea-table | 0 px OK | tak |
| Wywiad / InterviewHub.tsx (Sesje) | interview-sessions-status | 0 px OK | tak |
| Wywiad / InterviewHub.tsx (kanoniczny) | interview-preview-canon | 0 px OK | tak |
| Ocena / (drd-library-entry) | drd-library-entry | 0 px OK | tak |
| AIChat / AgentHubShell.tsx | agent-hub | 0 px OK | tak |
| AIChat / ChatSignalsFeed.tsx | chat-signals-feed | **58 px LUKA** | tak |
| Discovery / DiscoveryToolsHub.tsx (zakładka Biblioteka) | tools-sesja-wyjscie+Biblioteka | 0 px OK | tak |
| Economics / FinanceHub.tsx | finance-hub | **263 px LUKA** (największa) | tak |
| Inicjatywy / CapacityScenarioSurface.tsx | capacity-advisor-a3 | **67 px LUKA** | tak |
| Inicjatywy / InitiativesHub.tsx | inicjatywy-lista | 0 px OK | tak |
| Inicjatywy / PlanScenarioSurface.tsx | plan-scenario-d1 | **92 px LUKA** | tak |
| Moja praca / MyIdeasListContent.tsx (kształt produkcyjny) | idea-table-production | 0 px OK | tak |
| Vault / VaultSafesTable.tsx | vault-safes-table | **200 px LUKA** | tak |
| Moja praca / InboxContent.tsx | mywork-inbox | 0 px OK | tak |
| Wyniki vNext / ResultsVNextRegistryShell.tsx (kpi/roi/okr) | results-vnext-registry-shell | NIEMIERZALNY (brak `data-preview-pane`) — ręcznie ~0 px, patrz K2 | tak (ale ślepe dla przyrządu) |

**Zastrzeżenie do "Realizacja / ExecutionReportsSurface — trasa
samodzielna":** ten sam komponent (`ExecutionReportsSurface`) mierzy 0 px
przez prawdziwą ścieżkę Menu 1 (`execution-tab-resources` → zakładka
Raporty) i 216 px przez samodzielny host `dev-render/screens/execution-report-day11.tsx`.
Ten host ma korzeń `className="min-h-screen bg-c-surface p-4"` — `min-h-screen`
zamiast kanonicznego `h-full flex flex-col` — czyli może to być artefakt
OPAKOWANIA HARNESSU, nie dowód błędu w `ExecutionReportsSurface.tsx` samym.
Nie naprawiałem tego hosta (poza zakresem — "zero naprawiania"), ale
odnotowuję rozbieżność: **ten sam plik, dwa mocowania, dwa wyniki** — dowód,
że łańcuch wysokości zależy od RODZICA, nie tylko od pliku z listy.

**Podsumowanie liczbowe:** 20 zmierzonych ekranów (bez referencji =
19 nowych). OK: 13. LUKA: 5 (ChatSignalsFeed 58px, FinanceHub 263px,
ExecutionReportsSurface-standalone 216px*, CapacityScenarioSurface 67px,
PlanScenarioSurface 92px, VaultSafesTable 200px — to 6 pozycji, licząc
zastrzeżoną). Niemierzalny: 1 (ResultsVNextRegistryShell, brak znacznika).

## K5 — wzorzec naprawy (jeden akapit)

Naprawiony `ExecutionResourcesSurface.tsx:418-437` owija
`<TableWithPreviewLayout>` w `<div className="mt-4 flex-1 min-h-0">` wewnątrz
`<section className="flex h-full min-h-0 flex-col p-4">` — czyli KAŻDY
przodek między granicą viewportu a `TableWithPreviewLayout` (którego własny
root to `h-full`, czyli `height:100%`) musi albo być `flex` z `flex-1
min-h-0` (jeśli jest elementem elastycznym), albo `h-full`/`h-screen` (jeśli
jest kotwicą). Sprawdzone rodzeństwo z luką powtarza DOKŁADNIE ten sam błąd:
`FinanceHub.tsx` renderuje `{content}` (czyli `<TableWithPreviewLayout>`)
jako BEZPOŚREDNIE dziecko `<StandardModuleBar>` bez żadnego opakowania
(`FinanceHub.tsx:4063` — brak `<div className="flex-1 min-h-0">`);
`CapacityScenarioSurface.tsx:897`, `PlanScenarioSurface.tsx:1014` i
`VaultSafesTable.tsx:371` montują `<TableWithPreviewLayout>` bez
poprzedzającego opakowania `flex-1 min-h-0` w ogóle. `h-full` na
`TableWithPreviewLayout` cichutko degraduje do wysokości treści za każdym
razem, gdy w łańcuchu przodków brakuje TEGO JEDNEGO ogniwa — komponent
działa "poprawnie" (renderuje się, ma dane, ma szerokość z kanonu), więc
błąd jest niewidoczny w code review i widoczny tylko w pomiarze albo na oku
właściciela. Naprawa per plik to zawsze to samo: znaleźć najbliższego
przodka o `display:block`/`auto`-height między viewportem a
`TableWithPreviewLayout` i albo dodać mu `flex-1 min-h-0` (jeśli jest
elementem flex), albo przepiąć go na `h-full flex flex-col`.

## Zasady przestrzegane

- Zero naprawiania konsumentów — każda znaleziona luka jest tylko
  zapisana, żadnego pliku w `src/` nie zmodyfikowano.
- Rozszerzony WYŁĄCZNIE kanoniczny przyrząd
  (`scripts/dev/measure-preview-canon.mjs`, `EKRANY_WYSOKOSC` + parametr
  `extra` dla query params) — nie napisano konkurencyjnego skryptu pomiaru.
- `docs/program/grafika/status.json` nietknięty.

## Commity

1. `agent/podglad-rodzina-20260902` — rozszerzenie `EKRANY_WYSOKOSC` w
   `scripts/dev/measure-preview-canon.mjs` o 20 nowych wpisów rodziny +
   parametr `extra` (opt-in query params).
2. `agent/podglad-rodzina-20260902` — ten rejestr.
