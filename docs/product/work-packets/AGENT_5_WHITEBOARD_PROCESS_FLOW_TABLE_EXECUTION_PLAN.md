# AGENT 5 — Execution Plan

> Status: supporting source, not canonical plan
> Manager note: use as source for Agent 5 only under the manager split
> Authority file: `docs/product/work-packets/MANAGER_FALA_1_CANONICAL_EXECUTION_MAP_2026-03-28.md`

## 1. Scope
- `Whiteboard`
- `Proces flow`
- `Tabele`
- Założenie robocze: w repo nie ma jednego kanonicznego pliku mapującego `agent 5` do modułów, więc ten plan przypisuje `agentowi 5` zakres z `Faza 5` w `docs/product/work-packets/V8_10_PHASE_REVIEW_REPORT_2026-03-28.md`.

## 2. Source of truth reviewed
- Źródła nadrzędne:
- `docs/product/work-packets/V8_EXECUTION_WAVES_NOW_LATER_2026-03-28.md`
- `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
- `docs/product/work-packets/V8_10_PHASE_REVIEW_REPORT_2026-03-28.md`
- `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- `docs/product/work-packets/Plan V8.1 Final.md`
- `docs/product/work-packets/POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM.md`
- Modułowe SSOT i readiness:
- `docs/product/IDEA_WORKSPACE_V5_SSOT.md`
- `docs/product/IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md`
- `docs/product/WHITEBOARD_V8_READINESS_AUDIT.md`
- `docs/product/WHITEBOARD_V8_SSOT.md`
- `docs/product/PROCESS_FLOW_V8_READINESS_AUDIT.md`
- `docs/product/PROCESS_FLOW_V8_SSOT.md`
- `docs/product/PROCESS_FLOW_QUANTITATIVE_ANALYSIS_AND_AUTOMATION_INTELLIGENCE_V8.md`
- `docs/product/TABLE_V8_READINESS_AUDIT.md`
- `docs/product/TABLE_V8_SSOT.md`
- `docs/product/TABLE_RELATIONAL_SCHEMA_AND_DOCS_WORKFLOW_V8.md`
- `docs/product/TABLE_MISSING_CAPABILITIES_MATRIX_V8.md`
- Wsparcie benchmarkowo-implementacyjne:
- `docs/product/WORKSTATION_CANVAS_RECOMMENDED_FEATURES_2026-03-16.md`
- `docs/product/WORKSTATION_CANVAS_IMPLEMENTATION_PLAN_2026-03-16.md`
- `docs/strategy/TABELE_V8_BENCHMARK.md`
- `docs/strategy/TABELE_V8_AS_IS.md`
- `docs/strategy/AIRTABLE_REPRESENTATION_ANALYSIS_FOR_CONSULTIFY_2026-03-16.md`
- Główne komponenty frontendowe:
- `src/components/MyWork/IdeaMapWorkspace.tsx`
- `src/components/MyWork/IdeaWorkspaceToolbar.tsx`
- `src/components/MyWork/IdeaWhiteboardTool.tsx`
- `src/components/MyWork/IdeaProcessFlowTool.tsx`
- `src/components/MyWork/IdeaTableTool.tsx`
- `src/components/MyWork/table/useTablePersistence.ts`
- `src/components/MyWork/table/useTablePlatformIntegration.ts`
- `src/components/MyWork/table/useTablePlatformBridge.ts`
- `src/components/MyWork/table/FieldManager.tsx`
- `src/components/MyWork/table/RecordExpandModal.tsx`
- `src/components/MyWork/table/interfaces/InterfacesIndex.tsx`
- `src/components/MyWork/table/forms/FormsIndex.tsx`
- Istotne backend paths / runtime:
- `server/src/routes/my-work.routes.ts`
- `server/src/routes/table-platform.routes.ts`
- `server/src/services/ideaAIGeneratorService.ts`
- `server/src/validators/ideaWorkspaceGraph.validators.ts`
- `server/src/services/realtimePlatformService.ts`
- Testy i proof points:
- `tests/unit/mywork/whiteboardNodes.test.ts`
- `tests/unit/mywork/crossToolTransform.test.ts`
- `tests/unit/mywork/canvasOsContract.test.ts`
- `tests/unit/backend/services/ideaAIGeneratorService.whiteboardFormatters.test.ts`
- `tests/unit/table/useTableSchema.test.ts`
- `tests/unit/table/useTableViews.test.ts`
- `tests/unit/table/useTableRows.test.ts`
- `tests/unit/table/AITableProposal.test.tsx`
- `tests/integration/routes/table-platform.sheet-artifact.sqlite.integration.test.ts`
- Benchmarki konkurencji:
- `Miro`
- `Lucidchart`
- `Airtable`
- `Coda`
- Ryzyka dokumentacyjne:
- `Plan v8.pdf` jest cytowany jako źródło nadrzędne, ale nie istnieje w repo.
- Drzewo `Softs` jest cytowane jako źródło nadrzędne, ale nie istnieje w repo; benchmark trzeba rekonstruować z downstream docs i źródeł webowych.
- `10-phase_softs_review_36408c2d.plan.md` jest cytowany przez `V8_10_PHASE_REVIEW_REPORT_2026-03-28.md`, ale nie istnieje w repo.

