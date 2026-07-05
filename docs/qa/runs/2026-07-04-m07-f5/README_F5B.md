# M07 F5b — Polish unifikacyjny (B1-B3) + B4 sweep — QA run 2026-07-04

Wykonawca: Sonnet (F5b B1-B3), Sonnet (B4 sweep — wykonane przez tego samego
agenta w tej samej sesji zamiast Haiku, na tym samym worktree/gałęzi
sekwencyjnie po F5b). Gałąź `feat/m07-finisz` (worktree `agent-a4140c9776c425306`),
na szczycie F5a (`85df074c0d`).

## B1 — viewState czytany przy hydracji (bug L-04)

**Problem:** `extensions.processFlow.viewState` był hardcoded stub
(`{ layoutMode: 'horizontal', showGrid: true, snap: true }`) zapisywany na
każdym save, nigdy nie odczytywany przy hydracji — ustawienia grid/snap/
viewport użytkownika znikały po przeładowaniu.

**Fix:**
- Nowy czysty moduł `processflow/viewState.ts`
  (`normalizeProcessFlowViewState`, `isValidViewport`, `resolveHydrationViewport`,
  `processFlowViewportStorageKey`) — walidacja/normalizacja bez DOM, testowalna.
- Hydracja (`IdeaProcessFlowTool.hydrate`) czyta `pfExt.viewState`, ustawia
  realny stan `showGrid`/`snapToGridEnabled`, i rozwiązuje viewport
  (blob → fallback `localStorage['pf-viewport-<ideaId>']` → brak → fitView).
- Viewport aplikowany po zamontowaniu żywej instancji ReactFlow
  (`reactFlowInstanceRef.current.setViewport(...)`, 50ms po `onInit`, mirror
  wzorca z `useMindMapPersistence`/Mind Map). `fitView` na `<ReactFlow>`
  warunkowy — wyłączony gdy jest zapisany viewport do przywrócenia.
- `buildPersistPayload` zapisuje TERAZ realny stan (nie stub) + cache'uje
  bieżący viewport do localStorage przy każdym build.
- Dodano mały przełącznik grid/snap (dwa przyciski, ikony `Grid3x3`/`Magnet`,
  wyłącznie tokeny `var(--c-*)` solid — bez `/alpha` na `c-*`, bo te nie
  emitują reguł dla hex-owych tokenów, patrz `finding_c_token_alpha_colormix`)
  — bez tego przełącznika zapisany/odczytany stan nie miałby jak się zmienić
  z UI.
- `CanvasZoomControls` (wspólny plik, NIE modyfikowany) już miał przycisk
  "Przywróć zapisany widok" za propem `savedViewport` — PF teraz go
  przekazuje (bonus, zero ryzyka, kod już istniał).

**Before/after (opis, brak żywego zrzutu — patrz sekcja Zrzuty):**
- PRZED: użytkownik ukrywa siatkę / wyłącza snap / oddala widok → zapisuje →
  przeładowuje stronę → wraca domyślny grid=on/snap=on/fitView (stub zawsze
  pisał `true`/`true`, viewport nigdy nie istniał w payloadzie).
- PO: te same trzy ustawienia wracają dokładnie takie, jakie użytkownik
  zostawił, w tym pozycję/zoom kamery.

## B2 — wspólny context-menu — decyzja: ZOSTAW własny

`IdeaCanvasContextMenu` (src/components/MyWork/IdeaCanvasContextMenu.tsx) to
menu akcji AI (Expand/Challenge/Find evidence/Suggest connections/Fill
gaps/Brainstorm — wszystko przez `generateAIProposal`), NIE menu edycji
strukturalnej. Zero pokrycia z rzeczywistymi akcjami PF (`getNodeContextActions`/
`getCanvasContextActions`: add-node-per-shape, duplicate, delete, properties,
paste, auto-layout). Adopcja wymagałaby dopisania nowych akcji do cudzego
wspólnego pliku — poza budżetem "minimalne ryzyko" tej specyfikacji.
Decyzja + uzasadnienie udokumentowane inline w `IdeaProcessFlowTool.tsx` tuż
przed renderem `<ProcessFlowContextMenu>`.

