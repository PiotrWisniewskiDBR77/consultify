# M07 F5 — SPEC: Edge UX klasy Lucidchart + polish unifikacyjny
**Autor logiki:** Fable 5 (orkiestrator M07) · 2026-07-04 · **Wykonawcy:** Opus (F5a), Sonnet (F5b), Haiku (sweep)
**Baza:** worktree `.claude/worktrees/agent-a4140c9776c425306`, gałąź `feat/m07-finisz` PO F4. Sekwencyjnie (te same pliki — zero równoległości).

## Reżim wizualny (NADRZĘDNY)
Protokół po nocy 3/4.07: zmiany wyglądu budujemy w `feat`, ale **NIE scalamy bez akceptacji Piotra na zrzutach**. Każda podfala MUSI wyprodukować zrzuty do `docs/qa/runs/2026-07-04-m07-f5/` (przez preview jeśli odpali się dev; jeśli nie — jasno odnotować brak). Wyłącznie tokeny `var(--c-*)`; ZERO nowych kolorów, ZERO crimson-leak (użyj neutrali/`--c-info` jak w F3). i18n PL/EN dla nowych stringów.

## Zakres (z audytu L-04 + G6)
Cel: podnieść jakość krawędzi i domknąć unifikację UI, bez ruszania logiki persystencji/collab (F3/F4 stoją).

---

## F5a — Edge UX (Opus, canvas-heavy)
### A1. Routing ortogonalny + waypointy
- Dziś krawędzie to proste/domyślne bezier. Dodaj tryb ortogonalny (segmenty poziom/pion) jako opcję renderowania w `FlowEdgeComponent.tsx`.
- Waypointy: możliwość dodania punktów załamania przez double-click na krawędzi + drag; przechowuj w `edge.data.waypoints: {x,y}[]`; persystuje się przez istniejący blob (edges w payloadzie) — NIE dotykaj warstwy zapisu.
- Auto-routing omijający węzły: prosty algorytm (nie A* pełny) — wystarczy L/Z-routing z odsunięciem od bounding-boxów źródła/celu. Czysta funkcja `routeOrthogonal(source, target, waypoints?)` w nowym `processflow/edgeRouting.ts` — TESTOWALNA jednostkowo bez DOM.
### A2. Typy krawędzi
- Przywróć realną użyteczność typów: `sequence` (domyślny, strzałka pełna), `conditional` (etykieta Yes/No, już częściowo jest), `message` (przerywana — UWAGA: `MessageFlowEdge` usunięty w F1; jeśli chcesz message-flow, odtwórz jako wariant `FlowEdgeComponent` z `data.edgeKind='message'`, NIE przywracaj martwego osobnego komponentu). Selektor typu w istniejącym edge-toolbarze/context-menu.
### A3. Lane resize/collapse
- Swimlane: uchwyt zmiany szerokości/wysokości toru (NodeResizer jest już w zależnościach — `@reactflow/node-resizer`); collapse/expand toru (zwinięcie chowa węzły toru, ikonka w nagłówku lane w `LaneSystem.tsx`). Stan `collapsed`/rozmiar w `extensions.processFlow.lanes[].{collapsed,width,height}`.
- Testy: `edgeRouting.test.ts` (ortogonal L/Z, waypointy, omijanie bboxa), plus jednostkowe dla collapse-state reducer jeśli wydzielisz.
- ZRZUTY: krawędź ortogonalna z waypointem; 3 typy krawędzi; tor zwinięty i rozwinięty.

## F5b — Polish unifikacyjny (Sonnet, po commit F5a)
### B1. viewState czytany przy hydracji (bug L-04)
- `viewState` (layoutMode/showGrid/snap/zoom/pan) jest zapisywany, nigdy nie odczytywany. Przy hydracji przywróć zapisany `viewState` z `extensions.processFlow.viewState`. UWAGA reżim wizualny: to przywraca WŁASNE ustawienia użytkownika (grid/snap) — dołącz zrzut before/after do akceptacji.
### B2. Wspólny context menu (P8 unifikacji)
- Rozważ adopcję wspólnego `IdeaCanvasContextMenu` (używa Whiteboard) w miejsce własnego `ProcessFlowContextMenu`, JEŚLI wspólny obsłuży PF-owe akcje (add node per shape, lane ops). Jeśli wspólny jest za ubogi — ZOSTAW własny i tylko odnotuj (nie rozbudowuj wspólnego, to cudzy plik). Decyzja: preferuj minimalne ryzyko.
### B3. Komentarze na węzłach
- Mind Map ma `NodeCommentThread`. Dodaj analogiczny wątek komentarza na węźle PF (dane w `node.data.comments[]`, persystencja przez blob). Jeśli komponent Mind Mapy da się użyć bez modyfikacji jego pliku (import + props) — użyj; jeśli wymaga zmian wspólnego pliku — zrób lokalną kopię w `processflow/`. ZRZUT wątku.
### B4. Sweep (Haiku, na końcu)
- Usuń pre-istniejące martwe importy odnotowane wcześniej (`MessageSquare` w IdeaProcessFlowTool jeśli nadal martwy po F5a), zbłąkane tokeny hex→`var(--c-*)` jeśli jakieś F5a wprowadził. Czysto mechaniczne, zero zmian zachowania.

---

## Testy i bramki (każda podfala)
- `npx vitest run tests/unit/mywork/ src/components/MyWork/processflow/ 2>&1 | tail -20` — PF zielone; znane faile highlight.js ignoruj+odnotuj.
- `npm run type-check` — zero nowych błędów w M07/processflow.
- Commity osobne per podfala (`feat(processflow): orthogonal edge routing + waypoints (F5a)` itd.).

## Kolejność wykonania
F5a (Opus) → commit → F5b B1-B3 (Sonnet) → commit → B4 sweep (Haiku) → commit. Wszystko w tym samym worktree, sekwencyjnie. NIE pushować, NIE mergować.

## Bramka R6 (finalna, u Piotra)
Prezentacja WSZYSTKICH zrzutów F5 do akceptacji wizualnej + żywy dwukliencki E2E (F3) + przełączanie narzędzi (F4). Merge do Londyn/demo dopiero po „tak" Piotra.
