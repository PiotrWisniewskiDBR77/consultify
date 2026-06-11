# Moduł 02A — Ideas: Zarządzanie ideami — Karta audytu + plan rozwoju

**Data audytu:** 2026-06-11 (branch `feat/deliverables-light`) · **Metoda:** weryfikacja realnego kodu, dowody `plik:linia`
**Gotowość: 68/100 — Beta (closed)** *(poprzednio w ramach Modułu 02: 57/100 Alpha — realny postęp)*

**Werdykt:** Warstwa zarządzania ideami jest w przeważającej części realna i dobrze zaprojektowana (CRUD, persystencja z wersjonowaniem, konwersje z traceability, prawdziwe AI), ale psują ją: kłamiąca obsługa konfliktów, martwa tabela snapshotów (brak migracji → wieczne 503), architektura wielu równoległych writerów do jednego wiersza mapy oraz zero testów serwerowych dla ~45 endpointów — do tego całość jest zamknięta betą dla nie-adminów.

---

## 1. CO JEST REALNE (zweryfikowane w kodzie)

**Routing i montaż w UI**
- Trasy `/my-work/ideas` i `/my-work/ideas/:ideaId[/workspace[/:tool]]` parsowane w `src/components/MyWork/MyWorkHub.tsx:454-495`; lista montowana w hubie (`MyWorkHub.tsx:3259`), workspace lazy-loaded (`MyWorkHub.tsx:142-143, 3085`). Deep-link `?tool=` honorowany (`IdeaMapWorkspace.tsx:1486`), tool zapisywany do URL przy przełączaniu (`IdeaMapWorkspace.tsx:377-389`).

**Lista / CRUD idei — w pełni realne**
- `MyIdeasListContent.tsx:376` → `Api.getMyIdeas` → `GET /api/my-work/my-ideas` (`server/src/routes/my-work.routes.ts:2413-2509`, realny SQL na `my_ideas`, scope per user+org, limit 500, wyszukiwanie q/tag/folder/favorite z guardami na brakujące kolumny).
- Create/Update/Delete: `my-work.routes.ts:2552, 2749, 3019`; create z bootstrapem draftu idei odpornym na StrictMode-double-mount (`IdeaMapWorkspace.tsx:94, 1346-1376`).
- Foldery (CRUD `my-work.routes.ts:2910-3018`), ulubione, „ostatnio otwierane" (`POST .../opened` :2886; hooki `useFavoriteIdeas`/`useRecentIdeas` — testowane). UI folderów pokazuje się dopiero gdy endpoint żyje (`MyIdeasListContent.tsx:458-472`) — łagodna degradacja.
- 3 widoki listy: table/grid/garden (`MyIdeasListContent.tsx:1697, 1772`), skróty c/e/p (`:1020-1031`), metryki map per idea (`Api.getMyIdeaMapMetrics` → `GET /my-ideas/metrics/map`, `my-work.routes.ts:3539`; kolizja routingu z `/:id/map` świadomie obsłużona branchem `ideaId === 'metrics'` w `:3374`).

**Persystencja mapy (my_idea_maps) — realna i dojrzała**
- `useIdeaMapSync.ts` — pełny cykl: draft w localStorage (800 ms debounce + idle task), autosave (60 s), flush na visibilitychange/online/beforeunload/Cmd+S (`:338-373`), stany idle/queued/saving/saved/offline/conflict.
- Serwer `POST /my-ideas/:id/map/sync` (`my-work.routes.ts:3873-4070`): walidacja schematu grafu (`validateAndNormalizeGraph`), **optimistic concurrency** — `baseVersion` wymagany, 409 przy rozjeździe (`:3949-3970`), **guard przed wyczyszczeniem mapy pustym table-resetem** (`IDEA_MAP_EMPTY_RESET_BLOCKED`, `:3977-4005`), deep-merge `extensions_json` per tool.
- Migracje realne: `20260312_my_idea_maps.sql` (unique index user+idea), `20260313_..._graph_contract_v3.sql` (preferred_tool, extensions_json).
- Hydracja z odzyskiem pending draftu z wersjonowaniem (`resolveIdeaMapHydration`, `useIdeaMapSync.ts:135-172`).

**Przełączanie 4 narzędzi**
- `IdeaWorkspaceToolbar.tsx` — pływający switcher mindmap/whiteboard/process_flow/table + kropki „ma zawartość w innym narzędziu" + wskaźnik cross-family (`:117-130`); skróty 1-4 (`IdeaMapWorkspace.tsx:1636`); `preferred_tool` z serwera auto-otwiera ostatnie narzędzie (`IdeaMapWorkspace.tsx:2778-2782`); każde narzędzie w osobnym error boundary z retry (`IdeaMapWorkspace.tsx:97+, 2764-2916`).

