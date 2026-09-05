# P5 — Szkielety ładowania i „404 jako kontrakt" (przyczyna źródłowa #5)

Status: PROJEKT (nieskodowane). Bazuje na `docs/program/AUDYT_AWARD_20260905/{A,B,C,D}*.md`
(pomiar na żywo 05.09.2026, HEAD `1deab43c18d0d6f4c2bc1b339c1a32f79164f427` / `5097394eb6`)
i na weryfikacji `rg` na HEAD gałęzi `codex/m03-admin-20260824` (ten dokument, 05.09.2026).

---

## 1. Cel dla użytkownika

Żaden ekran nie ma stać w ciszy dłużej niż chwilę — od pierwszej sekundy widać szkielet treści,
po 8 s uczciwy napis „trwa dłużej niż zwykle", po 15 s twardy limit z banerem zamiast wiecznego
zawieszenia; liczniki nigdy nie kłamią „0", zanim dane naprawdę przyjdą; a konsola przeglądarki
jest czysta — brak danych to zwykła odpowiedź serwera (200), nie czerwony błąd sieci (404).

## 2. Zakres

Źródło identyfikatorów ekranów: `docs/program/AUDYT_AWARD_20260905/{A,B,D}*.md` (brak w tej fali
osobnego `docs/program/grafika/status.json` per-ekran dla tych pozycji — pliki tego rejestru
opisują inne fale odbioru; identyfikacja poniżej opiera się na trasie + pliku źródłowym,
zweryfikowanym `rg`).

**Grupa A — cisza podczas ładowania (5 miejsc, do ~15 ekranów/stanów licząc warianty):**