## 3. Executive summary
Zakres `Whiteboard / Proces flow / Tabele` nie jest pustym obszarem do zbudowania od zera. Repo zawiera realne, duże runtime'y dla wszystkich trzech modułów, a dokumentacja modułowa jest znacznie mocniejsza niż sugeruje to skrótowy 10-phase review. Najbardziej mylący wniosek z obecnej dokumentacji wysokopoziomowej jest taki, że `Whiteboard` i `Tabele` wyglądają jak moduły ledwo rozpoczęte, podczas gdy kod i SSOT-y pokazują raczej dojrzałe fundamenty bez domkniętego operating modelu. `Whiteboard` ma już realne zachowania warsztatowe, ale nadal nie ma wystarczająco spokojnej, jednoznacznej gramatyki pracy i finalnego workshop story. `Proces flow` ma sensowny edytor, tryby i elementy semantyczne, ale nadal nie jest wiarygodnym systemem procesowym klasy enterprise, bo brakuje properties, problems workflow, routing clarity i interoperacyjności. `Tabele` są najszersze i technicznie najmocniejsze, ale właśnie dlatego są najbardziej ryzykowne produktowo: mają zbyt dużo capability surface i zbyt mało jednego oczywistego mental modelu pracy.

Największe ryzyko dla tego zakresu nie polega na braku backendu, tylko na niespójności produktu odczuwanej przez użytkownika. Najszybszy efekt user-facing da się uzyskać przez domknięcie `Whiteboard` jako wiarygodnej powierzchni warsztatowej oraz `Proces flow` jako wiarygodnej powierzchni modelowania operacyjnego. Najbardziej strukturalny dług siedzi w `Tabelach`, gdzie jednocześnie istnieją bogate capability, feature-flagged `metadata-first` flow i legacy `graph-first` path. Minimalny plan na teraz nie powinien próbować dowieźć pełnego `Miro`, pełnego `Lucid` ani pełnego `Airtable/Coda`, ale też nie może redukować tych modułów do trybu demo. Trzeba dowieźć trzy uczciwe, bounded produkty: warsztatową tablicę z szybkim przejściem do syntezy, procesowy canvas z prawdziwą semantyką i jakością, oraz relacyjny system pracy z jedną kanoniczną ścieżką użytkownika. Bez tego użytkownik zobaczy dużo funkcji, ale nie poczuje gotowego produktu.

## 4. Module-by-module analysis

### Whiteboard

#### 4.1 Intended product behavior
- `Whiteboard` ma być warsztatową i syntetyczną powierzchnią w `Idea Workspace`, a nie osobnym produktem tablicowym.
- Ma służyć do szybkiego wyrzutu myśli, pracy na sticky notes, grupowania, facylitacji, syntezy i promocji wyniku do notatek, decyzji, tasków i dalszych artefaktów.
- Główny flow wg docs jest taki: wejście do jednej idei, szybkie wrzucanie materiału, porządkowanie przez grupowanie/ramki, prowadzenie warsztatu, potem synteza i konwersja wyników.
- Najważniejsze funkcje wg SSOT i readiness to: sticky-first work, draw mode, obrazy i wklejanie, frames/sections, timer, voting, follow-me, spotlight, AI-assisted clustering oraz traceable output promotion.

#### 4.2 Current repo truth
- `Whiteboard` istnieje jako realny tool w `Idea Workspace`, a nie jako placeholder. `IdeaMapWorkspace.tsx` utrzymuje `activeTool` dla `whiteboard`, `process_flow`, `table` i `mindmap`, a `IdeaWorkspaceToolbar.tsx` pokazuje go jako `Tablica`.
- `IdeaWhiteboardTool.tsx` ma realne zachowania produkcyjne: sticky notes, text, image, draw mode, persisted drawing paths, paste handlers dla obrazów i tekstu, undo/redo snapshots, facilitation state, timer, voting, follow-me, spotlight i export-related state.
- Runtime jest osadzony w jednej idei i jednym workspace, zgodnie z doktryną `one idea = one workspace`; to jest mocne i zgodne z SSOT.
- Moduł jest używalny do pracy warsztatowej już teraz, ale nadal wygląda jak szeroki capability bundle, nie jak produkt domknięty na poziomie workflow.
- Największe braki repo truth nie są w samym istnieniu funkcji, tylko w ich domknięciu: brak spokojnej tool-state grammar, brak finalnej first-class clustering flow, brak finalnego export/clipboard contractu i brak wyraźnej produkcyjnej doktryny performance.
- Wysokopoziomowe docs `V8_10_PHASE_REVIEW_REPORT_2026-03-28.md` oraz `V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md` zaniżają dojrzałość repo, bo opisują `Whiteboard` prawie jak pustą przestrzeń, podczas gdy kod i modułowe SSOT-y pokazują znacznie bardziej zaawansowany stan.