**Konwersja idea → output — realny silnik, nie stub**
- `POST /my-ideas/:id/convert` (`my-work.routes.ts:5888-6580`): 6 targetów (initiative/task_set/decision/report/presentation/team_chat), wszystkie z realnymi INSERT-ami, materializacją ToolSession (z guardem 500, `:5988-5992`), krawędziami link-graph, promocją stage→promoted, wzbogaceniem o zaznaczone węzły (nodeIds) i readbackiem Process Flow (`:5957-5963`). Frontend: `MyIdeasListContent.tsx:1045` + `ConvertToOutputMenu.tsx` → `conversionService.ts` (realne POST-y do report-builder/presentations/financial-modeling).

**AI — realne LLM, nie mock**
- Sugestie: `POST /my-ideas/:id/ai-suggestions` → `ideaAISuggestionsService.ts` z `llmService.call` (`:240-248, 405-413, 464-472`); konsumowane przez `IdeaAISuggestionsPanel.tsx:309`, `IdeaAINudgeStrip.tsx:124`, `IdeaContextPanel.tsx:347`.
- Generacja: `POST /my-ideas/:id/ai-generate` → `ideaAIGeneratorService.ts` z `llmService.callStructured` (`:1160-1172`); pętla propozycji z review (`IdeaProposalReview.tsx`, zamontowane `IdeaMapWorkspace.tsx:2953`) i deterministycznym aplikatorem patchy `aiProposalRuntime.ts` (testowany).
- `ai-table-action`, `ai-fill`, `map/expand`, `gap-analysis` — wszystkie przez LLM service (`my-work.routes.ts:8755, 8790, 4074, 4385`).

**Cross-cutting**
- `IdeaContextPanel.tsx` — realne backlinki z link-graph + kontekst firmowy + walidacja spójności grafu (`:300-420`); zamontowany (`IdeaMapWorkspace.tsx:3051`).
- `IdeaExportMenu.tsx` — PNG/SVG/PDF/Markdown/JSON/diagram-package/mapping-report/share-manifest generowane klientowo i działające (html-to-image + jsPDF, `:222-345`); report/deck delegują do realnego convert (`:469-489`); import draw.io/BPMN/package z podglądem (`:180-199`).
- `IdeaTemplateGallery.tsx` — ~80+ definicji szablonów, aplikacja przez `Api.syncMyIdeaMap` z `baseVersion` + best-effort AI expand (`:1877-1925`).
- `IdeaUnifiedSearch.tsx` — Cmd+F po labelach/opisach/ownerach/tagach/załącznikach/komentarzach.
- Snapshoty/wersje: endpointy `GET/POST/DELETE /my-ideas/:id/map/snapshots` (`my-work.routes.ts:4509-4645`) — kod realny, ale patrz §3 (brak tabeli).
- Komentarze do węzłów: endpointy + migracja `720_idea_node_comments.sql` — kompletne.
- Beta gating: `MYWORK_IDEAS: 'closed'` (`src/utils/betaAccess.ts:58`), egzekwowane w hubie (`MyWorkHub.tsx:596-598, 801-820`).

## 2. CO JEST MOCK / STUB / HARDCODE

- **Eksport serwerowy = rejestr bez plików**: `POST /v4-final/ideas/:id/export` tylko INSERT-uje wiersz „request" do `idea_exports` — żaden worker nigdy nie generuje pliku (`finalBatchService.ts:19-46`); frontend używa tego jako telemetrii z `catch(() => undefined)` (`IdeaExportMenu.tsx:498-509`).
- **„PDF" = screenshot rastrowy** wklejony do jsPDF (`IdeaExportMenu.tsx:305-345`).
- **Notatki w IdeaContextPanel efemeryczne** — `useState` bez persystencji (`IdeaContextPanel.tsx:141, 895-905`).
- **`canvasLocked = false` na sztywno** (`IdeaMapWorkspace.tsx:373`) — vestigial.
- **Presence = współpraca pozorna**: endpointy presence (`my-work.routes.ts:8899-8965`) realnie zapisują kursory, ale mapa jest **per-user** (unique index `ux_my_idea_maps_user_idea`, `20260312_my_idea_maps.sql:23`) — drugi użytkownik nigdy nie zobaczy tej samej treści.
- 4× `console.log` debug w prodzie (`IdeaMapWorkspace.tsx:433, 719, 1172, 1809`).

## 3. CO JEST ZEPSUTE / BRAKUJĄCE