| # | Ekran | Trasa | Zmierzony czas | Dowód |
| :-: | --- | --- | --- | --- |
| A1 | Realizacja → Praca | `/execution` (tab „Praca") | 15,5–22 s, zero informacji zwrotnej do 15 s | `realizacja-03b-praca-wait.png` → `realizacja-03d-praca-22s.png` |
| A2 | Realizacja → Zasoby | `/execution` (tab „Zasoby") | ten sam mechanizm; ekran pusty bez ŻADNEGO tekstu ładowania | `realizacja-04-zasoby.png` → `realizacja-04c-zasoby-22s.png` |
| A3 | Pomysł → Mapa myśli / Whiteboard / Process Flow | `/my-work/ideas/:id/workspace/{mindmap,whiteboard,process-flow}` | 4–6 s pusty prostokąt bez ikony/tekstu/spinnera | `09b-idea-mapa-myśli.png` → `10b-idea-mindmap-6s.png`, `11-idea-whiteboard.png`, `12b-idea-processflow-6s.png` |
| A4 | Narzędzia — Analiza strategiczna / Operacyjne / Cyfrowe | `/discovery-tools/{strategic,operational,digital}` | 3–5 s (strategic), 5–10 s (operational), wolny start (digital) — goły spinner, brak powłoki appki | `04-strategic.png`/`04b-…wait.png`, `06c-operational-wait10.png`, `08-digital.png` |
| A5 | Notatnik — liczniki zakładek | `/my-work` (moduł Notatnik) | ~3–4 s z twardym „0" zanim pokaże prawdziwą wartość | `14-notatnik-lista.png` → `14b-notatnik-lista-4s.png` |

**Grupa B — 404 używane jako kontrakt „brak danych" (6 tras, ~7 ekranów licząc powtórzenia):**

| # | Trasa | Wołający (klient) | Handler (serwer) | Charakter |
| :-: | --- | --- | --- | --- |
| B1 | `GET /api/ai/stream/partial/:sessionId` | `src/hooks/useAIStream.ts:1479` (`checkPartialResponse`) | `server/src/routes/ai.routes.ts:6446` (handler), `:6482` (`res.status(404)`) | Zamierzony kontrakt „brak partial do wznowienia"; front go obsługuje (`response.status === 404 → return null`), ale strzela realnym błędem HTTP przy KAŻDYM otwarciu historycznej konwersacji. |
| B2 | `GET /api/my-work/my-ideas/:id/map/candidate` | `src/services/api.ts:5124` (`getIdeaProcessFlowCandidate`), wołane z warsztatu pomysłu | `server/src/routes/my-work.routes.ts:4673` | Brak kandydata → 404 (`readIdeaProcessFlowCandidate` rzuca `IdeaProcessFlowCandidateHandoffError`). Zmierzone: **2×404** przy każdym otwarciu tego samego pomysłu (podwójne wywołanie po stronie klienta — efekt uboczny, patrz krok 4). |
| B3 | `GET /api/vnext/results/kpi/scorecards/:scorecardId/review-snapshots/published` | `src/components/ResultsVNext/kpiScorecards/kpiScorecardApi.ts:341` (`getPublishedKpiScorecardSnapshot`) | `server/src/routes/resultsVnext/kpiScorecard.routes.ts:756` | **Świadomy kontrakt, już udokumentowany w kodzie** (komentarz linia ~326: „`null` on 404 … a real, expected state, NOT a forbidden/deny case"), pokryty testem `kpiScorecard.routes.test.ts:625` („404s when there is none"). Klient już łapie to poprawnie (`isNotFoundError(err) → null`). Zmiana kontraktu tu jest kosmetyczna (czystość konsoli/Network), nie naprawą błędu — patrz krok 5, effort dopasowany do tego. |
| B4 | `GET /api/v8/planning/initiatives/:id` + 10 zapytań pochodnych (`/kpis`, `/gate-readiness-check`, `/gate-roles`, `/suggested-changes`, `/raid`, `/watchers`, `/history`, plus legacy `/api/initiatives/:id/...` odpowiedniki) | `src/components/Initiatives/InitiativeDocumentView.tsx:2312` (`fetchAll`, ok. linii 2650–2830 — łańcuchy `V8PlanningApi.getX(id).catch(() => Api.get('/initiatives/:id/x')).catch(...)`) | `server/src/routes/v8/planning.routes.ts` (m.in. `:281` gate-roles, `:369` gate-readiness-check) + legacy `initiatives.routes.ts` | **To NIE jest przypadek „brak danych = powinno być 200"** — to rekord, który fizycznie nie istnieje w tabelach v8-planning (żyje wyłącznie w rejestrze `runtime-v1`/DEMO_STORY). Już opisane w kodzie: `src/components/Initiatives/gateReadinessFallback.ts:1-27`, komentarz w `InitiativeDocumentView.tsx:2822`. Zmierzone na rekordzie `demo-story-20260826-initiative-traceability`: 11 błędów 404 w konsoli, degradacja elegancka (fallbacki już istnieją). |
| B5 | `GET /api/organizations/current` | `src/contexts/OrgContext.tsx:102`, `src/services/modules/AccessControlService.ts:54`, `src/services/api/organizations.api.ts:58`, `src/services/api.ts:9922`, `src/components/layout/UserProfileMenu.tsx:141` | `server/src/routes/organization/organizations.routes.ts:38` → `OrganizationController.getCurrentOrganizations` (`server/src/controllers/OrganizationController.ts:58`) | **Sprzeczność zmierzona wprost w kodzie serwera**: handler zwraca WYŁĄCZNIE 401 (brak `userId`) albo 200 — nie ma w nim żadnej ścieżki `res.status(404)`. Audyt zanotował „sporadyczny 404" jako `flaky`, wystąpił RAZ, nie powtórzył się (`MP11`, `14-notatnik-lista.png.json`). Wniosek: 404 nie pochodzi z tego handlera per se — może być routing/proxy/wyścig startowy (patrz krok 6, oznaczone jako DO ZBADANIA, nie do naprawienia na ślepo). |
| B6 (osobna kategoria — nie 404, ale ten sam „brak = błąd" wzorzec) | `GET /api/megatrends/baseline` | `src/components/DiscoveryTools/...` (moduł Megatrendy, `/discovery-tools/strategic/megatrends`) | `server/src/routes/megatrend.routes.ts:18-31` (`notConfigured` → 503), przyczyna: dynamiczny `import('../models/megatrend.js')` w linii 49 nie rozwiązuje się w tym środowisku, mimo że plik istnieje jako `.ts` | Ekran całkowicie martwy (ocena A=0 w audycie). To NIE jest kontrakt „absence=200" — to zerwany import; osobny krok naprawy (krok 7). |

**Razem zakres:** 5 miejsc grupy A (ładowanie w ciszy, obejmujących realnie ~15 stanów ekranu
licząc warianty tras/tabów) + 6 tras grupy B (404-jako-kontrakt, ~7 punktów pomiaru z audytu)
+ 1 pozycja 503 (Megatrendy, powiązana przyczynowo, bo audyt łączy ją z tym samym wzorcem
„ekran nic nie mówi").

## 3. Przyczyna źródłowa

**A — brak wspólnego kontraktu ładowania.** Biblioteka szkieletów JUŻ ISTNIEJE
(`src/components/shared/states/{LoadingState,SkeletonState,StreamingState}.tsx`), ale własny
komentarz w `src/components/shared/states/index.ts:14-15` mówi wprost: „NOT YET wired into any
screen — this is the library only (Vegas Fala 0, VF0-10). Rollout into existing screens is
a separate, later step." Skutek zmierzony na żywo:
- `src/components/Execution/ExecutionWorkSurface.tsx:835` — `{state === 'LOADING' && <p role="status">Wczytuję kanoniczny rejestr pracy…</p>}` — goły tekst, bez `LoadingState`/`SkeletonState`, bez progresji czasowej.
- `src/components/Execution/ExecutionResourcesSurface.tsx` — **zero** odwołań do stanu ładowania (potwierdzone `rg` — brak `isLoading`/`LoadingState`/`SkeletonState` w pliku).
- `src/components/MyWork/IdeaMapWorkspace.tsx:4497-4507` — wczesny `if (loading) return <SkeletonState variant="canvas">` **istnieje i działa poprawnie** dla pierwszej fazy; „4–6 s pusty prostokąt" zmierzony w audycie zaczyna się PO ustawieniu `loading=false` (inicjalizacja ReactFlow / hydratacja grafu, poza tym wczesnym returnem) — więc naprawa tu nie polega na dodaniu pierwszego szkieletu (jest), tylko na rozszerzeniu stanu „ładowania" o fazę hydratacji canvasu.
- `src/components/MyWork/MyWorkHub.tsx:1005` — `useState({ all: 0, personal: 0, team: 0 })` — liczniki Notatnika inicjalizowane na `0` (wartość PEWNA, nie „nieznana"), renderowane wprost w chipach Menu 3 (linie 3090-3101), zanim `NotebookLibraryContent.tsx` odpowie realnym `onScopeCountsChange` (kontrakt propa: `NotebookLibraryContent.tsx:40-41`).
- Realizacja Praca/Zasoby: mechanizm odporności `fanOutExecutionCases` (`src/components/Execution/executionCaseFanOut.ts:27`, `EXECUTION_CASE_FANOUT_TIMEOUT_MS = 12_000`) DZIAŁA poprawnie jako bezpiecznik danych (dowód mutacyjny w `__tests__/executionCaseFanOut.test.ts`), ale (a) jest to limit PER REALIZACJA, nie limit całej operacji — przy N realizacjach czas odczuwalny może przekroczyć 12 s zanim wachlarz w ogóle się zamknie (zmierzone 15,5–22 s), i (b) w trakcie tych 12 s per-case nie ma ŻADNEGO wskaźnika w UI — sam plik `executionCaseFanOut.ts` nie ma kontraktu na postęp, tylko na wynik końcowy.
- Narzędzia (`/discovery-tools/{strategic,operational,digital}`): audyt sam zastrzega uczciwie, że wolny start (3–10 s, goły spinner) może być artefaktem zimnej kompilacji Vite w dev-serwerze, nie realnym czasem produkcyjnym — **nie potwierdzone ani obalone**, wymaga pomiaru na buildzie produkcyjnym (krok 8).

**B — serwer koduje „nie znaleziono X" jako HTTP 404 nawet gdy X to legalny, oczekiwany stan
pustki**, a nie wyjątek. Trzy różne przyczyny pod jednym objawem:
1. **B1/B2/B3** — to faktycznie zamierzone kontrakty „brak → 404", udokumentowane w kodzie
   (B3 nawet z testem broniącym 404). Klient je obsługuje bez awarii UI. Problem jest wyłącznie
   higieniczny: DevTools/monitoring/observability widzą czerwony wpis sieciowy przy normalnym
   użytkowaniu, co maskuje realne awarie (dokładnie wzorzec „fałszywe 404" z wcześniejszego
   pomiaru repo, `docs`/pamięć: „Środowisko testowe kłamie w obie strony").
2. **B4** — to NIE jest przypadek „zamień 404 na 200". To zapytania o zasób w NIEWŁAŚCIWYM
   magazynie danych: rekord `runtime-v1`/DEMO_STORY nigdy nie miał wiersza w tabelach v8-planning,
   więc pytanie „czy ten rekord ma gate-readiness w v8-planning" słusznie kończy się „nie ma
   takiego rekordu" po stronie tego serwisu. Właściwa naprawa to NIE odpytywać tego serwisu
   wcale dla rekordów o innym pochodzeniu (`InitiativeDocumentOrigin` już to śledzi —
   `src/components/Initiatives/initiativeDocumentSource.ts:26-31`), zamiast dziś: odpytaj →
   złap błąd → odpytaj legacy → złap błąd → użyj fallbacku (2 zbędne zapytania sieciowe ×
   5-6 zasobów = 10-12 zmierzonych 404).
3. **B5** — kod źródłowy handlera (`OrganizationController.getCurrentOrganizations`) NIE MA
   ścieżki zwracającej 404 — tylko 401/200. Sporadyczny 404 zaobserwowany raz w audycie
   (`MP11`) nie ma jeszcze zlokalizowanej przyczyny w warstwie aplikacji; może pochodzić
   z routingu Gateway/proxy przy zimnym starcie modułu, nie z logiki biznesowej. Traktowane
   jako `DO ZBADANIA`, zgodnie z zasadą „brak pomiaru nie jest wynikiem" — nie zgaduję naprawy.

**C — Megatrendy (503, nie 404, ale ten sam efekt „ekran nic nie mówi").**
`server/src/routes/megatrend.routes.ts:49`: `const megatrendModule = (await import('../models/megatrend.js')) as any;`
— import celuje w `.js`, plik źródłowy istnieje jako `server/src/models/megatrend.ts`. Import
jest w bloku `try/catch` (linie 48-54), więc awaria jest CICHA (`logger.warn`) i `MegatrendService`
zostaje `null` na cały czas życia procesu — każde żądanie do `/api/megatrends/baseline` trafia
w `notConfigured` (503) raz na zawsze, retry nie pomaga, bo problem jest w czasie ładowania
modułu, nie w danych zapytania.

## 4. Projekt rozwiązania

### 4a. Jeden kontrakt ładowania: `useDeferredLoading` + szkielety z biblioteki `states/`

Nowy hook `src/hooks/useDeferredLoading.ts` (NIE nowy system wizualny — spina istniejącą
bibliotekę `LoadingState`/`SkeletonState`/`StreamingState`, która czeka od Vegas Fala 0 na
podłączenie). Kontrakt (progi z briefu zadania, uzasadnione zmierzonymi czasami audytu:
Realizacja 15,5-22 s, Narzędzia 5-10 s, Idea Map 4-6 s — 15 s twardego limitu jest ponad
NAJGORSZYM zmierzonym realnym czasem, więc nie ucina prawdziwych odpowiedzi):

```ts
type DeferredLoadingPhase = 'idle' | 'pending' | 'slow' | 'timeout';
function useDeferredLoading(isLoading: boolean, opts?: {
  skeletonAfterMs?: number;   // domyślnie 300 — poniżej tego nic się nie renderuje (unika migotania)
  slowAfterMs?: number;       // domyślnie 8000 — pokazuje baner „trwa dłużej niż zwykle"
  timeoutAfterMs?: number;    // domyślnie 15000 — zamyka na uczciwy błąd zamiast wiecznego kręcenia
}): DeferredLoadingPhase;
```
Użycie w ekranie: `phase === 'idle' → treść`, `'pending' → nic (poniżej 300 ms)`,
`'slow'/'timeout' po 300 ms → <SkeletonState variant=.../>` odpowiedni do archetypu (table/record/
canvas/deck — te warianty JUŻ ISTNIEJĄ, tylko nikt ich nie wołał), z doklejonym paskiem tekstu
gdy `phase==='slow'` („Trwa dłużej niż zwykle…") i twardym `ErrorState`/banerem gdy `phase==='timeout'`
(wzorzec banera „Niepełne dane" już istnieje w Realizacji — `ExecutionSurfaces.hangingCase.test.tsx`
— rozszerzyć go, nie duplikować). Zero nowego systemu kolorów/animacji — `SkeletonState` używa
już tokenów `c-*` i `animate-pulse`.

**Miejsca podłączenia (per plik, żaden nowy komponent per ekran):**
- `ExecutionWorkSurface.tsx:835` — zamienić `<p role="status">Wczytuję…</p>` na
  `useDeferredLoading` + `<SkeletonState variant="table" rows={6} />`.
- `ExecutionResourcesSurface.tsx` — dodać `isLoading` stan (dziś go nie ma) + to samo podłączenie.
- `IdeaMapWorkspace.tsx` — rozszerzyć predykat wczesnego returnu (dziś tylko `loading`) o fazę
  hydratacji ReactFlow (nowa flaga `graphHydrating`, ustawiana `true` do pierwszego commit węzłów),
  żeby `SkeletonState variant="canvas"` trzymał się przez CAŁY realny czas ciszy, nie tylko
  pierwszy fetch.
- `DiscoveryToolsHub.tsx` i widoki `strategic/operational/digital` — podłączyć `LoadingState
  template="panel"` od pierwszej klatki zamiast gołego spinnera (dziś brak jakiejkolwiek
  powłoki — potwierdzone `01-root.png`/`04-strategic.png`).
- `MyWorkHub.tsx:1005` — inicjalizacja liczników na `null` zamiast `{all:0,personal:0,team:0}`;
  render w Menu 3 (linie 3090-3101): `count={notebookScopeCounts?.all ?? '—'}` zamiast surowego
  `0`. Zero zmiany kontraktu propa — `NotebookLibraryContent` i tak już wywołuje
  `onScopeCountsChange` z realną wartością, zmienia się tylko WARTOŚĆ POCZĄTKOWA i render „—".

**Zakaz:** żaden ekran nie dostaje własnego bespoke spinnera/tekstu — wyłącznie
`LoadingState`/`SkeletonState`/`StreamingState` z `shared/states/`, zgodnie z zakazem
bespoke-komponentów z `CLAUDE.md` (analogia do zakazu bespoke tabel).

### 4b. Reguła API „brak = 200 z null, nigdy 404" — TYLKO tam, gdzie to naprawdę reguła

Rozróżnienie z kroku 3 przenosi się wprost na projekt:

| Trasa | Decyzja | Uzasadnienie |
| --- | --- | --- |
| B1 `stream/partial/:sessionId` | **Zmienić na 200 `{found:false}`** | Czysty przypadek szumu — bez semantyki błędu do zachowania. |
| B2 `map/candidate` | **Zmienić na 200 `{candidate:null}`** + deduplikacja podwójnego wywołania klienta (patrz krok 4c) | To samo — front i tak już traktuje brak jako stan normalny. |
| B3 `review-snapshots/published` | **Zmienić na 200 `{snapshot:null}`**, ale DOPIERO po aktualizacji testu `kpiScorecard.routes.test.ts:625` (dziś explicite asertuje 404) i przeglądzie, czy inny konsument (poza `kpiScorecardApi.ts:341`) nie rozróżnia 404 od czegoś innego. Effort wyżej niż B1/B2 mimo prostoty zmiany — dotyka kontraktu z jawną decyzją architektoniczną (komentarz „decision #6b") i osobnej ochrony przed wyciekiem (`kpiScorecardRepository.ts`) — wymaga review, nie mechanicznej podmiany. |
| B4 (11× 404 karty inicjatywy) | **NIE zmieniać serwera.** Naprawa po stronie klienta: `InitiativeDocumentView.fetchAll` ma już dostęp do pochodzenia rekordu (`InitiativeDocumentOrigin` z `initiativeDocumentSource.ts`) — gdy `origin !== 'v8-planning'`, POMIŃ wywołania `V8PlanningApi.getGateRoles/getGateReadiness/getKpis/...` i ich legacy-fallbacki, przejdź od razu do lokalnych fallbacków (`buildFallbackGateReadiness` i analogiczne). Zero zapytań zamiast 10-12. | Zmiana kontraktu serwera nie naprawiłaby faktu, że pytamy niewłaściwy magazyn — a client-side gating usuwa problem u źródła (mniej sieci, szybszy render, nie tylko cichszy). |
| B5 `organizations/current` | **Nie zmieniać na ślepo.** Krok wykonania = REPRODUKCJA, nie fix (patrz krok 6). |
| B6 `megatrends/baseline` | **Nie dotyczy reguły 404→200** (to 503 z zerwanego importu) — osobna naprawa (krok 7). |

### 4c. Deduplikacja podwójnego `map/candidate`

Przyczyna podwójnego wywołania nie została zlokalizowana liniowo w audycie („podwójne wywołanie
po stronie klienta" bez wskazanej linii). Projekt: opakować wywołanie `Api.getIdeaProcessFlowCandidate`
w `IdeaMapWorkspace.tsx` istniejącym wzorcem in-flight-promise-cache (sprawdzić najpierw, czy
`src/services/api.ts` ma już taki wzorzec dla innych endpointów — jeśli tak, reużyć, nie
wynajdywać nowego mechanizmu) klucza `ideaId`, żeby drugi wywołujący (prawdopodobnie efekt
montujący się dwukrotnie w StrictMode/HMR albo dwa niezależne hooki w tym samym drzewie)
dostawał tę samą obietnicę zamiast nowego fetch.

### 4d. Megatrendy — import `.js` → `.ts` + kontrola startowa

Zmiana jednowierszowa: `import('../models/megatrend.js')` → `import('../models/megatrend.js')`
**pozostaje** literalnie (Node ESM + `"moduleResolution": "NodeNext"` w tym repo wymaga
rozszerzenia `.js` w specyfikatorze nawet dla plików `.ts` — do zweryfikowania `tsconfig` przed
zmianą, żeby nie zamienić działającego wzorca na łamiący build). Właściwa naprawa to
zdiagnozowanie DLACZEGO import realnie nie rozwiązuje się w tym środowisku (build output
`server/dist/models/megatrend.js` brakujący? błąd kompilacji tego jednego pliku cichy przez
`try/catch`?) — krok wykonania to najpierw `rg`/build-log, nie zgadywanie linii. Dodatkowo:
**kontrola startowa** — przy boot serwera (nie przy pierwszym żądaniu) zalogować ERROR (nie
`warn`) jeśli `MegatrendService === null`, i dodać do `/api/health` (albo analogicznego
endpointu startowego) flagę `megatrendsAvailable: boolean`, żeby regresja tego typu była
widoczna w monitoringu, nie tylko w audycie ręcznym.

### 4e. Console-clean acceptance — rozszerzenie istniejącego harnessu

Audytorskie skrypty (`scripts/dev/audyt-award-20260905/audyt.mjs` i podobne, poza repo/tymczasowe)
są WZOROWANE na `scripts/dev/odbior-zywo/zrzut.mjs`, który JEST w repo. Projekt: nie tworzyć
nowego narzędzia — rozszerzyć `scripts/dev/odbior-zywo/zrzut.mjs` (lub dodać obok niego
`scripts/dev/odbior-zywo/acceptance-console-clean.mjs` jako jego cienką nakładkę) o:
- listę 16 modułów × ich głównych tras (ta sama lista co `AUDYT_16_MODULOW_20260905`),
- przechwyt `page.on('console')` (poziom error) i `page.on('response')` (status ≥400),
- wyjście JSON: `{ trasa, konsolowychBledow: N, siecUprawnien4xx5xx: [...], czasMs }` per trasa,
- próg bramki: **zero** błędów konsoli i **zero** odpowiedzi ≥400 poza jawnie oznaczoną
  allowlistą (na start: 0 pozycji — każdy wyjątek wymaga świadomego wpisu z uzasadnieniem,
  nie cichego pominięcia).
To narzędzie ma żyć w repo (obecne audytorskie skrypty nie żyją — `scripts/dev/tmp-audit-award-runner.mjs`
jawnie oznaczony „nie w repo — tymczasowy, do usunięcia" w `B_ocena_inicjatywy_realizacja_wyniki.md:7`),
żeby regresja P5 była wykrywalna automatycznie, nie tylko w kolejnym ręcznym audycie.

## 5. Kroki wykonania

Kolejność: fundament (hook+szkielety) przed podłączeniem per ekran; serwer-fixy niezależne,
mogą iść równolegle; B4 (client-only gating) niezależny od reszty.

1. **[S] Hook `useDeferredLoading`** — `src/hooks/useDeferredLoading.ts` + test jednostkowy
   z fake timers (asercja: `idle`→(<300ms nic)→`pending` w [300,8000)→`slow` w [8000,15000)→`timeout`≥15000).
   Zero zależności od ekranów. Nie dotyka żadnego zamrożonego modułu.
2. **[S] Rozszerzyć `ErrorState`/baner „Niepełne dane"** o wariant `timeout` uogólniony z istniejącego
   banera Realizacji, żeby krok 3b mógł go reużyć zamiast kopiować. Plik: `src/components/shared/states/ErrorState.tsx`.
3. **[M] Podłączenie Realizacja (Praca+Zasoby)** — `ExecutionWorkSurface.tsx`, `ExecutionResourcesSurface.tsx`,
   ewentualnie dostosowanie `fanOutExecutionCases` żeby wołający mógł zgłaszać postęp per-case
   (opcjonalny callback `onCaseSettled`, zgodność wsteczna — sygnatura funkcji nie może się złamać,
   bo pokrywa ją dowód mutacyjny `executionCaseFanOut.test.ts`). **[ODMROZENIE 06_EXECUTION DEC-<nr>]**
   wymagany w commit message (moduł zamrożony 05.09, akcept właściciela — do uzyskania numeru
   decyzji od Piotra przed commitem, nie wymyślać numeru).
4. **[M] Podłączenie Idea Map/Whiteboard/Process Flow** — `IdeaMapWorkspace.tsx` (faza
   `graphHydrating`) + `MyWorkHub.tsx` (liczniki `null`→`—`). **[ODMROZENIE 07_MY_WORK_AGENT DEC-<nr>]**.
5. **[M] Podłączenie Narzędzia (strategic/operational/digital)** — `DiscoveryToolsHub.tsx` +
   widoki drzewa Discovery. **[ODMROZENIE 03_TOOLS DEC-<nr>]**. ZALEŻNE od kroku 8 (czy problem
   jest realny na produkcyjnym buildzie) — jeśli krok 8 pokaże, że to wyłącznie artefakt dev-servera,
   ten krok kurczy się do samego podłączenia `LoadingState` bez dalszego dochodzenia przyczyny.
6. **[S] B1 — `stream/partial/:sessionId` → 200** — `ai.routes.ts` (linia ~6482) + `useAIStream.ts:1479`
   (dostosować `checkPartialResponse`, `response.status === 404` przestaje być ścieżką kodu —
   sprawdzać `found:false` w body). Plik serwera nieobjęty zamrożeniem.
7. **[S] B2 — `map/candidate` → 200 + deduplikacja** — `my-work.routes.ts:4673` +
   `src/services/api.ts` (in-flight cache) + `IdeaMapWorkspace.tsx` wołający. Ta ostatnia część
   **[ODMROZENIE 07_MY_WORK_AGENT DEC-<nr>]** (współdzieli commit z krokiem 4 albo osobny —
   decyzja robocza, ale marker obowiązkowy w obu wariantach).
8. **[M] B3 — `review-snapshots/published` → 200** — `kpiScorecard.routes.ts:756` +
   `kpiScorecardApi.ts:341` (usunąć `isNotFoundError` gating, czytać `snapshot:null` wprost) +
   **aktualizacja testu** `kpiScorecard.routes.test.ts:625` (dziś asertuje `404`, ma zacząć
   asertować `200` + `snapshot:null`). Review z właścicielem kontraktu decision #6b przed
   zmianą — to jedyny krok tej paczki z jawnym „zapytaj, nie zgaduj".
9. **[M] B4 — client-side origin gating karty inicjatywy** — `InitiativeDocumentView.tsx`
   (funkcja `fetchAll`, ok. linii 2650-2830): rozgałęzienie na `origin` przed łańcuchami
   `V8PlanningApi.getX().catch(...)`. Zero zmian serwera. Moduł Inicjatywy NIE jest na liście
   zamrożonych 13 (patrz `MVP_FINAL_ZAMROZONE.json` — brak `05_INITIATIVES`), więc **bez markera
   odmrożenia** — do potwierdzenia przy odbiorze, że to nadal aktualne (Wyniki i Inicjatywy były
   dwoma otwartymi modułami wg `D_SYNTEZA_I_PLAN.md`, ale trzeba sprawdzić rejestr na dzień
   commitu, nie na dzień pisania tego dokumentu).
10. **[S] B5 — reprodukcja `organizations/current`** — NIE kod. Skrypt jednorazowy: N zimnych
    startów aplikacji z przechwytem sieci, żeby ustalić czy 404 pochodzi z Express (routing),
    proxy Vite, czy wyścigu tokena. Wynik decyduje, czy w ogóle jest tu praca kodowa do zrobienia.
11. **[M/L] B6 — Megatrendy import + kontrola startowa** — `server/src/models/megatrend.ts` /
    `megatrend.routes.ts:49` (diagnoza przed zmianą — patrz projekt 4d) + dodanie flagi zdrowia
    startowej. Serwer, poza zamrożeniem front-endu.
12. **[M] Harness console-clean** — `scripts/dev/odbior-zywo/acceptance-console-clean.mjs`
    (nowy plik w `tests/`/`scripts/` — pamiętać `git add -f` jeśli trafi pod ignorowany wzorzec)
    + pierwszy przebieg na 16 modułach jako punkt odniesienia (nie gate blokujący jeszcze —
    dopiero po krokach 1-11 próg „zero" ma sens; przed tym służy jako miernik postępu).

**Zależności:** 1→(3,4,5); 2→3; 8 wymaga jawnej zgody właściciela przed startem (nie tylko
przed commitem); 9 niezależny od reszty; 12 na końcu, mierzy resztę.

## 6. Testy

**Jednostkowe:**
- `useDeferredLoading.test.ts` — fake timers, asercja trzech progów + brak re-renderu przed 300 ms
  (dowód mutacyjny: zmiana `300` na `0` lub `slowAfterMs` na `Infinity` musi wywalić test).
- `ExecutionWorkSurface`/`ExecutionResourcesSurface` — rozszerzyć istniejący
  `ExecutionSurfaces.hangingCase.test.tsx` o asercję, że w oknie [0,300ms) DOM nie zawiera
  ani tekstu, ani roli `status` widocznej użytkownikowi (tylko `aria-busy`), a po 300 ms
  zawiera `SkeletonState`. Dowód mutacyjny: usunięcie warunku czasowego ma zawalić test.
- `MyWorkHub` — test snapshot/RTL: chip Notatnika renderuje `—`, dopóki `onScopeCountsChange`
  nie wywoła się choćby raz; po wywołaniu z `{all:2,...}` renderuje `2`. Dowód mutacyjny:
  przywrócenie `useState({all:0,...})` ma zawalić test (asercja NIE może przejść z „0").
- `ai.routes.test.ts` (nowy case) — `GET /stream/partial/:id` bez wiersza w `ai_partial_responses`
  → `expect(res.status).toBe(200)`, `expect(res.body.found).toBe(false)`. Dowód mutacyjny:
  przywrócenie `res.status(404)` ma zawalić test.
- `my-work.routes.test.ts` (nowy case) — analogicznie dla `map/candidate` → `200 {candidate:null}`.
- `kpiScorecard.routes.test.ts:625` — ZMIENIĆ (nie dodać obok) na `expect(res.status).toBe(200)`;
  `kpiScorecardApi.test.ts` (jeśli istnieje) — usunąć asercję na `isNotFoundError` dla tej ścieżki.
- `InitiativeDocumentView` — test na fixture z `origin: 'initiatives-runtime-v1'`: zero wywołań
  `V8PlanningApi.getGateRoles/getGateReadiness/getKpis` (spy + `expect(...).not.toHaveBeenCalled()`).
  Dowód mutacyjny: usunięcie gate ma przywrócić wywołania i zawalić test.
- `executionCaseFanOut.test.ts` — istniejący plik ma już dowód mutacyjny (nagłówek testu to
  potwierdza); jeśli krok 3 dodaje `onCaseSettled`, dopisać jeden test na wywołanie callbacku
  per-case bez zmiany istniejących asercji.

**Wizualne (zrzuty, jasny+ciemny, 1280/1440/1920):**
- Realizacja Praca/Zasoby: zrzut w oknie 1-300ms (nic), 301-3000ms (szkielet tabeli), symulowane
  opóźnienie sieci 9s (baner „trwa dłużej"), symulowane opóźnienie 16s (twardy baner błędu).
  Wymaga mocka sieci (MSW albo intercept Playwright) — NIE czekać realnie 16 s na żywym stagingu
  per zrzut.
- Idea Map: zrzut w fazie `graphHydrating` — musi pokazywać `SkeletonState variant="canvas"`,
  nie pusty div.
- Notatnik: zrzut Menu 3 przed pierwszą odpowiedzią serwera — chip pokazuje „—", nie „0".
- Tryb ciemny dla wszystkich powyższych — audyt źródłowy jawnie przyznaje zero pomiaru w
  ciemnym motywie (`D_SYNTEZA_I_PLAN.md` rozdział 5); to pierwsza okazja, żeby nie powtórzyć
  tej dziury dla NOWEGO kodu (nie trzeba nadrabiać całego audytu, tylko nie dokładać kolejnej
  niezmierzonej powierzchni).

**Przepływ klikany (Playwright, do dopisania w harnessie z kroku 12, nie osobny skrypt):**
1. Otwórz `/execution` z rzuconym opóźnieniem sieci na jednej realizacji → zobacz szkielet →
   zobacz baner „trwa dłużej" po ~8 s (symulowane) → zobacz baner błędu po ~15 s (symulowane) →
   zero błędów w konsoli przez cały czas.
2. Otwórz pomysł → mapę myśli → zero 404 w `read_network_requests` na `map/candidate` →
   szkielet canvas widoczny do commitu pierwszego węzła.
3. Otwórz kartę inicjatywy `runtime-v1` (rekord DEMO_STORY) → zero zapytań do `v8/planning/*`
   sub-resource w logu sieci → treść i przyciski AI identyczne jak dziś (fallback nie zmienia
   wyglądu, tylko usuwa zbędne zapytania).
4. Przebiegnij 16 modułów harnessem z kroku 12 → JSON wynikowy pokazuje 0/0 (błędy/4xx-5xx)
   poza jawną allowlistą.

## 7. Kryterium odbioru właściciela

Na 3000 (albo staging): otwórz Realizację → zakładkę Praca — widać ruchomy szkielet tabeli od
razu, nie pusty ekran; jeśli dane naprawdę się ociągają, po chwili pojawia się zdanie „trwa
dłużej niż zwykle", nigdy zawieszenie bez słowa. Otwórz dowolny pomysł → mapę myśli — widać
kształt canvasu od pierwszej klatki. Otwórz konsolę przeglądarki (F12) i przejdź przez menu —
zero czerwonych linii.

## 8. Ryzyka i cofanie

- **Ryzyko:** zmiana `stream/partial`/`map/candidate` z 404→200 może złamać inny, nieznaleziony
  konsument, który dziś polega na kodzie statusu 404 (nie na treści body) do rozróżnienia stanów.
  **Mitygacja:** `rg` pełnego repo (klient + testy) na każdą zmienianą trasę PRZED zmianą serwera,
  nie tylko na plik cytowany w audycie — audyt cytuje jednego wołającego, mogą być inni.
- **Ryzyko:** B3 (`review-snapshots/published`) ma jawną decyzję architektoniczną („decision #6b")
  o dwuwarstwowej ochronie przed wyciekiem — zmiana kontraktu bez zrozumienia TEJ decyzji może
  cofnąć zabezpieczenie. **Mitygacja:** review z autorem decyzji/właścicielem PRZED kodem, nie po.
- **Ryzyko:** krok 9 (client-side gating inicjatyw) zakłada, że `InitiativeDocumentOrigin` jest
  zawsze poprawnie wyliczony. Jeśli bywa `undefined`/błędny dla części rekordów, gating może
  ukryć realne dane zamiast zbędnych zapytań. **Mitygacja:** fallback „gdy origin nieznany, zachowaj
  dzisiejsze zachowanie" (nie zgadywać `v8-planning` na sztywno).
- **Cofanie:** każdy krok to osobny commit; rollback = `git revert` danego commitu (migracje nie
  dotyczą tej paczki — brak zmian schematu). Flaga wizualna nie jest tu potrzebna (to nie zmiana
  wyglądu ekranu, tylko dodanie stanu pośredniego) — ale jeśli `useDeferredLoading` okaże się
  regresją percepcyjną (np. migotanie mimo progu 300 ms), cofnięcie pojedynczego podłączenia
  (krok 3/4/5) nie wymaga cofania hooka z kroku 1.
- **Tag bezpieczny:** przed krokiem 3 (pierwszy krok dotykający zamrożonego `06_EXECUTION`)
  odnotować bieżący SHA jako punkt odwrotu w `_RUNBOOK_COFANIA.md`, zgodnie ze standardem repo.

## 9. Nakład

| Krok | Zakres | Model | Osobodni |
| :-: | --- | --- | :-: |
| 1-2 | Hook + rozszerzenie ErrorState | Sonnet | 0,5 |
| 3 | Realizacja Praca/Zasoby | Sonnet (mechanika), Opus (fanOut jeśli dotykany) | 1,0 |
| 4 | Idea Map + Notatnik liczniki | Sonnet | 1,0 |
| 5 | Narzędzia (zależne od kroku 8) | Sonnet | 0,5–1,0 |
| 6-7 | B1+B2 serwer+klient+dedup | Sonnet | 1,0 |
| 8 | B3 (wymaga review właściciela decyzji #6b) | Opus (kontrakt wrażliwy) | 0,5 + czas oczekiwania na decyzję |
| 9 | B4 client-side gating | Sonnet | 1,0 |
| 10 | B5 reprodukcja (bez kodu) | Sonnet | 0,25 |
| 11 | B6 Megatrendy import + health flag | Opus (diagnoza importu ESM bywa nieoczywista) | 0,5–1,0 |
| 12 | Harness console-clean | Sonnet | 1,0 |
| **Razem** | | | **≈7,25–8,75 osobodnia** |

**Równoległość:** kroki 6, 7, 9, 10, 11 (wszystkie serwerowo-izolowane lub client-only bez
współdzielonego pliku) mogą iść jednocześnie na osobnych gałęziach po zakończeniu kroku 1.
Kroki 3, 4, 5 dzielą hook z kroku 1, ale nie dzielą plików między sobą — też równoległe.
Krok 12 musi być ostatni (mierzy efekt reszty). Krok 8 jest wąskim gardłem nie-technicznym
(czeka na decyzję właściciela), więc warto go OTWORZYĆ najwcześniej (zadać pytanie od razu),
nawet jeśli kodowanie idzie na końcu.