#### 4.3 Competitive standard
- `Miro` ustawiło rynkowy standard dla whiteboard-class produktu: sticky-first zero-friction, templates, facilitation, comments, present mode, AI clustering, multiplayer awareness i szybkie przejście od chaosu do struktury.
- `Miro` nie wygrywa samą nieskończoną planszą; wygrywa tym, że użytkownik może zacząć od bałaganu i bardzo szybko przejść do grupowania, decyzji, synchronizacji zespołu i dalszych formatów pracy.
- `Lucidchart` nie jest głównym benchmarkiem dla whiteboardu, ale wzmacnia oczekiwanie na czytelność, przewidywalną selekcję, kontrolę elementów i powtarzalne eksporty.
- Standard rynkowy nie wymaga od nas budowy `Figma` lub nieograniczonego design canvas. Wymaga natomiast, żeby użytkownik czuł, że warsztat, facylitacja i synteza są domkniętym doświadczeniem.
- Dzisiaj jesteśmy mocni w osadzeniu whiteboardu w szerszym workspace i w traceability do reszty produktu. Odstajemy od rynku tam, gdzie konkurencja jest najbardziej bezwysiłkowa: spokojna gramatyka narzędzi, template-first workshop starts, AI-assisted clustering jako oczywisty flow i eksport/presentability.
- 7-dimension scorecard:
- `User value` — realna wartość jest już obecna, bo user może faktycznie prowadzić warsztat na jednej idei. Ocena: `średnio mocne`. Najważniejszy brak: brak jednego bardzo czytelnego flow od wrzutki do syntezy.
- `Flow completeness` — wejście, edycja i podstawowa facylitacja istnieją, ale końcówka syntezy i przejścia dalej jest nierówna. Ocena: `częściowe`. Najważniejszy brak: canonical clustering-to-outcome flow.
- `UX quality` — capability jest duży, ale nie jest jeszcze wystarczająco spokojny i przewidywalny. Ocena: `średnie`. Najważniejszy brak: finalna tool-state grammar oraz whiteboard feel.
- `Data / logic quality` — model obiektów i persystencja są realne. Ocena: `mocne`. Najważniejszy brak: kanoniczny contract dla drawing/export/clipboard/performance.
- `Integration quality` — osadzenie w `Idea Workspace` i w output promotion jest dużą przewagą. Ocena: `mocne`. Najważniejszy brak: bardziej jawna traceable synteza do downstream artifacts.
- `Trust / governance / error handling` — proposal governance i session seams istnieją, ale product trust nie jest jeszcze domknięty na degraded/performance/export semantics. Ocena: `częściowe`. Najważniejszy brak: production-grade rules dla exportu, recoverability i dużych boardów.
- `Market standard fit` — repo jest bliżej rynku, niż sugeruje high-level review, ale nadal nie daje w pełni `Miro-class` poczucia gotowości. Ocena: `częściowe`. Najważniejszy brak: workshop templates + AI clustering + polish ergonomii.

#### 4.4 Main gaps
- Brak finalnej, widocznej dla usera gramatyki pracy `select / hand / draw / erase`.
- Brak spokojnego, pierwszoplanowego flow `capture -> cluster -> synthesize -> convert`.
- Paste/import działa, ale nie jest jeszcze potraktowany jako jeden productized zero-friction pipeline.
- Workshop templates są opisane kierunkowo, ale nie są jeszcze oczywistym front door dla typowych use case'ów.
- Frames/sections i present mode nie są jeszcze domknięte jako główna struktura warsztatu.
- Export/clipboard/board-pack semantics są za słabo zamrożone.
- Performance doctrine dla dużych boardów jest znana, ale nie jest jeszcze twardym kontraktem odbiorowym.
- Testy sprawdzają kawałki logiki, ale nie ma mocnego integrated proof dla realnego user journey przez `Idea Workspace`.

#### 4.5 Minimal acceptance state now
- User otwiera jedną ideę i bez zmiany modułu aplikacji przechodzi do `Whiteboard`.
- Może w ciągu jednej sesji: dodać sticky, tekst, obraz i rysunek, wkleić zewnętrzną treść, uporządkować materiał przez frames/sections lub clusters i uruchomić podstawowy warsztat z timerem i voting.
- Aktywny tool jest zawsze czytelny, a przełączanie między selekcją, nawigacją i rysowaniem nie powoduje niepewności.
- User może zobaczyć sensowną drogę do syntezy: klastrowanie manualne lub AI-assisted, preview zmian, akceptacja, a następnie promocja wyniku do dalszego artefaktu.
- Board zapisuje się stabilnie, daje się odtworzyć po reloadzie i nie gubi podstawowych runtime extensions.
- Export co najmniej do sensownego obrazu/pakietu jest przewidywalny i nie wygląda na eksperyment.
- Akceptowalne braki tej fali: brak pełnej suite realtime `Miro`, brak prototyping surface, brak oddzielnego standalone produktu tablicowego.

#### 4.6 Top missing functions
- Jawny tool-state machine dla `select`, `hand`, `draw`, `erase`.
- Production-grade `pen / highlighter / eraser` contract.
- First-class paste pipeline dla obrazów, URL-i i tekstu.
- Manual + AI-assisted affinity clustering jako jeden flow.
- Workshop templates dla najczęstszych scenariuszy.
- Frames/sections + present mode jako główna struktura warsztatu.
- Export / clipboard / board-pack contract.
- Duże-board performance guardrails i degradacja widoczna dla usera.
- Mocniejszy AI sidekick do summarization, theme finding i artifact extraction.
- Jedna czytelna proof ścieżka `board -> note/task/decision/process`.

#### 4.7 Proposed bounded delivery packets
- `WB-1 Whiteboard Interaction Grammar`
- Cel: uspokoić podstawową ergonomię pracy.
- Zakres: tool-state model, aktywne narzędzie, hand/draw/erase behavior, widoczne stany, minimalne cleanupy toolbar grammar.
- Co dokładnie dowozimy: user zawsze rozumie, czym aktualnie pracuje i jaki będzie efekt interakcji.
- Czego świadomie nie ruszamy: pełny multiplayer rewrite, nowe osobne panele, standalone board shell.
- Proof odbioru: user przechodzi przez create/select/draw/erase/pan bez niejednoznaczności i bez przypadkowych mutacji.
- Ryzyka: duży komponent frontowy, łatwo zrobić regresję w shared canvas behavior.

- `WB-2 Workshop Start And Synthesis Pack`
- Cel: domknąć główny flow warsztatowy od wrzutki do sensu.
- Zakres: template starts, frames/sections, manual clustering, AI-assisted clustering `propose -> preview -> accept`, podstawowa konwersja wyniku do artefaktu.
- Co dokładnie dowozimy: board przestaje być tylko miejscem wrzutek i staje się pełnym workshop-to-synthesis flow.
- Czego świadomie nie ruszamy: pełna biblioteka assetów, image-to-board AI extraction, szeroki public sharing.
- Proof odbioru: retro/brainstorm user startuje z template, klastruje materiał i konwertuje przynajmniej jeden wynik dalej.
- Ryzyka: zależność od `AI Suggestions` i artifact conversion contracts.