- **P0 — Obsługa konfliktu kłamie → silent overwrite**: `handleGraphConflict` (`IdeaMapWorkspace.tsx:451-461`) pokazuje toast „Odświeżam mapę z serwera" i **niczego nie odświeża**. Co gorsza, `useIdeaMapSync` po 409 podbija `serverVersionRef` do wersji serwera (`useIdeaMapSync.ts:264-268`), więc następny flush przejdzie i **nadpisze równoległe zmiany** (last-write-wins bez merge i bez wiedzy użytkownika).
- **P0 — `my_idea_map_snapshots` nie ma migracji NIGDZIE** (0 trafień w `server/migrations/` i baseline). Endpointy snapshotów zwracają wieczne 503 przez `requireTables` (`my-work.routes.ts:673-700`); klient połyka to bezgłośnie (`useIdeaMapSync.ts:256-260`; `SnapshotHistory.tsx:199-217` spada na localStorage). Równolegle istnieje tabela `my_idea_map_versions` (migracja `622`, jest w baseline prod) — **której nie używa żadna linijka kodu**. Split-brain schema↔kod. *(Uwaga: agent Mind Map ustalił, że SnapshotHistory mindmapy celuje w `my_idea_map_versions` — rozstrzygnąć, która tabela jest kanoniczna, przy implementacji.)*
- **P1 — Wielu writerów do jednego wiersza mapy**: workspace ma własny `useIdeaMapSync` (przez `useWorkspaceGraphRuntime`, `IdeaMapWorkspace.tsx:463-470`), a table/process_flow/whiteboard tworzą **drugą, niezależną instancję** z własnym licznikiem wersji (`useTablePersistence.ts:111`, `IdeaProcessFlowTool.tsx:531`, `IdeaWhiteboardTool.tsx:645`). Patche z workspace i sync z narzędzia rozjeżdżają wersje → samowywołane 409. Tylko mindmap dostaje współdzielony `externalRuntime` (`IdeaMapWorkspace.tsx:2828-2840`) — niespójność wzorca.
- **P1 — Brak flusha przy odmontowaniu/przełączeniu narzędzia**: cleanup czyści timery bez flusha (`useIdeaMapSync.ts:375-381`); zmiany z ostatnich <800 ms mogą przepaść.
- **P2 — Szablon nadpisuje cały graf bez potwierdzenia** (`IdeaTemplateGallery.tsx:1886-1908`; grep `confirm|overwrite` = 0 trafień).
- **P2 — Martwy kod**: `IdeaCanvasToolSelector.tsx` (158 linii, niemontowany); API krawędzi `GET/POST/DELETE /my-ideas/:id/edges` (`my-work.routes.ts:3063-3220` + migracja `20260310_my_idea_edges.sql`) — zero konsumentów FE; `IdeasMindMap.tsx` to redirect-shim.
- **P3 — Beta gate tylko frontendowy** — endpointy `my-ideas` nie sprawdzają flagi beta.

## 4. Wiring backendu

| Funkcja | Endpoint | Tabela DB | Status |
|---|---|---|---|
| Lista/CRUD idei | GET/POST/PUT/DELETE `/api/my-work/my-ideas[...]` (2413/2552/2749/3019) | `my_ideas` | ✅ realne |
| Foldery | `/my-idea-folders` (2910-3018) | `my_idea_folders` | ✅ realne (UI degraduje łagodnie) |
| Ulubione/recents | PUT `:id` isFavorite, POST `:id/opened` (2886) | `my_ideas` | ✅ realne |
| Mapa — odczyt | GET `:id/map` (3366) | `my_idea_maps` | ✅ realne, ensureLatestSchema |
| Mapa — sync | POST `:id/map/sync` (3873) | `my_idea_maps` | ✅ wersjonowanie + empty-reset guard |
| Metryki map | GET `/my-ideas/metrics/map` (3539) | `my_idea_maps` | ✅ realne |
| Snapshoty mapy | GET/POST/DELETE `:id/map/snapshots` (4509-4645) | `my_idea_map_snapshots` | ❌ **tabela bez migracji → 503** |
| Wersje mapy (alt) | — | `my_idea_map_versions` (migracja 622) | ❌ tabela istnieje, kod nie używa |
| Komentarze węzłów | `:id/map/nodes/:nodeId/comments` (4656-4798) | `idea_node_comments` | ✅ realne |
| Krawędzie idei | `:id/edges` (3063-3220) | `my_idea_edges` | ⚠️ backend OK, brak konsumenta FE |
| Konwersja | POST `:id/convert` (5888) | initiatives/tasks/decisions/reports/presentations/chat_* + tool_sessions + link_graph_edges | ✅ realne z traceability |
| AI suggestions/generate/expand/fill | (8710/4959/4074/8790) | LLM via `llmService` | ✅ realne |
| Eksport serwerowy | POST `/api/v4-final/ideas/:id/export` | `idea_exports` | ⚠️ rejestr requestów, plik nigdy nie powstaje |
| CSV tabeli | GET `:id/export-csv` (8829) | `my_idea_maps` | ✅ realne |
| Presence | GET/POST `:id/presence` (8899) | realtime platform | ⚠️ działa, ale mapy per-user → współpraca niemożliwa |

