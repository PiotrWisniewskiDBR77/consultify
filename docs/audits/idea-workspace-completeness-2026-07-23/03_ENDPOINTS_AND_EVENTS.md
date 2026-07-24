# 03 — Endpointy i eventy (Idea Workspace: Mind Map / Process / Whiteboard / Table / powłoka)

**Data:** 2026-07-23 · **Metoda:** analiza kodu (grep-first), read-only, worktree `/private/tmp/odbior-4` (gałąź `odbior/lokalny-2026-07-23`). Aplikacja NIE była uruchamiana — wszystkie ustalenia to statyczna analiza wywołań/nasłuchów. Niepewne miejsca oznaczone „niepotwierdzone (kod)".

Kotwice: `src/services/api.ts`, `server/src/routes/my-work.routes.ts`, `server/src/routes/realtime-platform.routes.ts`, `server/src/Gateway.ts`, `server/src/gateways/ideaCollabWs.gateway.ts`, `src/components/MyWork/**`.

---

## 1. REST — rdzeń grafu pomysłu (`/api/my-work/my-ideas/:id/...`)

Wszystkie 4 narzędzia (Mind Map/Process/Whiteboard/Table) współdzielą JEDEN graf per idea (`nodes`/`edges`/`extensions`, pole `preferredTool`). Trasy zweryfikowane 1:1 klient (`src/services/api.ts`) ↔ serwer (`server/src/routes/my-work.routes.ts`).