- `WB-3 Export, Trust And Performance Closure`
- Cel: zamknąć najbardziej odczuwalne niedomknięcia jakościowe.
- Zakres: export/clipboard semantics, board-pack minimum, performance guardrails dla dużych boardów, degraded-state copy i observability dla facylitacji.
- Co dokładnie dowozimy: whiteboard daje się pokazać, udostępnić i bezpiecznie używać bez poczucia eksperymentu.
- Czego świadomie nie ruszamy: pełny realtime collaboration redesign.
- Proof odbioru: duży board nie degraduje się kompromitująco, a eksport zachowuje czytelny wynik.
- Ryzyka: ryzyko wejścia w zbyt szeroki program performance/realtime.

#### 4.8 Risks and dependencies
- Zależność od wspólnego `Idea Workspace` substrate i od niełamania `Tools | Context | AI Suggestions`.
- Zależność od shared graph persistence i undo/redo contracts.
- Zależność od downstream artifact conversion oraz traceability contracts.
- Ryzyko dokumentacyjne: high-level phase docs zaniżają rzeczywistą dojrzałość i mogą skłaniać do złego scopu.
- Ryzyko jakościowe: brak integrated end-to-end tests dla całego user journey.

### Proces flow

#### 4.1 Intended product behavior
- `Proces flow` ma być formalną powierzchnią modelowania procesów, zależności, automatyzacji i VSM wewnątrz `Idea Workspace`.
- Ma rozwiązywać problem przejścia od luźnego myślenia do operacyjnej logiki, własności, handoffów, kontroli jakości i przejścia do execution.
- Główny flow wg SSOT: user mapuje proces, wybiera semantykę i tryb pracy, wzbogaca elementy o właściwości, waliduje diagram, analizuje metryki i promuje wynik do tasków, inicjatyw, automatyzacji lub ROI.
- Najważniejsze funkcje wg docs: lanes, `classic / automation / vsm`, semantic kits, validators, edge routing, BPMN import/export, properties strip, rules engine, problems panel, metrics, automation candidate scoring i traceability do downstream artifacts.

#### 4.2 Current repo truth
- `IdeaProcessFlowTool.tsx` to realny edytor, nie placeholder. Ma swimlanes, auto-layout `dagre`, tryby pracy, BPMN shapes, semantic kit direction, AI entry points oraz KPI/VSM seams.
- Runtime wspiera lane-based editing, przenoszenie węzłów między lane'ami, podstawową walidację oraz persistencję przez wspólny graph model.
- To jest używalny edytor flow z wartościowym foundation, ale nadal nie jest wiarygodnym systemem procesowym klasy enterprise.
- Największa rozbieżność między tym, co już jest, a tym, czego oczekuje rynek, leży w obszarach niewidzialnej semantyki: properties, problems workflow, routing clarity, round-trip interoperability i traceable execution linkage.
- Repo truth jest więc lepsza niż skrótowe `primary actions pass` z 10-phase review, ale nadal za słaba, by traktować moduł jako finished process system.

#### 4.3 Competitive standard
- `Lucidchart` i narzędzia BPMN-class ustawiły standard na: czytelne routing, sensowne kształty i template, properties, import/export, walidację, czytelne diagramy i możliwość pracy na większych flows bez zgubienia użytkownika.
- `Miro` podnosi oczekiwanie co do łatwości startu, współpracy i przenoszenia procesu do innych formatów pracy, ale nie zastępuje stricte procesowej semantyki.
- Standard kategorii nie polega na dodaniu kolejnych kształtów. Użytkownik oczekuje, że proces będzie czytelny, sprawdzalny, opisany metadanymi, łatwy do naprawy i interoperacyjny.
- Dzisiaj jesteśmy mocni w fundamencie runtime i włączeniu modułu do `Idea Workspace`. Najmocniej odstajemy w obszarach, które robią z diagramu narzędzie decyzji i governance, a nie tylko edytor kształtów.
- 7-dimension scorecard:
- `User value` — wartość istnieje dla mapowania procesu i podstawowej analizy. Ocena: `średnio mocne`. Najważniejszy brak: zbyt słaba wiarygodność procesu jako obiektu operacyjnego.
- `Flow completeness` — user może narysować proces, ale nie dostaje jeszcze pełnego workflow jakości i interopu. Ocena: `częściowe`. Najważniejszy brak: brak `properties -> problems -> fix -> export` loop.
- `UX quality` — edytor wygląda na realny, ale nie daje jeszcze enterprise-grade poczucia kontroli. Ocena: `średnie`. Najważniejszy brak: routing clarity i duża-flow ergonomia.
- `Data / logic quality` — semantyka jest kierunkowo mocna, w tym metrics and automation seams. Ocena: `mocne fundamenty`. Najważniejszy brak: rules engine i jawny model problemów.
- `Integration quality` — osadzenie w workspace i traceability direction są dobre. Ocena: `częściowe do mocnych`. Najważniejszy brak: mocniejsze linkowanie procesu do execution, initiative i ROI artifacts.
- `Trust / governance / error handling` — proces nie jest jeszcze wystarczająco audytowalny i naprawialny. Ocena: `częściowe`. Najważniejszy brak: properties, rule severity, ignore/fix workflow, BPMN round-trip.
- `Market standard fit` — wyraźnie powyżej poziomu makiety, ale poniżej progu `Lucid/BPMN-ready`. Ocena: `częściowe`. Najważniejszy brak: proces-grade semantics i interoperability.