## B3 — komentarze na węzłach

**Kontrakt:** dane w `node.data.comments[]`, persystencja przez istniejący
blob (jeździ automatycznie przez ten sam `scheduleSave(buildPersistPayload())`
efekt co reszta grafu — zero zmian w F3/F4). Mind Map's `NodeCommentThread`
persystuje przez dedykowane API (`Api.getNodeComments/addNodeComment/
deleteNodeComment`) — inny kontrakt persystencji niż wymagany tu (blob-only),
więc lokalna kopia zamiast importu:
- `processflow/nodeComments.ts` — czysta logika (`buildProcessFlowComment`,
  `appendComment`, `removeComment`, `extractMentions`), testowalna bez DOM.
- `processflow/ProcessFlowNodeCommentThread.tsx` — panel UI, wyłącznie tokeny
  `var(--c-*)` (Mind Map's oryginał używa hardcoded `blue-500`/`danger-500` —
  niedopuszczalne pod reżimem wizualnym).
- Trigger: nowy przycisk `MessageCircle` w `ProcessFlowFloatingToolbar`
  (odznaka z liczbą komentarzy) — `MessageSquare` był już zajęty przez
  istniejący przycisk "Ask AI", stąd inna ikona dla jednoznaczności.

## B4 — sweep (mechaniczny)

- Usunięto martwy import `MessageSquare` z `IdeaProcessFlowTool.tsx`
  (zero użyć w całym pliku po weryfikacji grep).
- `FlowEdgeComponent.tsx`: `fill="var(--c-bg, #fff)"` → `fill="var(--c-bg)"`
  (jedyny zbłąkany hex wprowadzony przez F5a w zakresie processflow — literal
  fallback zbędny, `--c-bg` zawsze zdefiniowany w runtime). Pozostałe
  wystąpienia hex w diffie F5a to pre-istniejący komentarz kodu
  (`// slate-400 #94a3b8`, od kwietnia, poza zakresem).
- Zero zmian zachowania.

## ZRZUTY — brak (uczciwe odnotowanie)

Ta sama sytuacja co F5a: worktree nie ma `launch.json`, root `.env.local`
celuje w PROD centerbeam — zgodnie z regułą "Prod caution" NIE uruchomiono
serwera. Inna sesja ma dev server aktywny na tym samym folderze, ale
preview_* tools tej sesji go nie widzą (osobny proces/port) i podłączanie się
do cudzego serwera bez wiedzy o jego stanie/danych byłoby ryzykowne.

**Dowód zastępczy = testy jednostkowe (zielone) + code review:**
- `processFlowViewState.test.ts` — 19/19 (walidacja viewport, normalizacja
  showGrid/snap w tym regresja "false pozostaje false", fallback blob→
  localStorage→null).
- `processFlowNodeComments.test.ts` — 11/11 (mentions, build/append/remove,
  immutability).
- Pełny pakiet `tests/unit/mywork/` + `processflow/`: **238/238 passed**;
  jedyny fail na poziomie suite = `myWorkMainContentLayout.test.ts`
  (`highlight.js/lib/core` resolution — pre-istniejący, niezwiązany).
- `npm run type-check`: patrz commit — 0 błędów w całym projekcie w chwili
  uruchomienia (różni się od F5a's "8 pre-istniejących poza zakresem" —
  możliwe że zostały naprawione między F5a i teraz, albo licznik bazowy się
  zmienił; nie badano różnicy pre-istniejących błędów szczegółowo poza
  potwierdzeniem 0 total).

## Do żywej weryfikacji (bramka R6 u Piotra)

- B1: zmień grid/snap/zoom, zapisz, przeładuj — sprawdź że wraca dokładnie
  to samo (w tym pozycja kamery).
- B3: dodaj komentarz na węźle PF, przeładuj — sprawdź że zostaje (blob).
  Sprawdź @mention podświetlenie, usuwanie własnego komentarza.
- B2: potwierdź że decyzja "zostaw własne menu" jest akceptowalna (nie
  wymaga dalszej pracy w tej fali).
