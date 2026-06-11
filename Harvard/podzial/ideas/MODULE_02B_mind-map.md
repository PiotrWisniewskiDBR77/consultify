# Moduł 02B — Ideas: Mind Map — Karta audytu + plan rozwoju

**Data audytu:** 2026-06-11 (branch `feat/deliverables-light`) · **Metoda:** weryfikacja realnego kodu, dowody `plik:linia`
**Gotowość: 72/100 — Beta+ (kandydat produkcyjny po 1 fali poprawek)**

**Werdykt:** Rdzeń (canvas, edycja, persystencja wersjonowana, offline-draft, collab WS, undo, import/eksport, 64 testy jednostkowe) jest realny i dobrze zaprojektowany, ale warstwa „AI overlays" to w większości pseudo-AI fabrykujące semantykę po stronie klienta, brakuje align/snap klasy Miro, brak integracji z czatem Teresy, a codemod kolorów uszkodził identyfikatory i jeden widoczny dla użytkownika string.

**Uwaga architektoniczna:** `src/components/MyWork/IdeasMindMap.tsx` to **deprecated shim (33 linie)** — redirect do `/my-work/ideas` (`IdeasMindMap.tsx:23-31`). Faktyczny mind map to `IdeaRecommendationMap.tsx` (**6349 linii**), montowany przez `IdeaMapWorkspace.tsx:2770` ← `MyWorkHub.tsx:142,3085` (lazy).

---

## 1. CO JEST REALNE

**Persystencja (najmocniejsza część):**
- Łańcuch zapisu: ReactFlow state → `useMindMapPersistence.scheduleSave` (`mindmap/useMindMapPersistence.ts:590-754`) → `workspaceGraphRuntime.captureToolGraph` (`canvas/workspaceGraphRuntime.ts:268-300`) → `useIdeaMapSync.queueSync/flushNow` (`canvas/useIdeaMapSync.ts:232-314`) → `POST /my-ideas/:id/map/sync`.
- Serwer `my-work.routes.ts:3873-4066`: walidacja schematu (:3910), wymagany `baseVersion` (:3948), konflikt 409 (:3955-3966), guard `IDEA_MAP_EMPTY_RESET_BLOCKED` (:3981-4007), merge extensions (:3968-3976), scoping user+org.
- Migracje realne: `20260312_my_idea_maps.sql`, `20260313_my_idea_maps_graph_contract_v3.sql`, `622_my_idea_map_versions.sql` (snapshoty).
- Konflikt wersji: 409 → toast + `externalRuntime.refresh()` (`useMindMapPersistence.ts:281-284`) — **mindmap jako jedyne narzędzie ma działający refresh** (przez współdzielony runtime); re-hydratacja tylko przy skoku wersji >1 (`useMindMapPersistence.ts:530-543`).
- Offline/draft: localStorage z flagą pending i guardem baseVersion (`useIdeaMapSync.ts:90-172`), flush na visibilitychange/online/beforeunload/Cmd+S (:338-373).
- Viewport: `extensions.mindmap.viewState.viewport` + fallback localStorage (`useMindMapPersistence.ts:325-334`), zapis na `onMoveEnd` (`IdeaRecommendationMap.tsx:5083-5085`).

**Edycja i interakcje:**
- Pełna gramatyka klawiatury: Tab=dziecko, Enter=rodzeństwo, F2=edycja, Delete, Space=zwiń, strzałki=nawigacja, Alt+strzałki=przesuwanie, Alt+0-3=fold levels, Cmd+Z/Shift+Z/A/C/X/V/D/S/0/K (`IdeaRecommendationMap.tsx:3086-3411,3781`).
- Undo/redo 50 kroków ze snapshotem collapsed-ids (:2128-2180); drag-to-reparent z podświetleniem `_dropTarget` (:2637-2668, `useMindMapNodes.tsx:573-739`).
- Model interakcji Miro-style współdzielony (panOnDrag=[1,2], selectionOnDrag, Space=pan, partial selection — `canvas/useIdeasToolDefaults.ts:33-56`).
- Layouty własne: rekurencyjne drzewo (`useAutoLayout.ts`), radialny (`RadialTreeLayout.tsx`), force-directed (`ForceDirectedLayout.tsx`), struktury (`StructureLayouts.ts`).
- Menu kontekstowe node/edge/pane; EdgeContextMenu: etykieta, wstaw węzeł na krawędzi, odwróć kierunek, styl linii, relacja, usuń (`EdgeContextMenu.tsx:53-90`).

**Collab — realny WebSocket:** klient `CollaborationOverlay.tsx:147-148` → `/ws/collab/:ideaId`, gateway `server/src/gateways/ideaCollabWs.gateway.ts` (442 ln, auth+sesje) podpięty w `server/src/index.ts:1785-1791`; presence, kursory, locki węzłów, heartbeat, reconnect, tryb degraded. Mindmap jako jedyne narzędzie konsumuje `graph_patch` (`IdeaRecommendationMap.tsx:2811`).