#### 4.4 Main gaps
- Brak finalnego `properties strip` dla node'ów i edge'y.
- Brak pełnego `rules engine + problems panel` z severity, grouped issues i jump-to-element.
- Edge routing i reconnect są za słabe jak na czytelność enterprise process flows.
- Brak domkniętego minimum BPMN round-trip.
- Semantic kits istnieją, ale nie są jeszcze zamrożone jako step templates i domenowe klocki.
- Search, jump, copy/paste i convert nie są jeszcze wystarczająco mocne dla większych diagramów.
- Traceability do execution, tasks, initiatives i ROI jest bardziej kierunkowa niż produktowo oczywista.
- Quantitative/VSM layer ma obiecujące seams, ale nie jeden zamrożony model decyzji.

#### 4.5 Minimal acceptance state now
- User może otworzyć `Proces flow` w ramach jednej idei, utworzyć proces z lane'ami i podstawową semantyką bez poczucia, że to tylko diagramer.
- Dla node'ów i edge'y istnieje czytelna warstwa właściwości: label, type, lane/owner/system, decision metadata, linki do artefaktów i podstawowe execution metadata.
- Diagram pokazuje problemy jakościowe w sposób aktywny, nie tylko pasywny: lista problemów, highlight, jump-to, severity.
- Routing połączeń jest czytelny po zmianach układu, a reconnect nie psuje diagramu.
- User może zaimportować i wyeksportować bounded minimum BPMN bez gubienia podstawowej semantyki.
- Moduł wspiera co najmniej jeden realny flow `as-is -> to-be -> action`.
- Akceptowalne braki tej fali: brak pełnej parity z Visio/Lucid, brak pełnej symulacji i pełnego enterprise governance suite.

#### 4.6 Top missing functions
- Properties strip dla node'ów i edge'y.
- Rules engine z severity, targets i message model.
- Problems panel z jump-to i highlight.
- Manual edge routing, bendpoints, orthogonal snapping i reconnect.
- Minimum BPMN 2.0 round-trip.
- Step templates / element templates.
- Search + jump + copy/paste + convert.
- Mermaid flowchart import jako szybki entry.
- Traceability do tasków, inicjatyw, execution i ROI.
- Jeden kanoniczny model metrics i automation intelligence.

#### 4.7 Proposed bounded delivery packets
- `PF-1 Process Properties And Problems`
- Cel: zamienić diagram z ładnego edytora w procesowy system jakości.
- Zakres: properties strip, rules engine, grouped problems list, highlight, jump-to, podstawowy ignore/fix flow.
- Co dokładnie dowozimy: user może czytać i poprawiać proces jako obiekt operacyjny, a nie tylko graficzny.
- Czego świadomie nie ruszamy: pełny BPMN suite, simulation engine, nowa architektura paneli.
- Proof odbioru: diagram z błędami daje się naprawić poprzez jeden spójny workflow po prawej stronie i na canvasie.
- Ryzyka: łatwo rozproszyć zakres na ogólną przebudowę UI.

- `PF-2 Readability And Editing Discipline`
- Cel: dowieźć czytelność i kontrolę nad większym diagramem.
- Zakres: bendpoints, reconnect, orthogonal snapping, search/jump, copy/paste, replace/convert typów elementów.
- Co dokładnie dowozimy: user może realnie utrzymać duży flow bez walki z geometrią i ręcznym sprzątaniem.
- Czego świadomie nie ruszamy: pełna biblioteka shape'ów, pełny standalone diagram suite.
- Proof odbioru: większy diagram pozostaje czytelny po zmianach i może być szybko poprawiany.
- Ryzyka: duże ryzyko techniczne w edge rendererach i shared graph semantics.

- `PF-3 BPMN And Interop Minimum`
- Cel: domknąć minimalny próg wiarygodności rynkowej.
- Zakres: bounded BPMN import/export, stable IDs, minimum symbol set, export proof.
- Co dokładnie dowozimy: user może wejść i wyjść z modułu z zachowaniem podstawowej semantyki procesu.
- Czego świadomie nie ruszamy: pełna parity z enterprise suites, Visio import, zewnętrzny model repository.
- Proof odbioru: round-trip minimum dla prostego procesu z lane'ami nie traci znaczenia.
- Ryzyka: łatwo wejść w zbyt szeroki program interoperacyjności.

- `PF-4 Quantitative Process Decisions`
- Cel: wykorzystać istniejące seams metryk do realnej decyzji, nie do dekoracji.
- Zakres: jeden kanoniczny metrics model dla step/flow/scenario, bounded VSM truth, automation candidate scoring z jasnym outputem.
- Co dokładnie dowozimy: proces można porównać jako `as-is` vs `to-be` i uzasadnić wybór dalszych działań.
- Czego świadomie nie ruszamy: pełna symulacja, external sync refresh, szeroki ops analytics program.
- Proof odbioru: co najmniej jeden proces daje czytelny wniosek ilościowy i promuje action.
- Ryzyka: zależność od doprecyzowania niewidzialnych obiektów metrycznych.

#### 4.8 Risks and dependencies
- Zależność od shared canvas i niełamania frozen layouts po prawej stronie.
- Zależność od artifact linking i od dalszego execution spine poza samym modulem.
- Zależność od semantyki BPMN i od tego, że scope minimum nie rozrośnie się do osobnego programu.
- Ryzyko, że dostarczymy technicznie poprawny edytor, ale nadal bez prawdziwego problems workflow.
- Ryzyko testowe: brak silnego integrated user proof dla `IdeaMapWorkspace -> Process Flow`.

