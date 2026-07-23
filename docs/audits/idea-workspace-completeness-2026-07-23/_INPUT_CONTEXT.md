# Kontekst wejściowy dla audytu kompletności Idea Workspace

**Repo/worktree:** `/private/tmp/odbior-4` (gałąź `odbior/lokalny-2026-07-23`, = origin/demo + IDEE Fala 6-10 + karty N). Cały audyt czytaj i pisz TUTAJ.
**Katalog wyników:** `docs/audits/idea-workspace-completeness-2026-07-23/`
**Tryb:** CZYSTO KODOWY. NIE uruchamiaj żywej aplikacji (kilka sesji jednocześnie powodowało cross-switching). NIE `git add`/`git commit`.

## Już zrobiona dokumentacja powierzchni (CZYTAJ jako wejście, nie powielaj)
W `Harvard/wdrozenie-100/`:
- `_RAIL_LEWY_{MINDMAP,WHITEBOARD,PROCESSFLOW,TABELA}_2026-07-23.md` — lewy pionowy rail per narzędzie.
- `_PRAWY_PANEL_IDEE_2026-07-23.md` — prawy panel (5 zakładek: problem/status/inspector/convert/health).
- `_KONTEKST_{...}_2026-07-23.md` — menu kontekstowe (prawy klik + pasek zaznaczenia) per narzędzie.
- `_MENU3_{...}_2026-07-23.md` — górny pasek akcji (Menu 3) per narzędzie.

## Kluczowe pliki kodu (punkty startowe grep)
- Powłoka: `src/components/MyWork/IdeaMapWorkspace.tsx` (host, ~3900 linii — grep, NIE czytaj w całości), `IdeaCanvasMelsView.tsx`, `IdeaCanvasSecondBar.tsx`, `ideaCanvasMelsChips.ts` (buildIdeaMenu1Chips/buildIdeaMenu3Actions/buildIdeaCanvasRightRailTools).
- Powłoka EditorShell: `src/components/shared/ExecutiveModuleShell/` (RightRail/TopBar/index).
- Mind Map: `mindmap/CanvasLeftToolbar.tsx`, `FloatingNodeToolbar.tsx`, `{Node,Pane,Edge}ContextMenu.tsx`, `useMindMapQuickActions.ts`, `useAutoLayout.ts`, `MapHealthScore.tsx`, `SnapshotHistory.tsx`, `IdeaRecommendationMap.tsx`.
- Process: `processflow/ProcessFlowToolbar.tsx`, `ProcessFlowFloatingToolbar.tsx`, `ProcessFlowContextMenu.tsx`, `useProcessFlowQuickActions.ts`, `validateFlow.ts`, `useProcessFlowExport.ts`, `EdgeStylePopover.tsx`.
- Whiteboard: `whiteboard/WhiteboardToolbar.tsx`, `WhiteboardSelectionBar.tsx`, `useWhiteboardQuickActions.ts`, `useWhiteboardNodes.ts`, facilitacja: `server/src/services/facilitationPhaseMachine.ts`.
- Table: `IdeaTableTool.tsx` (legacy), `table/ViewRouter.tsx` + `TableToolbar.tsx` (platform P15), `useTablePlatformIntegration.ts`, `useTablePlatformBridge.ts`, `tablePlatformMappers.ts`.
- API klient: `src/services/api.ts` (grep `my-work`, `my-ideas`, `link-graph`, `table-platform`, `facilitation`, `map/`, `expand`).
- Backend trasy: `server/src/routes/my-work.routes.ts`, `server/src/Gateway.ts` (montaż `/api/my-work`), `server/src/routes/*table*`, `server/src/services/`.
- Flagi: `src/utils/melsCanvasFlag.ts` (`ff_melsCanvas`), `src/hooks/useFeatureFlags.tsx`, grep `usePlatform`, `tablePlatformMetadataFirst`, `mindmapHeuristicAiOverlays`, `mindmapMultiToolbar`, `mindmapAlignSnap`, `vf1CanvasSpecA`.
- Zdarzenia: grep `CustomEvent`, `dispatchEvent`, `idea-workspace-`, `idea-mindmap-`, `idea-whiteboard-` w `src/components/MyWork/`.

## ★ Ustalenia już potwierdzone (nie badaj od nowa — użyj i rozwiń)
1. **Wspólny root-cause (3 powierzchnie):** powłoka (Menu 3 `buildIdeaMenu3Actions`, lewy rail popovery AI/Import/Więcej, prawy panel) używa akcji **Mind Mapy** (`mm_*`, `add_node`, zdarzenie `idea-mindmap-node-quick-action`) dla WSZYSTKICH 4 narzędzi, zamiast rozgałęziać per `activeTool`. Obsługuje je tylko `useMindMapQuickActions.ts` montowany wyłącznie w Mind Mapie (`IdeaRecommendationMap`). Skutek: martwe kliki w WB/Process/Table (np. „Dodaj kształt", „AI rozwiń", „Dodaj karteczkę").
2. **Prawy panel:** 5 zakładek (problem/status/inspector/convert/health) — `renderMelsCanvasRightRailPanel(_activeToolId)` IGNORUJE id (podkreślnik) → wszystkie ikony pokazują ten sam pełny panel. Host nie przekazuje `activeRightToolId`/`onSelectRightTool`. Brak sekcji Powiązania + Komentarze względem kanonu SPEC-A.
3. **`useIdeasToolContextMenu.ts`** — opisany jako wspólne menu ze skrótami, jest MARTWYM KODEM (zero importów).
4. **Table = dwie implementacje:** legacy (`IdeaTableTool.tsx`) vs platform P15 (`ViewRouter`/`TableToolbar`), flaga `usePlatform`. Menu/paski się różnią. Obiekt testowy renderuje legacy.
5. **Flaga `ff_melsCanvas` domyślnie ON** od nocy 22.07 → dwa paski nałożone (powłoka + własny pasek narzędzia).
6. **Process defekty:** „Wklej" woła duplicateSelected (brak schowka); „Wstaw między" wymaga krawędzi → zwykle błąd; Delete na krawędzi nic nie robi; „Brak ostrzeżeń" to pusty stan początkowy (aktualizuje po „Waliduj"); „Kroki N" liczy sieroty.
7. **Facilitacja Whiteboardu** REALNA (backend `facilitationPhaseMachine.ts`, `Api.facilitation*`).
8. **Historia wersji** = `SnapshotHistory` (per-idea, łapie extensions). „Zdrowie mapy" = osobny pływający widget `MapHealthScore`, nie część paska.

## Obiekty testowe (gdyby były potrzebne — ale tryb kodowy nie wymaga)
mindmap 8d97381d · whiteboard f28b328d · process 55ad699b · table 5b0000c2.

## Konwencja wyników
Każdy plik: nagłówek + data + „metoda: analiza kodu (grep-first)". Tabele wg schematów z zlecenia. To, co niepewne, oznacz „niepotwierdzone (kod)". Po polsku, rzeczowo.