**AI backend — realny LLM:** `/map/ai-suggestions` (`my-work.routes.ts:4288-4378`) i `/map/expand` (:4073+) przez `llmService` + `modelRouter`; gap-analysis (:4384+) analogicznie.

**Funkcje server-backed:** komentarze do węzłów (`NodeCommentThread.tsx:80-144` → routes :4656-4761), snapshoty (`SnapshotHistory.tsx:158-287` → `my_idea_map_versions`), activity feed (`ActivityFeed.tsx:87,142`).

**Import/eksport realne:** FreeMind .mm / XMind ZIP / OPML — prawdziwe parsery (`ImportExternalMap.tsx:26-90`); Markdown/JSON/CSV/SVG/PNG (`useMapExport.ts`), PDF = PNG→drukowanie (`useMapExportPdf.ts:14-25`), Mermaid/PlantUML (`ExportDiagramCode.tsx:17,94`). VoiceToNode = Web Speech API (`VoiceToNode.tsx:27-38`). `LargeMapOptimizer.tsx:11-40` — progi 150/300/500 + simplified mode.

**Powierzchnie pokrewne:** `IdeaGhostCards.tsx` — zamontowane (`IdeaMapWorkspace.tsx:2714`), realne AI; `IdeaNodeDetailDrawer.tsx` — zamontowany (:3183); `IdeaSummaryCardNode.tsx` + `IdeaMetricNodes.tsx` — **należą do whiteboardu**, nie mindmapy (`whiteboard/nodes/nodeTypes.ts:3-4`).

## 2. CO JEST MOCK / PSEUDO / HARDCODE

- **AISentimentOverlay** — „sentyment" wyliczany z progu `confidence` i przypisywany **pozycyjnie po indeksie** do węzłów; wynik semantycznie losowy (`AISentimentOverlay.tsx:56-81`).
- **AIAutoClustering** — dopasowanie węzłów do klastrów przez porównanie 10-znakowych substringów; fallback: arbitralne plasterki `slice(idx*2, idx*2+2)` (`AIAutoClustering.tsx:73-92`).
- **Cała rodzina AI paneli** (AIDependencyDetector:73, AIPriorityRecommender:70, AICompetitiveLandscape:56, AIWhatIfScenarios:59, BranchSummaryPanel:120, DocumentToMap:57, InterviewToMap:58) — wszystkie lejkują przez **jeden generyczny prompt** `getMyIdeaAISuggestions` (serwer zwraca tylko topics/findings/next_steps, `my-work.routes.ts:4334-4344`), a specyficzną semantykę „dorabiają" klientem. **Real call, fake feature.**
- **ExportPowerPoint** — pobiera plik **HTML** (`-presentation.html`), nie .pptx (`ExportPowerPoint.tsx:91-95`).
- **EmbedInReports** — kopiuje snippet HTML do schowka, brak pipeline'u osadzania (`EmbedInReports.tsx:64-120`).
- **WebhookSettings** — webhooki w localStorage per przeglądarka, fire-and-forget fetch z klienta (`WebhookSettings.tsx:44-67`).
- **MindMap3DView** — pseudo-3D na CSS perspective, bez WebGL (`MindMap3DView.tsx:3,193`).

## 3. CO JEST ZEPSUTE / BRAKUJĄCE

- **Korupcja codemodu „red"→„rose"** (commit 24ccb176d9): `roseoStackRef`/`roseo` zamiast redo (`IdeaRecommendationMap.tsx:2129-2173`), `focusFilteroseNodes` (:2077), **widoczny string `'Cost roseuction'`** (:1001) i `'Recoverose previous debug session'` (:1824). Ta sama korupcja w `notebook/AIChatInlinePanel.tsx`.
- **`mindmap/mindMapTemplates.ts` = dead code** — 0 importerów.
- **Brak align/distribute i snapToGrid** — grep w całym katalogu mindmap pusty; `useIdeasToolDefaults.ts` nie ustawia `snapGrid`.
- **Dwa równoległe drawery szczegółów węzła**: `mindmap/NodeDetailDrawer.tsx` (1042 ln, `IdeaRecommendationMap.tsx:5607`) + `IdeaNodeDetailDrawer.tsx` (1374 ln, `IdeaMapWorkspace.tsx:3183`) — ~2400 linii zdublowanej odpowiedzialności.
- **Flush przy zamknięciu karty** bez `keepalive`/`sendBeacon` (`useIdeaMapSync.ts:350-354`) — okno utraty przy zmianie urządzenia.
- **Teresa — brak realnej integracji z czatem**: kontekst sidekick (`aiSidekickContext.ts`, event `idea-mindmap-sidekick-context`, `IdeaRecommendationMap.tsx:2534`) konsumują tylko lokalne popovery; `src/hooks/useOpenChatWithContext.ts` nie zna mindmapy; retrieval Teresy po mapach nie istnieje w `server/src/services/ai/`.
- Degradacje są komunikowane (stany `no_route`/`missing_table`/`offline` + toasty, `useMindMapPersistence.ts:469-486`), ale w legacy ścieżce edycja przy `persistence !== 'online'` po prostu nie zapisuje (:677).