Mount routera: `app.use('/api/my-work', myWorkRoutes)` (`Gateway.ts:745`). Degradacje: `requireTables` → 503 `not_configured` (`my-work.routes.ts:673-700`).

## 5. Testy

**Pokryte (48/48 PASS, uruchomione):** `ideaMapSyncPersistence.smoke.test.ts` (round-trip, locked, 409→conflict, offline — 4 narzędzia), `ideaWorkspaceState.test.ts`, `aiProposalRuntime.test.ts`, `crossToolTransform.test.ts`, `IdeaExportMenu.test.tsx`, `ideaEntryTypes.test.ts`, `useFavoriteIdeas/useRecentIdeas.test.ts`, `MyWorkHub.test.tsx`, `useKeyboardShortcuts.test.tsx`.

**Niepokryte:** **zero testów serwerowych** dla ~45 endpointów `my-ideas`; brak testu pełnego cyklu konfliktu (409 → refresh → merge), przełączania narzędzi z zachowaniem danych, konwersji E2E, beta-gatingu, empty-reset-guard po stronie serwera.

## 6. UX vs standard Miro

**Na plus:** jeden współdzielony workspace z pływającym switcherem + wskaźnikami zawartości cross-tool; Cmd+K we wszystkich narzędziach, Cmd+F unified search, `?` help, skróty 1-4; jednolity kontrakt zaznaczenia (`IdeaWorkspaceSelection`); prawy strip paneli (Tools/Context/AI) spójny; status zapisu czytelny; URL odzwierciedla narzędzie; error boundaries per narzędzie.

**Poniżej Miro:** (a) **brak realnej współpracy** — mapy per-user, presence to fasada; (b) przełączenie narzędzia to pełny remount z własną hydracją (flash ładowania) zamiast płynnej zmiany „lens" na jednym żywym grafie; (c) konflikt = toast bez resolucji; (d) szablon nadpisuje pracę bez ostrzeżenia; (e) autosave 60 s to dużo jak na canvas; (f) trzy osobne układy sterowania (CanvasLeftToolbar + IdeaWorkspaceToolbar + panel-strip) — więcej chrome niż w Miro.

---

## 7. PLAN ROZWOJU — Zarządzanie ideami

### Fala 1 — Integralność danych (P0)
1. **Naprawić cykl konfliktu**: `handleGraphConflict` realnie woła `graphRuntime.refresh()`/merge zamiast samego toastu; usunąć podbijanie `serverVersionRef` po 409 bez rehydracji (`IdeaMapWorkspace.tsx:451-461`, `useIdeaMapSync.ts:264-268`).
2. **Jeden runtime persystencji dla 4 narzędzi**: table/flow/whiteboard dostają `externalRuntime` jak mindmap — eliminacja równoległych liczników wersji, które same generują 409.
3. **Migracja `my_idea_map_snapshots`** + decyzja kanoniczna vs `my_idea_map_versions` (skasować nieużywaną) — feature „wersje/checkpointy" jest dziś martwy na prodzie.

### Fala 2 — Fundament współpracy (P1, decyzja właścicielska)
4. **Rozstrzygnąć współpracę zespołową**: zdjąć unique index per-user + model share/membership (warunek „Miro-grade" dla WSZYSTKICH narzędzi), albo usunąć fasadowe presence. Ta decyzja warunkuje plany 02B–02E.
5. **Flush przy przełączaniu narzędzia/odmontowaniu** + skrócenie autosave (60 s → ciągły/15 s) + `keepalive`/`sendBeacon` w beforeunload.

### Fala 3 — Zaufanie i jakość (P2)
6. Confirm przed aplikacją szablonu na niepustym grafie.
7. Testy serwerowe kontraktu map-sync (wersjonowanie, empty-reset guard) i konwersji (6 targetów).
8. Sprzątanie: martwy `IdeaCanvasToolSelector`, nieużywane API `my_idea_edges`, console.logi, serwerowe egzekwowanie beta-gate, persystencja notatek Context Panelu, realny eksport serwerowy albo wycięcie rejestru `idea_exports`.