| Endpoint | Metoda | Klient (`Api.*`) | Kto wywołuje (UI) | Zmienia dane | Błędy | Historia | Undo | Używany |
|---|---|---|---|---|---|---|---|---|
| `/my-ideas/:id/map` | GET | `getMyIdeaMap` | wszystkie 4 hosty przy otwarciu (`IdeaMapWorkspace`, `IdeaProcessFlowTool`, `IdeaWhiteboardTool`, `useMindMapPersistence`, `useTablePersistence`, `workspaceGraphRuntime`, `CrossTableRelations`, nawet `UnifiedChatPanel` (Teresa) | nie (read) | `handleResponse` → throw | nie | — | TAK, wspólny |
| `/my-ideas/:id/map` | PUT | `saveMyIdeaMap` | tylko `table/useIdeaGraphStore.ts` (legacy table full-save) | tak (nadpisuje graf, `version`) | tak | nie (bez snapshotu) | nie | TAK, tylko-jeden-widok (legacy Table) |
| `/my-ideas/:id/map/sync` | POST | `syncMyIdeaMap` | **wspólny autosave** — `useIdeaMapSync.ts` (MM/WB/Process/Table przez `useMindMapPersistence`/`useTablePersistence`/host-y) | tak (`baseVersion` optimistic-lock, `keepalive` na teardown) | tak (409 conflict → `onConflict`) | pośrednio (może `createSnapshot`) | nie wprost | TAK, wspólny (rdzeń autosave) |
| `/my-ideas/:id/map/expand` | POST | `expandMyIdeaMap` | `IdeaRecommendationMap`, `IdeaTemplateGallery`, `useMindMapQuickActions.ts`, `UnifiedNodeDetailDrawer`, `NodeDetailDrawer` | tak (AI dopisuje węzły) | tak | nie wprost | nie | TAK, głównie Mind Map |
| `/my-ideas/:id/map/export/pptx` | POST | `exportMyIdeaMapPptx` | `mindmap/ExportPowerPoint.tsx` | nie | tak (rzuca z komunikatem serwera) | nie | — | TAK, tylko Mind Map |
| `/my-ideas/:id/map/ai-suggestions` | POST | `getMyIdeaAISuggestions` | 11 komponentów mindmap (`AISentimentOverlay`, `AIPriorityRecommender`, `AIAutoClustering`, `BranchSummaryPanel`, `DocumentToMap`, `InterviewToMap`, `AICompetitiveLandscape`, `AIDependencyDetector`, `AIWhatIfScenarios`, `NodeDetailDrawer`, `UnifiedNodeDetailDrawer`) + `IdeaRecommendationMap` | nie (read-AI) | tak | nie | — | TAK, wyłącznie Mind Map (⚠ tylko-jeden-widok — WB/Process/Table nie mają dostępu do tych AI-nakładek) |
| `/my-ideas/:id/map/gap-analysis` | POST | `getMyIdeaGapAnalysis` | `mindmap/AIBlindSpotsDetector.tsx` | nie | tak | nie | — | TAK, tylko Mind Map |
| `/my-ideas/:id/map/snapshots` | GET/POST | `getMyIdeaMapSnapshots` / `createMyIdeaMapSnapshot` | `mindmap/SnapshotHistory.tsx` (montowany w `IdeaMapWorkspace` — kebab „Historia", **dostępny ze wszystkich 4 narzędzi**, komentarz w kodzie: „Historia works for every canvas tool") + `useIdeaMapSync.ts` (auto-snapshot przy `flushSync({createSnapshot:true})`) | tak (tworzy wpis) | tak | TAK — to JEST historia | TAK (restore) | TAK, wspólny |
| `/my-ideas/:id/map/snapshots/:id` | DELETE | `deleteMyIdeaMapSnapshot` | `mindmap/SnapshotHistory.tsx` | tak (usuwa snapshot) | tak | — | — | TAK |
| `/my-ideas/:id/activity` | GET/POST | `getMyIdeaActivity` / `createMyIdeaActivity` | `mindmap/ActivityFeed.tsx`, `IdeaTableTool.tsx` (import obecny) | tak (log wpisu) | tak | TAK (log) | nie | TAK, ale **tylko Mind Map + legacy Table** — brak w Whiteboard/Process (nie zaimportowane) |
| `/my-ideas/:id/map/nodes/:nodeId/comments` | GET/POST/DELETE | `getNodeComments`/`addNodeComment`/`deleteNodeComment` | `mindmap/NodeCommentThread.tsx`, `IdeaNodeDetailDrawer.tsx`, `UnifiedNodeDetailDrawer.tsx`, `processflow/nodeComments.ts` | tak | tak | nie (osobno od snapshotów) | tylko delete | TAK, Mind Map + Process |
| `/my-ideas/:id/ai-generate` | POST | `generateIdeaAI` | **wspólny** przez wrapper `src/services/ideaAIGenerator.ts`, importowany w `IdeaProcessFlowTool`, `IdeaWhiteboardTool`, `IdeaCanvasContextMenu`, `IdeaMapWorkspace`, `IdeaNodeDetailDrawer`, `mindmap/UnifiedNodeDetailDrawer`, `table/useTableQuickActions.ts` | tak (generuje węzły/kroki) | tak | nie wprost | nie | TAK, **poprawnie wspólny dla 4 narzędzi** (kontrast do bugu quick-actions, sekcja 2) |
| `/my-ideas/:id/develop` (SSE) | POST | `developMyIdeaSSE` | **BRAK wywołań** w `src/` | — | — | — | — | **NIEUŻYWANY (martwy)** |
| `/my-ideas/:id/ai-suggestions` (poziom idei, nie map) | POST | *(patrz uwaga)* — istnieje osobno `getIdeaAISuggestions` (offset ~4801) | niepotwierdzone (kod) — nazwa koliduje z `getMyIdeaAISuggestions`; nie potwierdzono osobnego callera | — | — | — | — | niepotwierdzone (kod) |
| `/my-ideas/:id/ai-table-action` | POST | `getIdeaAITableAction` | `table/AITableAssistant.tsx` | tak (AI edytuje tabelę) | tak | nie | nie | TAK, tylko Table |
| `/my-ideas/:id/ai-fill` | POST | `getIdeaAIFill` | `IdeaTableTool.tsx`, `table/InlineAIFill.tsx` | tak | tak | nie | nie | TAK, tylko Table |
| `/my-ideas/metrics/map` | GET | `getMyIdeaMapMetrics` | `MyIdeasListContent.tsx` | nie | tak | — | — | TAK, ale to lista `/my-work`, nie Workspace samo |
| `/my-ideas/:id/convert` | POST | `convertMyIdea` | `IdeaMapWorkspace.tsx` (`handleConvert`, wołane z Menu1/Menu3/prawego panelu „Convert") + `MyIdeasListContent.tsx` | tak (tworzy initiative/task_set/decision/report/presentation, zwraca `sourceSessionId`) | tak | nie wprost (ale `sourceSessionId` łączy z sesją) | nie | TAK, wspólny (przez `CONVERT_PREFIX_MAP` rozgałęziający `wb_*/pf_*/tbl_*/mm_*` prefiksy w `handleQuickAction`) |
| `/my-ideas/:id/clusters/materialize` | POST | `materializeIdeaClusters` | **BRAK wywołań** w `src/` | — | — | — | — | **NIEUŻYWANY (martwy)** — cała rodzina V4-IDEA-05 |
| `/my-ideas/:id/clusters/:clusterId/outcome` | POST | `createClusterOutcome` | **BRAK wywołań** | — | — | — | — | **NIEUŻYWANY (martwy)** |
| `/my-ideas/:id/outcomes/:outcomeId/convert` | POST | `convertOutcome` | **BRAK wywołań** | — | — | — | — | **NIEUŻYWANY (martwy)** |
| `/my-ideas/:id/export-csv` | GET | `exportIdeaTableCSV` | **BRAK wywołań** w `src/` (Table eksportuje CSV lokalnie/klientowo zamiast tędy) | — | — | — | — | **NIEUŻYWANY (martwy)** |
| `/my-ideas/:id/presence` | GET/POST | `getIdeaPresence` / `broadcastIdeaPresence` | `table/CollaborationPresence.tsx` (montowany w `IdeaTableTool.tsx` LEGACY i `table/TableToolbar.tsx` PLATFORM) | tak (zapis kursora/komórki) | tak | nie (efemeryczne) | — | TAK, tylko Table (poll-REST, nie WebSocket — patrz sekcja 3) |
| `/my-ideas/:id/duplicate` | POST | `duplicateMyIdea` | `IdeaMapWorkspace.tsx` (kebab „Duplikuj") | tak (klon idei+mapy) | tak | — | — | TAK |
| `/my-ideas/:id/opened` | POST | `markMyIdeaOpened` (nazwa przybliżona) | niepotwierdzone (kod) — offset 4523, nie zweryfikowano callera | — | — | — | — | niepotwierdzone (kod) |

**Legacy idea-edges (`/my-ideas/:ideaId/edges`)** — osobna, starsza rodzina CRUD (GET/POST/DELETE, offset ~4636-4663 w `api.ts`), równoległa do `map`/`map/sync`. Callerzy niepotwierdzeni w tym przebiegu (kod) — prawdopodobnie relikt sprzed ujednolicenia na `map`.

---

## 2. REST — link-graph i artefakty

| Endpoint | Metoda | Klient | Kto wywołuje | Uwagi |
|---|---|---|---|---|
| `/link-graph/backlinks` | GET | `getLinkGraphBacklinks` | `IdeaContextPanel.tsx` (Idea Workspace), `TaskDetailView.tsx`, `notebook/NotebookBacklinksBar.tsx`, `notebook/NotebookContextPanel.tsx` | TAK, używany w Idea Workspace (prawy panel „problem"/inspector — kontekst wsteczny) |
| `/link-graph/edges` | POST | `createLinkGraphEdge` | `IdeaMapWorkspace.tsx` (2065 — „attach knowledge"), `NotebookContent.tsx`, `TaskDetailView.tsx`, `notebook/NotebookContextPanel.tsx` | TAK |
| `/link-graph/edges/:edgeId` | DELETE | `deleteLinkGraphEdge` | tylko `TaskDetailView.tsx` | **BRAK w Idea Workspace** — nie ma UI do usuwania backlinku z poziomu Mind Map/WB/Process/Table, mimo że tworzenie (`createLinkGraphEdge`) jest dostępne. Potencjalna **BRAKUJĄCA akcja** (jeśli UI sugeruje możliwość odpięcia linku w prawym panelu) |
| `/my-ideas/:ideaId/objects/:objectId/artifacts` | GET/POST | `attachArtifactToObject` i pokrewne | niepotwierdzone (kod) w kontekście Idea Workspace wprost — offset 5278+ | niepotwierdzone (kod) |

## 3. REST — Table Platform (`/api/table-platform/*`)

Zakres OGROMNY (osobny system P15) — tu tylko część dotykana z poziomu Idea Workspace/Table:

| Endpoint (fragment) | Kto wywołuje | Uwaga |
|---|---|---|
| `/table-platform/tables/:id/export/xlsx` | `src/utils/artifactLinks.ts` (link budowany, otwierany w nowej karcie — nie `fetch` przez `Api`) | poza `Api` — bezpośredni URL |
| `/table-platform/tables/:id/export.csv` | `src/utils/tabeleArtifactOpen.ts` | jw. |
| `/table-platform/tables/:id/duplicate` | `IdeaTableTool.tsx:871` | POST bezpośrednio przez `Api.post`, nie osobna metoda |
| `/table-platform/tables/:id/audit` | `table/AuditTrailPanel.tsx`, `table/ActivityFeed.tsx` | historia zmian **tylko gdy `tableId` to prawdziwy `tp_tables.id`** (Platform-mode); legacy idea-table (map/blob) nie ma audytu |
| `/table-platform/records/:id`, `/tables/:id/records`, `/tables/:id/fields` | `table/extensions/ExtensionHost.tsx`, `table/offline/useOfflineAware.ts` | rozszerzenia (marketplace) i offline queue — osobna warstwa P15, nie „idea graph" |
| Socket.IO namespace `/table-platform` | `table/useTableRealtime.ts` | patrz sekcja realtime niżej |

Reszta `table-platform.*.routes.ts` (ai-editor, conversion, form-intake/public, qa, record-sources, relations-explain, source-pack) montowana w `Gateway.ts` — POZA zakresem tego audytu (Idea Workspace dotyka tylko podzbioru wyżej); traktować jako osobny system.

## 4. REST — Facilitacja Whiteboardu (`/api/realtime-v4/facilitation/*`)

Backend realny: `server/src/services/facilitationPhaseMachine.ts`, trasy w `server/src/routes/realtime-platform.routes.ts` (montaż `/api/realtime-v4`).

| Endpoint | Metoda | Klient (`Api.facilitation*`) | Kto wywołuje | Używany |
|---|---|---|---|---|
| `/facilitation/sessions` | POST | `facilitationCreateSession` | `IdeaWhiteboardTool.tsx:1308` | TAK |
| `/facilitation/sessions/by-tool/:toolSessionId` | GET | `facilitationResolveByTool` | `IdeaWhiteboardTool.tsx:2424` | TAK |
| `/facilitation/sessions/:id` | GET | `facilitationGetSession` | `IdeaWhiteboardTool.tsx:1318,2456` | TAK |
| `/facilitation/sessions/:id/timer` | PUT | `facilitationUpdateTimer` | `IdeaWhiteboardTool.tsx:1483,2349,2367` | TAK |
| `/facilitation/sessions/:id/phase` | PUT | `facilitationUpdatePhase` | `IdeaWhiteboardTool.tsx:1516,1545,1569` | TAK |
| `/facilitation/sessions/:id/votes` | POST/GET | `facilitationCastVote`/`facilitationGetVotes` | `IdeaWhiteboardTool.tsx:2282,1382` | TAK |
| `/facilitation/sessions/:id/votes/summary` | GET | `facilitationGetVoteSummary` | `IdeaWhiteboardTool.tsx:1381` | TAK |
| `/facilitation/sessions/:id/roles` | POST/GET | `facilitationAssignRole`/`facilitationGetRoles` | `IdeaWhiteboardTool.tsx:1292,1369,1439` | TAK |
| `/facilitation/sessions/:id/end` | POST | `facilitationEndSession` | **BRAK wywołań** w `src/` | **NIEUŻYWANY** — brak też widocznego przycisku „Zakończ sesję" w `IdeaWhiteboardTool.tsx` (grep tekstu „Zakończ"/„End session" — 0 trafień). Feature niedokończony: sesja facylitacji nie ma jawnego zamknięcia z UI |
| `/facilitation/sessions/:id/outcomes` | POST/GET | `facilitationCreateOutcome`/`facilitationGetOutcomes` | **BRAK wywołań** — outcomes obsługiwane lokalnie w `IdeaWhiteboardTool.tsx` (`createOutcomeRecord`, stan klienta), NIE przez ten endpoint | **NIEUŻYWANY** — rozjazd: backend ma model outcome/export, UI robi to inaczej |
| `/facilitation/outcomes/:outcomeId/export` (PUT) | PUT | `facilitationExportOutcome` | **BRAK wywołań** | **NIEUŻYWANY** |

---

## 5. CustomEvent / dispatchEvent — szyna eventów (`src/components/MyWork/**`)

Zliczono ~90 unikalnych par dispatch/listen. Poniżej tylko eventy istotne dla Idea Workspace (Mind Map/Process/Whiteboard/Table + powłoka), pogrupowane. „Zgodność" = czy istnieje `addEventListener` dla danej nazwy gdziekolwiek w `src/`.

### 5a. Szyna powłoki (współdzielona, `idea-workspace-*`)

| Event | Dispatch (plik) | Listener (plik) | Status |
|---|---|---|---|
| `idea-workspace-quick-action` | `IdeaMapWorkspace`, `IdeaRecommendationMap`, `IdeaWhiteboardTool` (AI nudge, WhiteboardSelectionBar, sticky/text nodes), `mindmap/MindmapCommandPalette` | `IdeaMapWorkspace.tsx:1049` (JEDEN listener, `handleQuickAction`) | **UŻYWANY, ale patrz defekt niżej** |
| `idea-workspace-insert` | `IdeaMapWorkspace` (×4), `IdeaRecommendationMap` (×8), `mindmap/NodeDetailDrawer`, `mindmap/UnifiedNodeDetailDrawer` | `IdeaMapWorkspace.tsx` (`IDEA_WORKSPACE_INSERT_EVENT`, 4 miejsca nasłuchu) | UŻYWANY |
| `idea-workspace-active-tool` | `IdeaMapWorkspace:463,467` | niepotwierdzone (kod) — nie znaleziono jawnego `addEventListener` dla tej stałej w tym przebiegu | niepotwierdzone (kod), **potencjalnie martwy** — komentarz w kodzie sugeruje że służy Teresie (chat) do wiedzy o aktywnym narzędziu |
| `idea-workspace-theme` | `IdeaMapWorkspace:1079` | `IDEA_WORKSPACE_THEME_EVENT` × 3 nasłuchy | UŻYWANY |
| `idea-workspace-flow-semantic` | `IdeaMapWorkspace:1093` | `IDEA_WORKSPACE_FLOW_SEMANTIC_EVENT` × 1 | UŻYWANY (Process Flow) |
| `idea-workspace-highlight-node` | `IdeaMapWorkspace:1738` | `IdeaRecommendationMap.tsx` | UŻYWANY (Mind Map) |
| `idea-workspace-graph-update` | `IdeaMapWorkspace:686` | `IdeaProcessFlowTool.tsx` | UŻYWANY (Process) |
| `idea-workspace-drill-down` | `IdeaMapWorkspace` (×2) | `IdeaMapWorkspace.tsx` (self) | UŻYWANY |
| `idea-workspace-chat-prompt` | `IdeaContextPanel` (×2), `IdeaRecommendationMap` | `IdeaMapWorkspace.tsx` | UŻYWANY (most Teresa⇄Ideas) |
| `idea-workspace-ai-proposal` | `IdeaProcessFlowTool`, `IdeaTemplateGallery` | `IdeaMapWorkspace.tsx` | UŻYWANY |
| `idea-workspace-open-export-menu` | `IdeaWhiteboardTool:3351` | `IdeaMapWorkspace.tsx` | UŻYWANY |
| `idea-workspace-node-update` | `IdeaCanvasContextMenu`, `VSMNodeComponent` | `IdeaProcessFlowTool.tsx`, `IdeaWhiteboardTool.tsx` | UŻYWANY (Process + Whiteboard) |
| `idea-workspace-attach-knowledge` | `IdeaRecommendationMap`, `table/useTableQuickActions.ts` | `IdeaMapWorkspace.tsx:2537` | UŻYWANY (Mind Map + Table) |
| **`idea-workspace-add-edge`** | `table/RowDetailPanel.tsx:1247` | **BRAK nasłuchu nigdzie w `src/`** | **MARTWY** — klik „Dodaj powiązanie" w panelu wiersza tabeli nie robi nic poza wysłaniem eventu w próżnię |
| **`idea-workspace-link-artifact`** | `table/RowDetailPanel.tsx:1563` | **BRAK nasłuchu** | **MARTWY** — analogicznie, „Powiąż artefakt" z poziomu wiersza tabeli |
| **`idea-workspace-votes-update`** | `IdeaMapWorkspace:3443` | **BRAK nasłuchu** | **MARTWY** |
| **`idea-mindmap-apply-theme`** | `IdeaRecommendationMap:2792` | **BRAK nasłuchu** | **MARTWY** — przełącznik motywu mapy (jeśli widoczny w UI) nie ma efektu |

### 5b. Szyna specyficzna Mind Mapy (`idea-mindmap-*`, `mm-*`)

| Event | Dispatch | Listener | Status |
|---|---|---|---|
| **`idea-mindmap-node-quick-action`** | `IdeaCanvasSecondBar`/Menu3 przez `IdeaMapWorkspace` (auto-layout), `IdeaNodeDetailDrawer`, `IdeaRecommendationMap` (×8), `floating-toolbar/QuickTaskPopover` | `IdeaMapWorkspace.tsx` (1 nasłuch) → deleguje do logiki obsługiwanej realnie tylko gdy **`useMindMapQuickActions.ts` jest zamontowany** (wyłącznie wewnątrz `IdeaRecommendationMap.tsx`, czyli tylko gdy `activeTool==='mindmap'`) | **DEFEKT POTWIERDZONY W KODZIE** (patrz sekcja 6) — dla Whiteboard/Process/Table to klik w próżnię |
| `mm-toggle-collapse` | `IdeaRecommendationMap:1509` | `IdeaRecommendationMap.tsx` (self) | UŻYWANY, lokalny do Mind Map |
| `mm-undo-state` | `IdeaRecommendationMap:2332` | `IdeaMapWorkspace.tsx` | UŻYWANY |
| `mm-activity-update` | `mindmap/ActivityFeed.tsx:97` | `mindmap/ActivityFeed.tsx` (self) | UŻYWANY, lokalny |
| `idea-mindmap-mark-converted` | `IdeaMapWorkspace:2107` | `IdeaRecommendationMap.tsx`, `IdeaWhiteboardTool.tsx` | UŻYWANY (MM + WB) |
| `idea-mindmap-sidekick-context` | `IdeaRecommendationMap:2738` | `floating-toolbar/FloatingAIPopover.tsx`, `toolbar-popovers/AIActionsPopover.tsx` | UŻYWANY, Mind Map |
| `idea-mindmap-rewrite-node` | `IdeaRecommendationMap:4642`, `useMindMapQuickActions.ts:751` | `IdeaMapWorkspace.tsx` | UŻYWANY |
| `idea-mindmap-summarize-branch` | `IdeaRecommendationMap:938`, `useMindMapQuickActions.ts:977` | `IdeaRecommendationMap.tsx` (self, otwiera `BranchSummaryPanel`) | UŻYWANY |
| `idea-mindmap-export-pdf` | `useMindMapQuickActions.ts:607` | `IdeaRecommendationMap.tsx` (self, `exportAsPdf` klientowo) | UŻYWANY, czysto klienckie (bez REST) |
| `idea-mindmap-open-drawer` | `IdeaRecommendationMap:1366` | `IdeaRecommendationMap.tsx` (self) | UŻYWANY |
| `idea-mindmap-node-edit` | `IdeaRecommendationMap` (×2) | `IdeaRecommendationMap.tsx` (self) | UŻYWANY |
| `idea-mindmap-edge-label` | `mindmap/LabeledEdge.tsx` | `IdeaRecommendationMap.tsx` | UŻYWANY |

### 5c. Szyna Whiteboard (`idea-whiteboard-*`)

| Event | Dispatch | Listener | Status |
|---|---|---|---|
| `idea-whiteboard-register-output` | `IdeaMapWorkspace:2093` | `IdeaWhiteboardTool.tsx` | UŻYWANY |
| `idea-whiteboard-cast-vote` | `IdeaVotingMode.tsx:116` | `IdeaWhiteboardTool.tsx` | UŻYWANY |
| `idea-whiteboard-toggle-voting-overlay` | `IdeaWhiteboardTool:1501` | `IdeaMapWorkspace.tsx` | UŻYWANY |
| **`idea-whiteboard-outcomes-changed`** | `IdeaWhiteboardTool:1949` | **BRAK nasłuchu** | **MARTWY** — zmiana listy outcomes (facylitacja) nie propaguje się nigdzie (np. do prawego panelu/Convert) |
| `idea-whiteboard-facilitation-state` | `IdeaWhiteboardTool:2388` | `IdeaMapWorkspace.tsx` | UŻYWANY |
| `idea-whiteboard-navigate` | `IdeaWhiteboardTool` (×2) | `IdeaWhiteboardTool.tsx` (self) | UŻYWANY |
| `idea-whiteboard-set-viewport` | `IdeaWhiteboardTool` (×2) | `IdeaWhiteboardTool.tsx` (self) | UŻYWANY |
| `idea-node-open-detail` | `whiteboard/nodes/CommentPinBadge.tsx` | `IdeaMapWorkspace.tsx` | UŻYWANY |

### 5d. Szyna Table (`tbl-*`, `idea-collab-*`)

| Event | Dispatch | Listener | Status |
|---|---|---|---|
| `tbl-undo-state` | `IdeaTableTool.tsx:1238` | `IdeaMapWorkspace.tsx` | UŻYWANY |
| `idea-collab-graph-patch` / `-graph-version` / `-sync-request` / `-full-state` | `mindmap/CollaborationOverlay.tsx` (odbiera z WebSocket, re-emituje jako CustomEvent) | `idea-collab-graph-patch`/`-graph-version` — nasłuchiwane (2 miejsca każdy, niepotwierdzone dokładne pliki w tym przebiegu, ale potwierdzone że >0) | UŻYWANY, most WS→lokalny stan |

### 5e. Notatnik / inne (poza ścisłym zakresem, dla kompletności)

`notebook-*`, `mywork-open-item`, `mywork-focus-search`, `create-task`, `mark-task-done`, `filter-tasks` — wszystkie mają dopasowane nasłuchy (CommandPalette↔poszczególne widoki). Nie są częścią Idea Workspace sensu stricto, pominięto szczegółową tabelę.

---

## 6. Defekt root-cause potwierdzony w kodzie (rozszerzenie ustalenia #1 z `_INPUT_CONTEXT.md`)

`ideaCanvasMelsChips.ts::buildIdeaMenu3Actions` + `IdeaMapWorkspace.tsx` (~L2919-2953) budują akcje Menu 3 **bez branchowania po `activeTool`** dla części handlerów:

```
onAddPrimary: () => handleQuickAction(activeTool === 'mindmap' ? 'mm_add_child' : 'add_node'),  // ← TO gałęzi poprawnie
onAutoLayout: () => window.dispatchEvent(new CustomEvent('idea-mindmap-node-quick-action', { detail: { action: 'pane_auto_layout' } })),  // ← TO NIE gałęzi
onAIExpand: () => handleQuickAction('mm_ai_expand'),  // ← TO NIE gałęzi
```

`mm_ai_expand` jest obsługiwane WYŁĄCZNIE w `mindmap/useMindMapQuickActions.ts:761` (`if (action === 'mm_ai_expand') handlers.handleAIExpand();`), a ten hook jest montowany WYŁĄCZNIE wewnątrz `IdeaRecommendationMap.tsx` (Mind Map). Whiteboard/Process/Table nie montują tego hooka.

**Dodatkowe miejsce tego samego defektu** (nowe, nie było w ustaleniach wejściowych): `IdeaWhiteboardTool.tsx:3655-3661` — własny pasek `IdeaAINudgeStrip` Whiteboardu **też** dispatch'uje `idea-workspace-quick-action` z `action: 'mm_ai_expand'` (i `mm_ai_summarize`). Czyli nawet natywny, wewnątrz-płótnowy przycisk AI Whiteboardu (nie tylko Menu 3 powłoki) trafia w tę samą martwą ścieżkę — klik „Rozwiń AI"/„Podsumuj" w AI Nudge Strip na Whiteboardzie nie ma żadnego efektu.

Weryfikacja: `grep -rl "useMindMapQuickActions" src/components/MyWork` → tylko `IdeaRecommendationMap.tsx`, `mindmap/MindmapCommandPalette.tsx`, sam plik hooka. Whiteboard/Process/Table nieobecne.

---

## 7. Autosave / Sync — wspólna infrastruktura

| Element | Plik | Rola | Współdzielony przez |
|---|---|---|---|
| `useIdeaMapSync` (`queueSync`/`flushSync`, stan `idle→queued→saving→saved→offline→conflict`) | `src/components/MyWork/canvas/useIdeaMapSync.ts` | debounce 2.5s (`DEFAULT_IDLE_MS`) + draft localStorage co 800ms (`DEFAULT_DRAFT_MS`), `keepalive` fetch na `beforeunload`/`visibilitychange` | `IdeaProcessFlowTool`, `IdeaWhiteboardTool`, `IdeaMapWorkspace`, `mindmap/useMindMapPersistence`, `table/useTablePersistence`, `mindmap/CollaborationOverlay`, `processflow/useProcessFlow{AIProposal,Collab,Persistence}` — **potwierdzony jako rzeczywiście wspólny rdzeń dla 4 narzędzi** |
| `buildPersistPayload()` | lokalna funkcja per-host: `IdeaProcessFlowTool.tsx:573`, `IdeaWhiteboardTool.tsx:1273` | kształtuje payload (nodes/edges/lanes/extensions) przed `queueSync`/`scheduleSave` | Process + Whiteboard mają własne wersje; Mind Map/Table budują payload inline (niepotwierdzone jednolitej nazwy) |
| Draft localStorage key | `consultify.idea-map-sync.${ideaId}` (`getDraftStorageKey`) | offline/crash recovery, per-idea (nie per-tool) | wspólny |
| Konflikt wersji | `onConflict(serverVersion, serverMap)` callback | wywoływany przy 409 z `map/sync` | obsługiwany przez hosty; UI konfliktu niepotwierdzone (kod) w tym przebiegu |

Ocena: mechanizm autosave jest solidny i rzeczywiście współdzielony (w przeciwieństwie do szyny quick-actions z sekcji 6) — pojedynczy hook, jeden endpoint (`map/sync`), spójna semantyka `baseVersion`.

---

## 8. Realtime — trzy NIEZALEŻNE mechanizmy współpracy (brak ujednolicenia)

| Mechanizm | Transport | Endpoint/namespace | Backend | Kto używa | Uwaga |
|---|---|---|---|---|---|
| **Idea Collab WS** | natywny `WebSocket` | `ws(s)://…/ws/collab/:ideaId?token=` | `server/src/gateways/ideaCollabWs.gateway.ts` (montowany w `server/src/index.ts:2009-2013`) | `mindmap/CollaborationOverlay.tsx`, montowany przez `canvas/useIdeaCollab.ts` w `IdeaRecommendationMap` (Mind Map), `IdeaWhiteboardTool` (bezpośrednio + `whiteboard/useWhiteboardCollab.ts`), `IdeaProcessFlowTool` (przez `processflow/useProcessFlowCollab.ts`) | multi-cursor, node-lock, `graph_patch`/`graph_version` re-emitowane jako CustomEvent `idea-collab-*` |
| **Table Platform Socket.IO** | Socket.IO | namespace `/table-platform` | `server/src/index.ts:2041-2050` | `table/useTableRealtime.ts` (montowany tylko w P15 `ViewRouter`/`TableToolbar`, NIE w legacy `IdeaTableTool`) | prezencja + kursory komórek + collab tabeli — **osobny protokół od WS collab powyżej** |
| **Presence REST-polling (legacy Table)** | zwykły REST GET/POST | `/my-work/my-ideas/:id/presence` | `my-work.routes.ts:10122-10199` | `table/CollaborationPresence.tsx` (montowany w OBU: `IdeaTableTool.tsx` legacy i `table/TableToolbar.tsx` platform) | Table ma WIĘC potencjalnie DWA równoległe kanały prezencji jednocześnie w trybie Platform (Socket.IO + REST-polling) — niepotwierdzone (kod) czy się nie duplikują/kolidują wizualnie |

**Wniosek:** Mind Map/Process/Whiteboard używają wspólnego natywnego WS (`/ws/collab/:ideaId`) — spójne. Table stoi obok, na zupełnie innym stosie (Socket.IO `/table-platform` + REST presence), co jest zgodne z ustaleniem #4 z `_INPUT_CONTEXT.md` (Table = dwie implementacje) rozszerzonym na warstwę realtime.

---

## 9. AI — rodzina wywołań

| Funkcja | Endpoint | Kto | Zakres |
|---|---|---|---|
| `generateIdeaAI` (przez `ideaAIGenerator.ts`) | `POST /my-ideas/:id/ai-generate` | MM/WB/Process/Table (patrz sekcja 1) | generowanie węzłów/kroków/wierszy z promptu — **poprawnie wspólne** |
| `expandMyIdeaMap` | `POST /my-ideas/:id/map/expand` | głównie Mind Map (+ Template Gallery) | rozwinięcie gałęzi |
| `getMyIdeaAISuggestions` | `POST /my-ideas/:id/map/ai-suggestions` | wyłącznie Mind Map (11 komponentów) | sugestie/sentyment/klastry/luki |
| `getMyIdeaGapAnalysis` | `POST /my-ideas/:id/map/gap-analysis` | wyłącznie Mind Map (`AIBlindSpotsDetector`) | analiza luk |
| `getIdeaAITableAction` / `getIdeaAIFill` | `ai-table-action` / `ai-fill` | wyłącznie Table | edycja/AI-fill tabeli |
| `createMindmapAIProposal` / `resolveMindmapAIProposal` | `v8/mindmap/:id/ai-proposals[/…/resolve]` | **BRAK wywołań** | **NIEUŻYWANY** — niepotwierdzone czy to relikt czy równoległy, nieużyty przez UI mechanizm review AI |
| `developMyIdeaSSE` | `POST /my-ideas/:id/develop` (SSE) | **BRAK wywołań** | **NIEUŻYWANY** |

## 10. Export / Import

| Mechanizm | Endpoint | Domyślny stan | Kto/jak |
|---|---|---|---|
| Client-side export (PNG/SVG/PDF/Markdown/JSON/pakiet/mapping/share, konwersja na report/prezentację) | brak (renderuje w przeglądarce) | **AKTYWNY, domyślny** | `IdeaExportMenu.tsx` — udokumentowane wprost w komentarzu kodu (L30-42): serwerowy export „historically... pure stub", teraz ma realny generator TYLKO dla json/markdown, ale zostaje wyłączony po stronie klienta (`IDEA_SERVER_EXPORT_ENABLED = false` domyślnie, `VITE_ENABLE_IDEA_SERVER_EXPORT` nieustawiona) |
| `ideaRequestExport` / `ideaGetExports` | `POST/GET /v4-final/ideas/:id/export[s]` | flaga OFF domyślnie | `IdeaExportMenu.tsx:524` — kod istnieje i jest wołany TYLKO gdy `IDEA_SERVER_EXPORT_ENABLED===true`; z env nieustawionym w repo, efektywnie **nieaktywny na demo** (do potwierdzenia w runtime, tu: analiza kodu) |
| `exportMyIdeaMapPptx` | `POST /my-ideas/:id/map/export/pptx` | aktywny | `mindmap/ExportPowerPoint.tsx` (Mind Map) — realny pipeline BCG wg komentarza w `api.ts` |
| `exportMindmapJSON` / `exportMindmapMarkdown` | `GET /v8/mindmap/:id/export/json` `/markdown` | — | **BRAK wywołań w `src/`** — martwe, zdublowane przez client-side export w `IdeaExportMenu` |
| `exportIdeaTableCSV` | `GET /my-ideas/:id/export-csv` | — | **BRAK wywołań** — martwe |
| Table Platform `export/xlsx`, `export.csv` | `GET /table-platform/tables/:id/export/...` | aktywny | `artifactLinks.ts`, `tabeleArtifactOpen.ts` — bezpośrednie linki `<a href>`, poza `Api` |
| Import grafu | wewnętrzny (`handleImportGraph`, `IDEA_WORKSPACE_IMPORT_EVENT`) | aktywny | `IdeaMapWorkspace.tsx` — komentarz kodu: „lands through the normal autosave/versioning pipeline" (tak samo jak restore snapshotu) — brak osobnego REST endpointu, operuje na już-pobranym grafie + `syncMyIdeaMap` |

## 11. Template / Convert

| Mechanizm | Źródło danych | Endpoint | Uwaga |
|---|---|---|---|
| Galeria szablonów (`IdeaTemplateGallery.tsx`) | statyczny plik `ideaConsultingTemplates.ts` (`CONSULTING_TEMPLATES`) — **NIE fetch z serwera** | po zastosowaniu: `expandMyIdeaMap` + `syncMyIdeaMap` | szablony to dane lokalne w bundlu, nie REST |
| Convert (idea → initiative/task_set/decision/report/presentation) | — | `POST /my-ideas/:id/convert` | jw. sekcja 1 — wspólny, poprawnie rozgałęziony po `wb_*/pf_*/tbl_*/mm_*` |
| Cluster→Outcome→Convert (V4-IDEA-05) | — | `clusters/materialize`, `clusters/:id/outcome`, `outcomes/:id/convert` | **CAŁA RODZINA MARTWA** (sekcja 1) — brak UI, które by to wołało w obecnym stanie kodu |

---

## Lista endpointów potencjalnie martwych (zero callerów w `src/` w tym przebiegu grep)

1. `POST /my-work/my-ideas/:id/develop` (SSE) — `Api.developMyIdeaSSE`
2. `POST /my-work/my-ideas/:id/clusters/materialize` — `Api.materializeIdeaClusters`
3. `POST /my-work/my-ideas/:id/clusters/:clusterId/outcome` — `Api.createClusterOutcome`
4. `POST /my-work/my-ideas/:id/outcomes/:outcomeId/convert` — `Api.convertOutcome`
5. `GET /my-work/my-ideas/:id/export-csv` — `Api.exportIdeaTableCSV`
6. `POST /v8/mindmap/:id/ai-proposals` — `Api.createMindmapAIProposal`
7. `POST /v8/mindmap/ai-proposals/:id/resolve` — `Api.resolveMindmapAIProposal`
8. `GET /v8/mindmap/:id/export/json` — `Api.exportMindmapJSON`
9. `GET /v8/mindmap/:id/export/markdown` — `Api.exportMindmapMarkdown`
10. `GET /v8/mindmap/:id/health` — `Api.getMindmapHealth` (prawy panel „Zdrowie" liczy health KLIENCKO w `MapHealthScore.tsx`, nie woła tego endpointu)
11. `POST /realtime-v4/facilitation/sessions/:id/end` — `Api.facilitationEndSession` (brak też widocznego przycisku „Zakończ sesję")
12. `POST /realtime-v4/facilitation/sessions/:id/outcomes` — `Api.facilitationCreateOutcome`
13. `GET /realtime-v4/facilitation/sessions/:id/outcomes` — `Api.facilitationGetOutcomes`
14. `PUT /realtime-v4/facilitation/outcomes/:id/export` — `Api.facilitationExportOutcome`
15. `DELETE /my-work/link-graph/edges/:edgeId` — `Api.deleteLinkGraphEdge` — używany TYLKO w `TaskDetailView`, zero w Idea Workspace (nie „martwy" globalnie, ale nieużywany w tym zakresie audytu)

Eventy martwe (zero `addEventListener` w `src/`):
- `idea-workspace-add-edge` (dispatch: `table/RowDetailPanel.tsx`)
- `idea-workspace-link-artifact` (dispatch: `table/RowDetailPanel.tsx`)
- `idea-workspace-votes-update` (dispatch: `IdeaMapWorkspace.tsx`)
- `idea-whiteboard-outcomes-changed` (dispatch: `IdeaWhiteboardTool.tsx`)
- `idea-mindmap-apply-theme` (dispatch: `IdeaRecommendationMap.tsx`)
- `idea-workspace-active-tool` — niepotwierdzone (kod), brak znalezionego nasłuchu w tym przebiegu

## Lista widocznych akcji BEZ działającego endpointu/nasłuchu

1. **Menu 3 „Rozwiń AI" (`onAIExpand`) na Whiteboard/Process/Table** — dispatch `mm_ai_expand`, obsługiwane wyłącznie gdy zamontowany `useMindMapQuickActions` (tylko Mind Map). Klik widoczny na wszystkich 4 narzędziach (Menu 3 nie filtruje po `tool`), efekt tylko na Mind Map.
2. **Menu 3 „Auto-layout" (`onAutoLayout`) na Whiteboard/Process/Table** — dispatch `idea-mindmap-node-quick-action` → `pane_auto_layout`, ten sam problem.
3. **Whiteboard AI Nudge Strip „Rozwiń"/„Podsumuj"** (`onActionExpand`/`onActionConvert` w `IdeaAINudgeStrip`, `IdeaWhiteboardTool.tsx:3655-3667`) — te same martwe akcje `mm_ai_expand`/`mm_ai_summarize`, tym razem z natywnego (nie-powłokowego) paska Whiteboardu.
4. **Table `RowDetailPanel` „Dodaj powiązanie"/„Powiąż artefakt"** — dispatch `idea-workspace-add-edge`/`idea-workspace-link-artifact` bez żadnego nasłuchu — przycisk najwyraźniej widoczny w panelu szczegółów wiersza, kliknięcie nic nie robi.
5. **Facilitacja Whiteboardu — brak „Zakończ sesję"** — odwrotny przypadek: endpoint (`facilitation/sessions/:id/end`) istnieje po stronie klienta i serwera, ale NIE ma widocznego przycisku UI, który by go wołał (możliwe, że sesja kończy się tylko niejawnie/przez wygaśnięcie fazy — niepotwierdzone (kod)).
6. **Prawy panel „Zdrowie" nie odzwierciedla ewentualnego backendowego `getMindmapHealth`** — liczone wyłącznie klientowo z aktualnych `nodes`/`edges` w przeglądarce (`MapHealthScore.tsx`), więc jeśli backend miał liczyć to inaczej (np. z uwzględnieniem historii/AI), UI tego nie pokazuje.

## Uwagi metodologiczne / niepewności do zamknięcia

- Nie potwierdzono w tym przebiegu (nie czytano całych plików) dokładnej treści handlera dla `idea-workspace-active-tool` — możliwe, że jest konsumowany przez kod spoza `src/components/MyWork` (np. globalny store Teresy) — **niepotwierdzone (kod)**, wymaga dodatkowego grep poza katalogiem MyWork jeśli ktoś chce to domknąć.
- Legacy `/my-ideas/:ideaId/edges` (GET/POST/DELETE) nie zostało w pełni zmapowane na konkretne komponenty UI — prawdopodobnie relikt, ale **niepotwierdzone (kod)**.
- Endpoint `/my-ideas/:id/ai-suggestions` (poziom idei) vs `/my-ideas/:id/map/ai-suggestions` (poziom mapy) — dwie osobno zdefiniowane trasy o zbliżonych nazwach; nie zweryfikowano czy oba mają realnych callerów czy jeden jest reliktem — **niepotwierdzone (kod)**.
- Audyt NIE obejmuje w pełni `table-platform.*.routes.ts` (ai-editor/conversion/form-intake/qa/source-pack/relations-explain) — to osobny, bardzo duży system; potraktowany jako out-of-scope zgodnie z komentarzami w samym kodzie serwera („OUT OF SCOPE per packet §4").