## 4. Wiring backendu

| Endpoint / zasób | Plik:linia | Status |
|---|---|---|
| GET `/my-work/my-ideas/:id/map` | `my-work.routes.ts:3365` | ✅ REALNE (auth, org-scope, default skeleton, schema upgrade) |
| GET `/my-ideas/metrics/map` | :3538 | ✅ REALNE |
| PUT `/my-ideas/:id/map` (legacy) | :3613 | ✅ REALNE |
| POST `/my-ideas/:id/map/sync` | :3873 | ✅ REALNE (baseVersion, 409, empty-reset guard) |
| POST `/map/expand`, `/map/ai-suggestions`, `/map/gap-analysis` | :4073, :4288, :4384 | ✅ REALNE LLM |
| GET/POST/DELETE `/map/snapshots` | :4508-4619 | ✅ REALNE → `my_idea_map_versions` |
| GET/POST/DELETE `/map/nodes/:nodeId/comments` | :4655-4761 | ✅ REALNE |
| WS `/ws/collab/:ideaId` | `gateways/ideaCollabWs.gateway.ts` + `index.ts:1785` | ✅ REALNE |
| Flaga `ENABLE_TABLE_PLATFORM_METADATA_FIRST` (projekcja tabeli do mapy) | `config/FeatureFlags.ts:23` | default **false** |

## 5. Testy

Stan dramatycznie lepszy niż w audycie 2026-06-02 („zero testów"):
- **64 testy jednostkowe w 12 plikach — wszystkie PASS** (uruchomione): `tests/unit/mindmap/` (10 plików: nodeModel, grammar, toolbar, popovery, modale, branchColor, extensionsMerge), `canvas/__tests__/ideaMapSyncPersistence.smoke.test.ts`, `IdeasMindMap.redirect.test.tsx`.
- **E2E**: `tests/e2e/smoke/qa-idea-mindmap-checklist.spec.ts` (361 ln, Playwright) — **nie jest w CI** (`.github/workflows/test-suite.yml` go nie listuje).
- **Luka serwerowa**: brak testów route'ów `/map` i `/map/sync` (testy `p12-mindmap-*` dotyczą odrębnego modułu v8 mindmap-builder).

## 6. UX vs Miro

**Jest:** model wskaźnika Miro (LPM=select/box-select, MPM/PPM=pan, Space=pan, scroll=zoom, pinch); box-select partial; multi-select + operacje grupowe; drag-reparent z highlightem; inline edit; zwijanie gałęzi + fold levels; minimap (domyślnie off, `IdeaRecommendationMap.tsx:1900`); zoom controls; 4 layouty; command palette (Cmd+K); floating toolbar na węźle; context menu node/edge/pane; tryb connect; collab z kursorami; tryb prezentacji, timeline, heatmapa; optymalizacja dużych map.

**Brakuje do Miro:** align/distribute (w ogóle), snap-to-grid/smart guides, frames/sekcje, sticky-notes na mapie, zoom-to-selection jako gest, multi-touch poza pinch, stylowanie wielu zaznaczonych naraz (toolbar per węzeł), pierwszorzędne wyszukiwanie z nawigacyjnym podświetleniem. Płynność: brak wirtualizacji — powyżej ~300 węzłów tylko „simplified mode" (ukrywanie), nie occlusion culling.

---

## 7. PLAN ROZWOJU — Mind Map

### Fala 1 — Uczciwość funkcji + higiena (szybkie, niskie ryzyko)
1. **Naprawa korupcji codemodu**: identyfikatory „rose" + stringi `'Cost roseuction'`/`'Recoverose...'` (też w `notebook/AIChatInlinePanel.tsx`); usunięcie `mindMapTemplates.ts`.
2. **Uczciwe eksporty**: prawdziwy .pptx (pptxgenjs) albo zmiana etykiety „PowerPoint"; webhooki server-side albo wycięcie.
3. **CI**: dodać e2e checklist do workflow + testy integracyjne `/map/sync` (konflikt, empty-reset, merge extensions).

### Fala 2 — Prawdziwe AI + Teresa (różnicujące)
4. **Dedykowane endpointy AI per funkcja** (sentyment/klastry/zależności/priorytety) zamiast jednego generycznego promptu z klienckim fabrykowaniem wyników — dziś „demo-AI" daje losowe rezultaty przy pokazie klientowi.
5. **Integracja Teresa-chat**: konsument eventu sidekick w `useOpenChatWithContext` + retrieval po `my_idea_maps` — deklarowany bar właściciela; event już istnieje, brakuje konsumenta.

### Fala 3 — Miro-grade canvas
6. **Align/distribute, snap/smart-guides, stylowanie multi-selekcji** — najbardziej widoczna różnica klasy w codziennym użyciu.
7. **Konsolidacja dwóch drawerów** (~2400 ln duplikacji) — redukuje ryzyko regresji przy dalszym rozwoju.
8. **Niezawodny zapis przy zamknięciu karty**: `fetch keepalive`/`sendBeacon` w flushu beforeunload.