### Tabele

#### 4.1 Intended product behavior
- `Tabele` mają być relacyjnym systemem pracy wewnątrz `Idea Workspace`, a nie wyłącznie gridem ani wyłącznie technicznym metadata console.
- Mają rozwiązywać problem przejścia od pomysłu do strukturalnej, relacyjnej, operacyjnej prawdy: schema, records, views, interfaces, forms, AI schema evolution i integracje.
- Główny flow wg SSOT: user pracuje na `base -> table -> field -> view -> record -> interface -> form`, a AI jest bezpiecznym front door do tworzenia i zmian modelu.
- Najważniejsze funkcje wg docs: multi-table base shell, field governance, relations, lookup/rollup/formula explainability, record workspace, saved views, forms, interfaces, import/sync, AI proposal-driven build/refine/approve, docs-plus-data composition.

#### 4.2 Current repo truth
- `IdeaTableTool.tsx` i backend `table-platform.routes.ts` pokazują bardzo szeroki, realny system, nie prostą tabelkę. Repo ma bases, tables, fields, views, records, forms, interfaces, imports, schema proposals, audit, sharing i automations.
- Frontend ma zarówno legacy/workspace path (`useTablePersistence`) jak i nowy metadata-first path (`useTablePlatformIntegration`, `useTablePlatformBridge`), co potwierdza, że problemem nie jest brak capability, tylko brak jednej kanonicznej ścieżki.
- Tabele są technicznie najszerszym z trzech modułów tego zakresu i jednocześnie najbardziej produktowo niejednoznacznym.
- Realnie używalne już dziś są: CRUD rekordów, wiele view types, field management, formula validation, linked records, forms, interfaces, AI schema proposals, importy i public forms.
- Częściowe albo niedomknięte są: base-first shell, schema hub jako centrum produktu, explainability relacji, record workspace jako pełna powierzchnia pracy, ostra rola `views vs interfaces vs forms`, oraz jednoznaczne zwycięstwo `metadata-first` w głównym experience.
- Najważniejsza prawda repo: tabele nie wymagają od zera nowego produktu. Wymagają zamrożenia operating modelu i bounded usunięcia split-brain między `graph-first` i `metadata-first`.

#### 4.3 Competitive standard
- `Airtable` jest benchmarkiem głównym dla relacyjnego operating system: `base` jako kontener, multi-table navigation, schema manager, field semantics, views, forms, interfaces, automations i AI build front door.
- `Coda` jest benchmarkiem głównym dla docs-plus-data: connected views, contextual surfaces, richer record context, forms i workflow composition na tej samej prawdzie danych.
- Użytkownik nauczył się oczekiwać, że relacyjna praca nie zaczyna się od samotnej tabeli, tylko od systemu danych, który ma jeden oczywisty model mentalny.
- Użytkownik oczekuje też, że to samo źródło danych przeżywa się różnie przez role: operator pracuje na view, stakeholder na interface, submitter przez form, a każdy widzi spójną prawdę.
- Naszą mocną stroną względem rynku może być osadzenie tabel w szerszym workspace graph i proposal-driven AI governance. Dziś jednak przewaga jest bardziej architektoniczna niż produktowo odczuwalna.
- Największe odstawanie od rynku dotyczy nie funkcji bazowych, tylko clarity: co jest base, co jest schema hubem, co jest record workspace, kiedy user używa interface, a kiedy view.
- 7-dimension scorecard:
- `User value` — wartość jest wysoka, bo capability jest ogromny. Ocena: `mocne fundamenty`. Najważniejszy brak: brak jednego oczywistego operating modelu dla zwykłego usera.
- `Flow completeness` — user może robić bardzo dużo, ale flow nie jest wystarczająco czytelny i kanoniczny. Ocena: `częściowe`. Najważniejszy brak: niespójny base-first journey.
- `UX quality` — miejscami wygląda jak platforma, miejscami jak toolbox. Ocena: `średnie`. Najważniejszy brak: product shell i rola poszczególnych surfaces.
- `Data / logic quality` — backend i model danych są bardzo mocne. Ocena: `mocne`. Najważniejszy brak: explainability relacji i bezpieczne schema mutation UX.
- `Integration quality` — integracje, AI i workspace links są szerokie. Ocena: `mocne, ale rozszczepione`. Najważniejszy brak: split-brain `graph-first` vs `metadata-first`.
- `Trust / governance / error handling` — audit/history/proposals istnieją, ale schema governance nie jest jeszcze wystarczająco pierwszoplanowa. Ocena: `częściowe do mocnych`. Najważniejszy brak: change-impact preview i schema hub.
- `Market standard fit` — technicznie zbliżamy się do klasy `Airtable/Coda`, produktowo jeszcze nie. Ocena: `częściowe`. Najważniejszy brak: jedna relacyjna gramatyka pracy od base do record/interface/form.

#### 4.4 Main gaps
- Brak jednego jawnego `base-first` shell jako głównego mental modelu.
- Brak schema hub jako centrum zarządzania polem, zależnościami i ryzykiem zmian.
- Relacje istnieją technicznie, ale ich explainability i navigation UX są za słabe.
- Record detail jest za słaby jak na główną powierzchnię pracy na obiekcie.
- Nie dość jasno rozdzielone są role `view`, `interface` i `form`.
- Docs-plus-data composition jest opisana, ale za słabo odczuwalna w produkcie.
- AI schema proposals istnieją, ale nie są jeszcze jednoznacznym bezpiecznym front door.
- Największy dług architektoniczno-produktowy to controlled `metadata-first` path zamiast bezdyskusyjnego bounded defaultu.
- Brakuje mocnego integrated proof dla pełnego user journey od stworzenia struktury do pracy na danych.

