# 01 — Inwentarz powierzchni UI z akcjami (Idea Workspace)

**Data:** 2026-07-23 · **Metoda:** synteza 12 zweryfikowanych dokumentów powierzchni (`Harvard/wdrozenie-100/_RAIL_LEWY_*`, `_PRAWY_PANEL_*`, `_KONTEKST_*`, `_MENU3_*`) + grep kodu. Część potwierdzona wzrokiem na żywej aplikacji, część kodowo — oznaczone w dokumentach źródłowych.

Idea Workspace = jeden graf pomysłu (`nodes`/`edges`/`extensions`) renderowany przez jedno z 4 narzędzi (Mind Map · Whiteboard · Process Flow · Table). Powłoka wspólna (`IdeaMapWorkspace` → `IdeaCanvasMelsView` → EditorShell) od nocy 22.07 domyślnie ON (flaga `ff_melsCanvas`).

## Tabela powierzchni

| # | Powierzchnia | Plik / komponent | Kiedy widoczna | Widoki | Wspólna/specyficzna |
|---|---|---|---|---|---|
| 1 | **Menu 1 — top bar (tożsamość)** | `IdeaCanvasMelsView` (TopBar) + `IdeaCanvasMenu1Bits.tsx` + `ideaCanvasMelsChips.ts::buildIdeaMenu1Chips` | zawsze | 4 | wspólna |
| 2 | **Menu 3 — second bar (akcje widoku)** | `IdeaCanvasSecondBar.tsx` + `ideaCanvasMelsChips.ts::buildIdeaMenu3Actions`, wpięte w `IdeaMapWorkspace.tsx` ~L2919 | zawsze | 4 | wspólna (deskryptory) + własny pasek narzędzia nakładany |
| 2b| — własny pasek Mind Map | `IdeaWorkspaceToolbar.tsx` | Mind Map | 1 | specyficzna |
| 2c| — własny pasek Whiteboard | `whiteboard/WhiteboardToolbar.tsx` (+Primitives) | Whiteboard | 1 | specyficzna |
| 2d| — własny pasek Process | `processflow/ProcessFlowToolbar.tsx` | Process | 1 | specyficzna |
| 2e| — własny pasek Table (P15) | `table/TableToolbar.tsx` (zakładki Data/Forms/Interfaces/Models/Workflow + Tools) | Table gdy `usePlatform` | 1 | specyficzna |
| 2f| — własny pasek Table (legacy) | JSX w `IdeaTableTool.tsx` ~L1480-2400 (płaski rząd ~20 ikon) | Table gdy `!usePlatform` | 1 | specyficzna |
| 3 | **Lewy pionowy rail** | `mindmap/CanvasLeftToolbar.tsx` (współdzielony przez 4) | tryb płótna | 4 (Table b/z sensu) | wspólny szkielet + sloty per narzędzie |
| 4 | **Prawy pionowy rail (ikony-zakładki)** | EditorShell `RightRail.tsx` + `ideaCanvasMelsChips.ts::buildIdeaCanvasRightRailTools` (5 ikon: problem/status/inspector/convert/health) | zawsze | 4 | wspólna |
| 5 | **Prawy panel (treść zakładek)** | `IdeaWorkspaceTools.tsx` przez `renderMelsCanvasRightRailPanel` | po kliknięciu ikony railа | 4 | wspólna — ⚠ nie przełącza treści per zakładka |
| 6 | **Pływający pasek zaznaczenia — Mind Map** | `mindmap/FloatingNodeToolbar.tsx` | zaznaczony węzeł | 1 | specyficzna |
| 6b| — Process | `processflow/ProcessFlowFloatingToolbar.tsx` | zaznaczony węzeł | 1 | specyficzna |
| 6c| — Whiteboard | `whiteboard/WhiteboardSelectionBar.tsx` | zaznaczony element | 1 | specyficzna |
| 7 | **Menu kontekstowe — tło (pane)** MM | `mindmap/PaneContextMenu.tsx` | prawy klik na pustym płótnie | 1 | specyficzna |
| 7b| — tło Whiteboard/Process | `IdeaCanvasContextMenu.tsx` (+ `useIdeasToolContextMenu.ts` = MARTWY) | prawy klik | 2 | wspólna (część) |
| 8 | **Menu kontekstowe — węzeł** MM | `mindmap/NodeContextMenu.tsx` (otwierane też przez „⋮" pływającego paska) | prawy klik na węźle | 1 | specyficzna |
| 8b| — element Whiteboard | via `IdeaCanvasContextMenu` | prawy klik | 1 | wspólna |
| 8c| — krok Process | `processflow/ProcessFlowContextMenu.tsx` | prawy klik na kroku | 1 | specyficzna |
| 9 | **Menu kontekstowe — krawędź** MM | `mindmap/EdgeContextMenu.tsx` | prawy klik na krawędzi | 1 | specyficzna |
| 9b| — krawędź Process | brak prawego-klik; lewy-klik `EdgeStylePopover.tsx` | klik na krawędzi | 1 | specyficzna |
| 9c| — krawędź Whiteboard | brak (`onEdgeContextMenu` nieobecne) | — | — | brak |
| 10| **Table — menu wiersza** | prawy klik `<tr>` `IdeaTableTool.tsx:1304` (legacy) / bogatsze w P15 | prawy klik na wierszu | Table | specyficzna, różne per implementacja |
| 11| **Table — menu komórki** | NIE ISTNIEJE (brak `onContextMenu` w cell renderers) | — | — | brak |
| 12| **Table — menu nagłówka kolumny** | prawy klik `<th>` `IdeaTableTool.tsx:2922` (legacy: Rename/Sort/Hide/Delete); P15 brak prawego-klik (toolbar + FieldManager) | prawy klik na nagłówku | Table | specyficzna, tylko legacy |
| 13| **Menu 1 kebab „⋮"** | `buildIdeaMenu1Chips` (Eksport·Historia·Duplikuj·Usuń·Szukaj·Skróty) | klik kebab | 4 | wspólna (część pozycji disabled) |
| 14| **„Więcej / More" per narzędzie** | Process: `ProcessFlowToolbar` overflow; Table: „…" P15 | overflow paska | per narzędzie | specyficzna |
| 15| **Skróty klawiszowe** | `hooks/useKeyboardShortcuts.tsx`, `mindmap/useMindMapQuickActions`, `canvas/useIdeasToolKeyboard.ts` | zawsze | 4 | mieszane |
| 16| **Command palette** | `CommandPalette.tsx` + `useCommandPalette`, mindmap `MindmapCommandPalette.tsx` | skrót (Cmd+K) | 4 / MM | wspólna + MM |
| 17| **Tryb warsztatowy (facilitacja)** | `IdeaWhiteboardTool` + `server/.../facilitationPhaseMachine.ts` (role/fazy/głosowanie/timer/follow-me) | Whiteboard | Whiteboard | specyficzna |
| 18| **Zdrowie mapy (widget)** | `mindmap/MapHealthScore.tsx` (pływający, nie część paska) | Mind Map | 1 | specyficzna |
| 19| **Modale/popovery z akcjami** | `IdeaExportMenu`, `IdeaTemplateGallery`, `IdeaConvertMenu`, `ConvertToDialog`, `SnapshotHistory`, `IdeaProposalReview`, `IdeaAISuggestionsPanel`, `IdeaNodeDetailDrawer` | kontekstowo | różne | mieszane |

## Kluczowe obserwacje strukturalne
- **19 typów powierzchni**, z czego ~7 wspólnych (powłoka) i reszta specyficzna per narzędzie.
- **Table jest osobnym światem:** nie płótno, dwie implementacje (legacy/P15), brak menu komórki, menu nagłówka tylko w legacy, nie używa wspólnego `useIdeasToolContextMenu`.
- **Powierzchnie wspólne powłoki (Menu 3, lewy rail popovery, prawy panel) reużywają wiring Mind Mapy** → w pozostałych narzędziach część akcji martwa (patrz 07/08).
- **Krawędzie** prawie nigdzie nie mają menu (MM ma, Process ma tylko styl-popover, Whiteboard nic).

Szczegóły per pozycja (etykiety, skróty, co robi, stan) — w dokumentach źródłowych `_RAIL_LEWY_*`, `_KONTEKST_*`, `_MENU3_*`, `_PRAWY_PANEL_*`. Macierz akcji: `02_ACTION_MATRIX.md`.