#### 4.5 Minimal acceptance state now
- User wchodzi do `Tabel` i rozumie, że pracuje na `base` z wieloma tabelami, a nie na przypadkowym pojedynczym gridzie.
- Z jednego czytelnego shellu może przełączać się między tabelami, widokami i głównymi działaniami bazowymi.
- Schema jest obsługiwana przez jeden oczywisty hub: pola, typy, relacje, zależności, primary field, wpływ zmian.
- Record nie jest tylko wierszem lub modalem, ale ma sensowną powierzchnię pracy z danymi, relacjami, komentarzami i kontekstem.
- `Views`, `Interfaces` i `Forms` są jasno rozdzielone rolą, ale oparte o tę samą prawdę danych.
- AI może zaproponować lub poprawić schemę przez `propose -> review -> approve`, bez niejawnych mutacji.
- Bounded `metadata-first` path jest kanoniczny dla aktywnej ścieżki usera w tym module, nawet jeśli pełna migracja starszych wariantów nie jest jeszcze zakończona.
- Akceptowalne braki tej fali: brak pełnej parity z każdą funkcją Airtable/Coda, brak szerokiej komunikacyjnej automatyzacji, brak pełnego osobnego spreadsheet suite.

#### 4.6 Top missing functions
- Finalny `base` i multi-table operating shell.
- Schema hub z dependency map i change-impact preview.
- Primary field i identity model jako jawna powierzchnia produktu.
- Strong relation UX i explainability dla lookup/rollup/reverse links.
- Record workspace zamiast tylko record detail modal.
- Clear `view vs interface vs form` operating split.
- Docs-plus-data composition w record detail i interfaces.
- AI-first creation and refine front door.
- Bounded metadata-first default path bez split-brain w głównym flow.
- Integrated proof dla create/edit/query/interface/form user journey.

#### 4.7 Proposed bounded delivery packets
- `TB-1 Base Shell And Canonical Entry`
- Cel: nadać modułowi jeden oczywisty start i mental model.
- Zakres: base-first shell, multi-table navigation, jasne rozróżnienie `base / table / view`, spójny entry do create/import actions.
- Co dokładnie dowozimy: user wie, gdzie zaczyna, na czym pracuje i jak przechodzi między tabelami.
- Czego świadomie nie ruszamy: pełna migracja wszystkich legacy workspace, szeroki redesign całej platformy tabel.
- Proof odbioru: user tworzy lub otwiera base, przechodzi między tabelami i nie gubi się w modelu nawigacji.
- Ryzyka: łatwo wejść w ogólną przebudowę produktu zamiast bounded shell pass.

- `TB-2 Schema Hub And Safe Mutations`
- Cel: zamienić schema work z pobocznego capability w centrum relacyjnego systemu.
- Zakres: field manager jako schema hub, primary field actions, dependency map, impact preview przy zmianach, relation config explainability.
- Co dokładnie dowozimy: user może bezpiecznie rozumieć i zmieniać model danych.
- Czego świadomie nie ruszamy: pełna przebudowa wszystkich advanced field types naraz.
- Proof odbioru: zmiana pola pokazuje wpływ na formulas, views, forms i interfaces, a relacje są zrozumiałe.
- Ryzyka: duże rozproszenie po wielu komponentach tabelowych.

- `TB-3 Record Workspace And Relational Clarity`
- Cel: domknąć codzienną pracę na rekordzie i relacjach.
- Zakres: Record workspace, embedded related views, computed-field explanations, stronger relation traversal, comments/audit/context in one place.
- Co dokładnie dowozimy: rekord staje się prawdziwym obiektem pracy, a nie tylko wierszem w gridzie.
- Czego świadomie nie ruszamy: pełna docs productization, rozbudowane page templates dla wszystkich verticali.
- Proof odbioru: user otwiera rekord, rozumie relacje, computed values i może pracować dalej bez wracania do surowego gridu.
- Ryzyka: zahaczenie o zbyt szeroki docs-plus-data program.

- `TB-4 Views, Interfaces, Forms Role Split`
- Cel: uporządkować trzy najważniejsze curated surfaces nad tym samym data core.
- Zakres: jasny model roli `view`, `interface`, `form`, indexy i lifecycle minimum, kontrakt między nimi i record/table truth.
- Co dokładnie dowozimy: użytkownik i zespół wiedzą, kiedy używać której powierzchni, a produkt przestaje wyglądać jak zbiór podobnych funkcji.
- Czego świadomie nie ruszamy: pełna biblioteka interface kits i szeroki automation program.
- Proof odbioru: ten sam model danych da się sensownie konsumować przez operatora, submittera i stakeholdera.
- Ryzyka: jeśli nie ma jasnej granicy scope, pakiet rozrośnie się do osobnego programu table-platform.

- `TB-5 Metadata-First Canonical Path`
- Cel: usunąć najbardziej szkodliwy split-brain bez otwierania nowej architektury.
- Zakres: bounded defaultization `metadata-first` dla aktywnego flow, projection clarity do workspace graph, proof że użytkownik przechodzi jedną kanoniczną ścieżką.
- Co dokładnie dowozimy: produkt przestaje wysyłać sprzeczne sygnały, która warstwa jest prawdą operacyjną.
- Czego świadomie nie ruszamy: globalny rewrite wszystkich legacy przypadków i wszystkich adapterów.
- Proof odbioru: jeden wskazany user journey działa przez nową ścieżkę jako bezdyskusyjny default.
- Ryzyka: to najbliższy architekturze pakiet; trzeba pilnować bounded slice i user-facing effect.

#### 4.8 Risks and dependencies
- Zależność od wspólnego `Idea Workspace` i od decyzji, że `Table` pozostaje jednym z czterech systemów pracy, nie osobnym produktem poza kontekstem idei.
- Zależność od `table-platform.routes.ts`, feature flags i projection layer między `metadata-first` a `graph-first`.
- Zależność od forms/interfaces/record detail contracts, które są rozproszone po wielu komponentach.
- Ryzyko, że delivery pójdzie w techniczną szerokość zamiast w jedną czytelną ścieżkę użytkownika.
- Ryzyko testowe: brak jednego wyraźnego integrated acceptance proof dla pełnego flow base/schema/record/interface/form.

## 5. Cross-module dependencies
- Wszystkie trzy moduły zależą od jednej doktryny `Idea Workspace`: jedna idea, jeden workspace, cztery natywne systemy pracy bez rozbijania produktu na mini-apki.
- Wszystkie trzy moduły zależą od wspólnego graph/runtime substrate i od stabilności `IdeaMapWorkspace`.
- Wszystkie trzy moduły zależą od zachowania frozen workspace strip `Tools | Context | AI Suggestions`; nowe capability muszą wejść do istniejących paneli, nie tworzyć nowych warstw.
- `Whiteboard` i `Proces flow` współdzielą canvas grammar, selekcję, snapping, comments/activity seams i przyszłe proof patterns.
- `Proces flow` i `Tabele` współdzielą potrzebę silniejszej semantyki, explainability i downstream traceability do execution.
- `Whiteboard` i `Tabele` spotykają się na granicy synteza -> struktura: dobre promotion contracts zmniejszą chaos przy przejściu z warsztatu do relacyjnego systemu.
- Cały zakres ma wspólny problem proof quality: dużo testów jednostkowych, za mało integrated acceptance.

## 6. Recommended execution order
- `1. WB-1 Whiteboard Interaction Grammar`
- Uzasadnienie: najszybszy widoczny efekt, mały bounded zakres, redukuje najbardziej odczuwalny chaos ergonomiczny.
- `2. WB-2 Workshop Start And Synthesis Pack`
- Uzasadnienie: domyka główny user-facing sens whiteboardu, zanim wejdziemy w cięższe pakiety techniczne.
- `3. PF-1 Process Properties And Problems`
- Uzasadnienie: to pierwszy moment, w którym `Proces flow` przestaje być głównie diagramerem i staje się narzędziem procesowym.
- `4. PF-2 Readability And Editing Discipline`
- Uzasadnienie: po semantyce trzeba dowieźć czytelność i kontrolę dużych diagramów.
- `5. TB-1 Base Shell And Canonical Entry`
- Uzasadnienie: zanim dotkniemy głębokiej relacyjnej logiki, user musi dostać jeden czytelny shell i mental model.
- `6. TB-2 Schema Hub And Safe Mutations`
- Uzasadnienie: schema to centrum prawdy tabel; bez tego każdy kolejny pakiet będzie tylko nakładką.
- `7. TB-3 Record Workspace And Relational Clarity`
- Uzasadnienie: po shellu i schema user potrzebuje mocnego codziennego obiektu pracy.
- `8. TB-4 Views, Interfaces, Forms Role Split`
- Uzasadnienie: dopiero po uporządkowaniu shellu, schema i rekordu warto porządkować curated surfaces.
- `9. PF-3 BPMN And Interop Minimum`
- Uzasadnienie: po semantyce i czytelności warto dowieźć minimalny próg rynkowej wiarygodności.
- `10. WB-3 Export, Trust And Performance Closure`
- Uzasadnienie: sensowny finish warstwy odbiorowej po domknięciu głównego workflow.
- `11. PF-4 Quantitative Process Decisions`
- Uzasadnienie: wysoka wartość, ale bez wcześniejszego trust layer może zostać odebrana jako dekoracja.
- `12. TB-5 Metadata-First Canonical Path`
- Uzasadnienie: najdelikatniejszy pakiet; powinien być wykonany dopiero wtedy, gdy user-facing model produktu jest już jasno określony i da się go bezpiecznie przypiąć do jednej kanonicznej ścieżki.

## 7. Final recommendation
Ten zakres da się doprowadzić do poziomu naprawdę dobrego produktu, ale tylko pod jednym warunkiem: nie wolno traktować go ani jako pustego pola do wymyślenia, ani jako gotowego produktu wymagającego tylko polishu. `Whiteboard`, `Proces flow` i `Tabele` mają już realny runtime i realne capability; problemem jest brak domkniętego operating modelu, a nie brak feature flags na liście.

Najlepsza strategia to dowozić ten obszar jako trzy uczciwe, bounded produkty w jednym workspace: `Whiteboard` jako warsztat i synteza, `Proces flow` jako model operacyjny i jakościowy, `Tabele` jako relacyjny system pracy. Nie wolno uprościć lub zignorować: jednej idei jako jednego workspace, proposal-governed AI, roli `Tools | Context | AI Suggestions`, relacyjnej semantyki tabel, process-grade properties i problems workflow oraz traceability do dalszych artefaktów. Największym błędem byłoby albo przepchnąć tutaj ukryte `8.2`, albo odwrotnie: zaniżyć scope do kilku kosmetycznych poprawek i udawać, że moduły są gotowe. Ten plan zakłada ambitny, ale realistyczny środek: doprowadzić trzy silne surfaces do stanu odbieralnego, bez chaosu i bez zgadywania.
