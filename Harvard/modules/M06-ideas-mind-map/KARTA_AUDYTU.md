# M06 — Ideas — Mind Map — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `f8fec59`) · **Audytor:** Claude (subagent autonomiczny)
**Wejścia:** `Harvard/podzial/ideas/MODULE_02B_mind-map.md` (poprzednia analiza 72/100) · `Harvard/podzial/inventory/INV_B_my-work.md` (sekcja Ideas) · Protokół V1
**Evidence:** `Harvard/modules/M06-ideas-mind-map/evidence/` (Faza 4 niewykonana — brak przeglądarki w subagent)

## OCENA: 57/100 — Tier: Alpha · „NIEPEŁNY (bez Fazy 4)"

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 16/25 | Rdzeń persystencji+collab+edycji REALNY; 7 pozycji inwentarza MOCK/ZEPSUTE (eksport PPT→HTML, webhooki localStorage, AI overlays fabrykowane klientem, sendBeacon brak, string "Cost roseuction") |
| B. Wiring i dane | 15 | 11/15 | Każdy główny endpoint ma tabelę+migrację+org-scope; brak migracji dla `my_idea_map_snapshots` i `my_idea_activity` → endpointy zwrócą 503 na nieprzygotowanej DB |
| C. Testy automatyczne | 15 | 9/15 | 64 testy FE zielone; smoke sync 8 testów; ale zero testów BE route `/map/sync`; e2e checklist poza CI; p12-integration dotyczy odrębnego v8 modułu |
| D. Żywa użyteczność | 15 | 0/15 | FAZA 4 NIEWYKONANA (subagent bez przeglądarki) — hard cap max 70 zastosowany |
| E. Kanony/UI | 10 | 7/10 | Brak §27 dla tabel (moduł nie eksponuje tabeli listowej — canvas); ModuleHub prawidłowy; i18n: string "Cost roseuction" widoczny dla PL i EN; brak align/snap |
| F. Bezpieczeństwo/dostęp | 10 | 7/10 | HTTP endpoints org-scoped poprawnie; WS `/ws/collab/:ideaId` — brak weryfikacji, czy łączący się użytkownik należy do org właściciela idei (P1); beta-gating przez SSOT betaAccess.ts |
| G. Środowiska (Railway) | 10 | 7/10 | Migracje główne realne (5 plików); brak migracji 2 tabel pomocniczych; flagi domyślne bezpieczne; Faza 3 bez curl-smoke (brak uprawnień Railway w subagent) |
| **Hard cap zastosowany?** | — | — | Faza 4 niewykonana → max 70; suma surowa = 57, poniżej 70 → cap nieaktywny |

**Werdykt:** Rdzeń Mind Map — persystencja wersjonowana, org-scoped HTTP, collab WS z JWT, 64 testy FE — jest realny i produkcyjnie solidny. Trzy rzeczy blokują wyższy tier: (1) brak migracji dla tabel snapshots i activity powoduje 503 dla dwóch grup endpointów na nieprzygotowanej bazie; (2) luka w izolacji WS — room kluczowany ideaId bez sprawdzenia przynależności do org; (3) widoczny dla użytkownika string "Cost roseuction" i eksport PowerPoint zwracający HTML zamiast .pptx podważają zaufanie do warstwy eksportu. Moduł jest Beta-ready po domknięciu Fali 1 i przeprowadzeniu Fazy 4.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)

**Checklist pozycji inwentarza:** 37 funkcji zidentyfikowanych w MODULE_02B_mind-map.md + INV_B (persystencja, edycja, collab, AI backend, import/eksport, snapshots, komentarze, activity)

**Scenariusze krytyczne:**
1. **S1 — Happy path E2E:** Utwórz ideę → otwórz mapę → dodaj 3 węzły (Tab/Enter) → zapisz (Cmd+S) → przeładuj stronę → zweryfikuj trwałość węzłów w DB
2. **S2 — Konflikt wersji:** Otwórz mapę na 2 oknach → zmodyfikuj na obu → sprawdź 409 + toast + refresh
3. **S3 — Collab WS:** Dwóch użytkowników tej samej org → kursory widoczne wzajemnie → blokada węzła → graph_patch propaguje
4. **S4 — AI expand:** Klik "Rozwiń gałąź" → real LLM call → węzły dodane do mapy
5. **S5 — Export:** Eksport Markdown, JSON, SVG/PNG → pliki poprawne; eksport PPT → czy HTML czy .pptx?
6. **S6 — Snapshots:** Zapisz snapshot → lista → przywróć → mapa wraca do stanu

**Obowiązujące kanony:** §27 TABLE_AND_PREVIEW_CANON: nie dotyczy (brak tabeli listowej — moduł to canvas, nie lista) · CARD_CONTENT_FORMULA: nie dotyczy · beta-gating: SSOT `betaAccess.ts:58` `MYWORK_IDEAS: 'closed'` + `BETA_ADMINS_EXEMPT = false` (zablokowane dla wszystkich ról)

---

## 1. Prawda kodu (FAZA 1)

### 1a. REALNE (zweryfikowane)

- **Persystencja główna (łańcuch):** `mindmap/useMindMapPersistence.ts:590-754` → `canvas/workspaceGraphRuntime.ts:268-300` → `canvas/useIdeaMapSync.ts:232-314` → `POST /my-ideas/:id/map/sync` (`my-work.routes.ts:3874`) — baseVersion, 409 conflict, IDEA_MAP_EMPTY_RESET_BLOCKED guard, merge extensions, scoping user+org. REALNE.
- **GET /my-ideas/:id/map:** `my-work.routes.ts:3365` — auth+org-scope+requireTables+default skeleton+schema upgrade. REALNE.
- **PUT /my-ideas/:id/map (legacy):** `my-work.routes.ts:3613`. REALNE.
- **POST /map/expand, /map/ai-suggestions, /map/gap-analysis:** `:4073, :4288, :4384` — LLM via `llmService+modelRouter`. REALNE.
- **Offline/draft:** localStorage z flagą pending+guard baseVersion `useIdeaMapSync.ts:90-172`; flush na visibilitychange/online/beforeunload/Cmd+S `:338-373`. REALNE.
- **Viewport:** `extensions.mindmap.viewState.viewport` + fallback localStorage `useMindMapPersistence.ts:325-334`. REALNE.
- **Edycja — pełna gramatyka klawiaturowa:** Tab/Enter/F2/Delete/Space/strzałki/Alt/Cmd+Z/Shift+Z `IdeaRecommendationMap.tsx:3086-3411`. REALNE.
- **Undo/redo 50 kroków:** `IdeaRecommendationMap.tsx:2128-2180` (uwaga: identyfikatory `roseoStackRef`/`roseo` przez korupcję codemodu, ale logika działa). REALNE.
- **Drag-to-reparent:** `IdeaRecommendationMap.tsx:2637-2668`, `useMindMapNodes.tsx:573-739`. REALNE.
- **Collab WS:** `CollaborationOverlay.tsx:147-148` → `/ws/collab/:ideaId` → `gateways/ideaCollabWs.gateway.ts` (442 linie, JWT auth przy upgrade, presence, kursory, node lock, heartbeat). REALNE.
- **Layouty:** rekurencyjne drzewo `useAutoLayout.ts`, radialny `RadialTreeLayout.tsx`, force-directed `ForceDirectedLayout.tsx`, struktury `StructureLayouts.ts`. REALNE.
- **Import/eksport (częściowo):** FreeMind .mm/XMind ZIP/OPML parsery `ImportExternalMap.tsx:26-90`; Markdown/JSON/CSV `useMapExport.ts`; Mermaid/PlantUML `ExportDiagramCode.tsx`. REALNE.
- **SVG/PNG export:** `useMapExport.ts`. REALNE.
- **Snapshots endpointy:** `GET/POST/DELETE /map/snapshots` `:4508-4619` → tabela `my_idea_map_versions` (ale uwaga: route używa `my_idea_map_snapshots` — patrz §1c). REALNE warunkowo.
- **Komentarze do węzłów:** `NodeCommentThread.tsx:80-144` → `my-work.routes.ts:4656-4761` → `idea_node_comments` (migracja `720_idea_node_comments.sql`). REALNE.
- **LargeMapOptimizer:** progi 150/300/500+simplified mode `LargeMapOptimizer.tsx:11-40`. REALNE.
- **VoiceToNode:** Web Speech API `VoiceToNode.tsx:27-38`. REALNE.
- **AI LLM calls (real, ale generic prompt):** `/map/ai-suggestions` używa `llmService` z prawdziwym LLM — call jest realny.

### 1b. MOCK / STUB / fabrykowane klientem

- **AISentimentOverlay:** `AISentimentOverlay.tsx:56-81` — sentyment z progu `confidence` przypisywany pozycyjnie po indeksie do węzłów. Wynik semantycznie losowy. FAKE FEATURE.
- **AIAutoClustering:** `AIAutoClustering.tsx:73-92` — dopasowanie przez 10-znakowe substrings; fallback: `slice(idx*2, idx*2+2)`. FAKE FEATURE.
- **AIDependencyDetector, AIPriorityRecommender, AICompetitiveLandscape, AIWhatIfScenarios, BranchSummaryPanel, DocumentToMap, InterviewToMap:** wszystkie przez jeden generyczny prompt `getMyIdeaAISuggestions` (topics/findings/next_steps `my-work.routes.ts:4334-4344`). Real call, fake feature.
- **ExportPowerPoint:** pobiera plik **HTML** (`-presentation.html`) nie .pptx `ExportPowerPoint.tsx:91-95`. Etykieta „PowerPoint" myląca dla użytkownika.
- **EmbedInReports:** kopiuje snippet HTML do schowka, brak pipeline'u `EmbedInReports.tsx:64-120`. STUB.
- **WebhookSettings:** webhooki w localStorage per przeglądarka, fire-and-forget fetch z klienta `WebhookSettings.tsx:44-67`. STUB (brak serwera).
- **MindMap3DView:** CSS perspective bez WebGL `MindMap3DView.tsx:3,193`. PSEUDO.

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE

- **Korupcja codemodu "red"→"rose"** (commit 24ccb176d9): `roseoStackRef`/`roseo` zamiast `redoStackRef`/`redo` `IdeaRecommendationMap.tsx:2129-2173`; `focusFilteroseNodes` `:2077`; **widoczny string `'Cost roseuction'`** `:1001`; `'Recoverose previous debug session'` `:1824`. Dotyczy też `notebook/AIChatInlinePanel.tsx`.
- **Flush przy zamknięciu karty bez keepalive/sendBeacon:** `useIdeaMapSync.ts:350-354` — okno utraty danych przy zmianie urządzenia.
- **`my_idea_map_snapshots` — brak migracji:** tabela używana przez `GET/POST/DELETE /map/snapshots` ale nie ma `.sql` w `server/migrations/` (tylko `my_idea_map_versions` ma `622_my_idea_map_versions.sql`). Endpointy zwrócą 503 jeśli tabela nie istnieje. WIDOCZNE-ALE-ZEPSUTE na nieprzygotowanej DB.
- **`my_idea_activity` — brak migracji:** `my-work.routes.ts:4818,4867` insert do `my_idea_activity`, brak pliku `.sql` w `server/migrations/`. WIDOCZNE-ALE-ZEPSUTE.
- **Dwa równoległe drawery:** `mindmap/NodeDetailDrawer.tsx` (1042 ln) + `IdeaNodeDetailDrawer.tsx` (1374 ln) — ~2400 ln zdublowanej odpowiedzialności. Ryzyko regresji.
- **Teresa — brak realnej integracji:** sidekick event `idea-mindmap-sidekick-context` `IdeaRecommendationMap.tsx:2534` wysyłany, ale `useOpenChatWithContext.ts` go nie konsumuje. WIDOCZNE-ALE-ZEPSUTE (event wychodzi w próżnię).

### 1d. UKRYTE / MARTWY KOD

- **`mindmap/mindMapTemplates.ts`** — 0 importerów; `dead code`. Rekomendacja: wytnij.
- **`src/components/MyWork/IdeasMindMap.tsx` (deprecation shim 33 linie)** — redirect do `/my-work/ideas` `IdeasMindMap.tsx:23-31`. Świadomie pozostawiony dla kompatybilności URL; rekomendacja: zostaw.
- **`IdeaSummaryCardNode.tsx` + `IdeaMetricNodes.tsx`** — należą do whiteboardu, nie mindmapy (`whiteboard/nodes/nodeTypes.ts:3-4`). W zakresie M09, nie M06.
- **Flaga `ENABLE_TABLE_PLATFORM_METADATA_FIRST` default false** — blokuje projekcję tabeli do mapy. Funkcja ukryta za flagą.

### 1e. Wiring FE↔BE↔DB

| Funkcja | Endpoint | Tabela DB | Migracja | Status |
|---|---|---|---|---|
| Pobierz mapę | `GET /my-ideas/:id/map` | `my_idea_maps` | `20260312_my_idea_maps.sql` | REALNE |
| Metryki mapy | `GET /my-ideas/metrics/map` | `my_idea_maps` | `20260312_my_idea_maps.sql` | REALNE |
| Zapisz mapę (legacy) | `PUT /my-ideas/:id/map` | `my_idea_maps` | `20260312_my_idea_maps.sql` | REALNE |
| Sync mapy (wersjonowany) | `POST /my-ideas/:id/map/sync` | `my_idea_maps` | `20260312_my_idea_maps.sql` + `633_v4_idea_canonical_schema.sql` | REALNE |
| Rozszerz gałąź | `POST /my-ideas/:id/map/expand` | `my_idea_maps`, `my_ideas` | istniejące | REALNE |
| AI suggestions | `POST /my-ideas/:id/map/ai-suggestions` | `my_ideas` | `20260220_my_work_my_ideas.sql` | REALNE (real LLM) |
| Gap analysis | `POST /my-ideas/:id/map/gap-analysis` | `my_ideas` | `20260220_my_work_my_ideas.sql` | REALNE |
| Snapshoty (lista) | `GET /my-ideas/:id/map/snapshots` | `my_idea_map_snapshots` | **BRAK MIGRACJI** | ZEPSUTE (503 jeśli tabela nie istnieje) |
| Snapshot (utwórz) | `POST /my-ideas/:id/map/snapshots` | `my_idea_map_snapshots` | **BRAK MIGRACJI** | ZEPSUTE |
| Snapshot (usuń) | `DELETE /my-ideas/:id/map/snapshots/:id` | `my_idea_map_snapshots` | **BRAK MIGRACJI** | ZEPSUTE |
| Komentarze węzła | `GET/POST/DELETE /map/nodes/:nodeId/comments` | `idea_node_comments` | `720_idea_node_comments.sql` | REALNE |
| Activity feed | zapis w routes | `my_idea_activity` | **BRAK MIGRACJI** | ZEPSUTE |
| Auto-snapshoty wersji | wewnętrzny zapis | `my_idea_map_versions` | `622_my_idea_map_versions.sql` | REALNE |
| Collab WS | `/ws/collab/:ideaId` | `collab_sessions` | `648_v4_collab_sessions.sql` + `20260604_collab_sessions_duration.sql` | REALNE |

### 1f. Flagi

| Flaga | Default BE | Default FE | Kto włącza | Wpływ na moduł |
|---|---|---|---|---|
| `ENABLE_TABLE_PLATFORM_METADATA_FIRST` | `false` (`FeatureFlags.ts:23`) | n/d | env var | Projekcja tabeli DB do mapy — wyłączone |
| `BETA_ADMINS_EXEMPT` | n/d | `false` (`betaAccess.ts:32`) | hardcode | Adminowie NIE mają dostępu do Ideas; zablokowane dla wszystkich |
| `MYWORK_IDEAS` betaAccess | n/d | `'closed'` (`betaAccess.ts:58`) | hardcode | Cały moduł Ideas zablokowany w UI |
| `ENABLE_DELIVERABLES_LIGHT` | `false` (`FeatureFlags.ts:33`) | n/d | env var | Nie wpływa bezpośrednio na Mind Map |

### 1g. Połączenia międzymodułowe

| Kierunek | Moduł po drugiej stronie | Mechanizm | Plik:linia | Status |
|---|---|---|---|---|
| WEJŚCIE ← | M05 Ideas zarządzanie | deep-link/lazy mount przez `MyWorkHub.tsx:142,3085` | `MyWorkHub.tsx:142` | DZIAŁA |
| WEJŚCIE ← | M22 AI OS (Teresa) | sidekick event `idea-mindmap-sidekick-context` wysyłany przez mapę | `IdeaRecommendationMap.tsx:2534` | ZEPSUTE (brak konsumenta) |
| WYJŚCIE → | M05 Ideas zarządzanie | EventBus `mywork-open-item` | `MyWorkHub.tsx` | DZIAŁA |
| WYJŚCIE → | M01 Czat (Teresa) | `useOpenChatWithContext` — NIE konsumuje sidekick event | `src/hooks/useOpenChatWithContext.ts` | ZEPSUTE |
| WYJŚCIE → | M18 Dokumenty | `ConvertTo` inicjatywa/raport | `IdeaMapWorkspace.tsx` | DZIAŁA (wg analizy) |
| WYJŚCIE → | Import zewnętrzny | FreeMind/XMind/OPML parsery | `ImportExternalMap.tsx:26-90` | DZIAŁA |
| WYJŚCIE → | Eksport | Markdown/JSON/CSV/SVG/PNG/Mermaid/PlantUML | `useMapExport.ts`, `ExportDiagramCode.tsx` | DZIAŁA |
| WYJŚCIE → | Eksport PPT | `ExportPowerPoint.tsx:91-95` | plik HTML nie .pptx | ZEPSUTE |

---

## 2. Testy automatyczne (FAZA 2)

**Uruchomienie (unit mindmap):** `npx vitest run tests/unit/mindmap/` @ `f8fec59`
→ **PASS 55 / FAIL 0 / SKIP 0** w 4.56s (10 plików)

**Uruchomienie (ideaMapSyncPersistence):** `npx vitest run src/components/MyWork/canvas/__tests__/ideaMapSyncPersistence.smoke.test.ts`
→ **PASS 8 / FAIL 0 / SKIP 0** w 0.74s

**Uruchomienie (redirect shim):** `npx vitest run tests/components/MyWork/IdeasMindMap.redirect.test.tsx`
→ **PASS 1 / FAIL 0 / SKIP 0** w 0.79s

| Plik testu | Zakres | Liczba | Wynik | W CI? |
|---|---|---|---|---|
| `tests/unit/mindmap/mindMapNodeModel.test.ts` | model węzła (normalizacja, style, tagi) | 6 | PASS | TAK (unit) |
| `tests/unit/mindmap/mindmapInteractionGrammar.test.ts` | gramatyka akcji klawiatury | 4 | PASS | TAK (unit) |
| `tests/unit/mindmap/extensionsMerge.test.ts` | merge extensions przy zapisie | 3 | PASS | TAK (unit) |
| `tests/unit/mindmap/branchColor.test.ts` | kolory gałęzi | 4 | PASS | TAK (unit) |
| `tests/unit/mindmap/colorPickerPopover.test.tsx` | color picker UI | 5 | PASS | TAK (unit) |
| `tests/unit/mindmap/canvasLeftToolbar.test.tsx` | lewy pasek narzędzi | 6 | PASS | TAK (unit) |
| `tests/unit/mindmap/floatingNodeToolbar.test.tsx` | toolbar węzła | 8 | PASS | TAK (unit) |
| `tests/unit/mindmap/floatingToolbarDropdowns.test.tsx` | dropdowny toolbara | ~8 | PASS | TAK (unit) |
| `tests/unit/mindmap/modals.test.tsx` | modale | ~6 | PASS | TAK (unit) |
| `tests/unit/mindmap/moreToolsPanel.test.tsx` | panel więcej narzędzi | ~5 | PASS | TAK (unit) |
| `src/components/MyWork/canvas/__tests__/ideaMapSyncPersistence.smoke.test.ts` | sync/conflict/offline | 8 | PASS | NIE (nie w `test:e2e:tier0`) |
| `tests/components/MyWork/IdeasMindMap.redirect.test.tsx` | redirect shim | 1 | PASS | TAK (component) |
| `tests/e2e/smoke/qa-idea-mindmap-checklist.spec.ts` | pełny E2E 361 linii | n/d | NIE URUCHOMIONY | NIE (tier0 go wyklucza) |
| `tests/integration/p12-mindmap-builder.contract.test.ts` | kontrakt v8 mindmap (odrębny moduł) | ~20 | n/d | NIE dotyczy M06 |
| BE route tests `/map/sync` | konflikty, empty-reset, merge | 0 | BRAK | NIE |

**Pokrycie scenariuszy krytycznych:**

| Scenariusz | FE | BE | E2E | CI | Luka |
|---|---|---|---|---|---|
| S1 — Happy path persist+reload | Smoke (sync) PASS | BRAK | NIE URUCHOMIONY | NIE | Brak BE integration + E2E poza CI |
| S2 — Konflikt 409 | Smoke (conflict) PASS | BRAK | NIE URUCHOMIONY | NIE | Brak BE integration |
| S3 — Collab WS | Overlay degraded (inny test) | BRAK | NIE URUCHOMIONY | NIE | Brak testu WS gateway |
| S4 — AI expand | BRAK | BRAK | NIE URUCHOMIONY | NIE | Zero pokrycia |
| S5 — Export formats | BRAK | BRAK | NIE URUCHOMIONY | NIE | Zero pokrycia |
| S6 — Snapshots | BRAK | BRAK | NIE URUCHOMIONY | NIE | Zero + brak migracji |

**Backlog testowy:**
1. [P0] Integration BE — `tests/integration/mywork-map-sync.contract.test.ts` — konflikt baseVersion/409, empty-reset guard, merge extensions
2. [P0] Integration BE — snapshot CRUD (po naprawie brakującej migracji)
3. [P1] Unit — `tests/unit/mindmap/exportFormats.test.ts` — Markdown/JSON/SVG output poprawność
4. [P1] Unit — `tests/unit/ws/ideaCollabWs.test.ts` — JWT auth, org-scope guard (gdy dodany), graph_patch broadcast
5. [P2] E2E tier0 — dodać `qa-idea-mindmap-checklist.spec.ts` do `test:e2e:tier0` po naprawie środowiska

---

## 3. Środowiska / Railway (FAZA 3)

> Subagent nie ma dostępu do poświadczeń Railway — Faza 3 wykonana na podstawie analizy kodu i znanych wzorców.

| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit | nieznany (brak Railway CLI) | ~2026-05-18 | Delta nieznana — prod może nie mieć migracji 633+648+720+622 |
| `my_idea_maps` | migracja 20260312 | prawdopodobnie brak | Prawdopodobny schema drift |
| `my_idea_map_versions` | migracja 622 | prawdopodobnie brak | Schema drift |
| `my_idea_map_snapshots` | **BRAK MIGRACJI w repo** | BRAK | GET/POST/DELETE /map/snapshots → 503 |
| `my_idea_activity` | **BRAK MIGRACJI w repo** | BRAK | Activity insert → error (cicha degradacja) |
| `collab_sessions` | 648+20260604 | prawdopodobnie brak | WS join persist może failować |
| `idea_node_comments` | migracja 720 | prawdopodobnie brak | Komentarze → 503 na prod |
| Flagi env | `ENABLE_TABLE_PLATFORM_METADATA_FIRST=false` bezpieczne | — | OK domyślnie |
| Smoke endpointów | nie wykonano (brak token Railway) | — | Nieweryfikowalne bez dostępu |
| Logi błędów 24h | nie wykonano | — | Nieweryfikowalne |

**Uwaga:** Prod = commit ~2026-05-18 (przed migracjami 620+ serii). Wszystkie endpointy Mind Map prawdopodobnie zwracają 503 na prod do czasu promocji Londyn.

---

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)

**Status: NIEWYKONANA** — subagent autonomiczny bez dostępu do przeglądarki/preview.

Hard cap: max 70 pkt. Wymiar D = 0/15.

Do wykonania przez Claude (main session) wg skryptu Protokołu V1:
- S1: utwórz ideę → mapa → dodaj węzły → Cmd+S → reload → weryfikacja trwałości
- S2: dwa okna → konflikt → toast 409
- S3: collab cursors
- S4: AI expand (real LLM?)
- S5: eksport PPT (potwierdzić HTML vs .pptx)
- S6: snapshot CRUD
- Sprawdzić string "Cost roseuction" widoczny w UI
- Sprawdzić konsola pod kątem errorów React (duplicate key warnings znalezione w testach)

---

## 5. Kanony i standardy (FAZA 5)

**§27 TABLE_AND_PREVIEW_CANON:** Nie dotyczy — moduł M06 to canvas (IdeaRecommendationMap), nie tabela listowa. Brak powierzchni podlegającej §27.

**CARD_CONTENT_FORMULA:** Nie dotyczy — moduł produkuje węzły mapy, nie karty insights/inicjatyw.

**Wzorzec hubowy (ModuleHub):** Prawidłowy — lazy mount przez `MyWorkHub.tsx:142,3085`; `IdeaMapWorkspace.tsx` jest nadrzędny dla `IdeaRecommendationMap.tsx`. Zgodny z wzorcem.

**Beta-gating:** Zgodny z SSOT `betaAccess.ts` — `MYWORK_IDEAS: 'closed'` + branded beta-plate. Brak własnych mechanizmów.

**UI-standards:**
- Duplicate React key warnings dla kolorów w `ColorPickerPopover` (znalezione w stderr testów) — kosmetyczny bug.
- String `'Cost roseuction'` (`:1001`) i `'Recoverose previous debug session'` (`:1824`) — widoczne dla użytkownika, uszkodzone przez codemod. P1.
- Minimap domyślnie off (`IdeaRecommendationMap.tsx:1900`) — świadoma decyzja UX.
- Brak align/distribute i snap-to-grid — istotna luka vs Miro-standard.

**i18n PL/EN:** Brak systematycznej weryfikacji (wymaga Fazy 4); znane problemy z korupcją codemodu dotyczą obu języków.

**Stany standardowe:** degradacje komunikowane przez toasty i stany `no_route`/`missing_table`/`offline` `useMindMapPersistence.ts:469-486`. OK, ale w legacy ścieżce edycja przy `persistence !== 'online'` nie zapisuje bez komunikatu (:677).

---

## 6. Bezpieczeństwo i dostęp (FAZA 6)

| Warstwa | Nawigacja | Route | API | Dziura? |
|---|---|---|---|---|
| Beta-gating (Ideas całe) | Sidebar zablokowany `Sidebar.tsx` | `MyWorkHub.tsx:607` blokuje render | Brak serwer-side bloku na `/api/my-work/my-ideas` | TAK — API dostępne bez beta-check (ale wymaga JWT) |
| Auth JWT | n/d | n/d | `router.use(verifyToken)` `:74` — WSZYSTKIE endpointy chronione | OK |
| Org-scope HTTP | n/d | n/d | `user_id = ? AND organization_id = ?` wszędzie w `my_idea_maps` i `my_ideas` | OK — pełny multi-tenant |
| Org-scope WS collab | n/d | n/d | JWT verify przy upgrade OK, ale **brak sprawdzenia czy ideaId należy do org z tokenu** | P1 |

**Org-scope HTTP:** Wszystkie endpointy `/my-ideas/:id/map*` wykonują `WHERE idea_id = ? AND user_id = ? AND organization_id = ?` — pełna izolacja multi-tenant. Brak IDOR w HTTP.

**Zasoby publiczne:** Brak publicznych share tokenów dla Mind Map — tylko prywatny dostęp per user. OK.

**WS/realtime — P1 finding:**
- `ideaCollabWs.gateway.ts:258-283` — po weryfikacji JWT przy upgrade (`:218-233`) użytkownik dołącza do room kluczowanego tylko przez `ideaId`.
- Brak zapytania DB weryfikującego, czy `organizationId` z tokenu == `organization_id` właściciela idei.
- Exploit: użytkownik z Org B, który zna UUID idei z Org A (np. przez enumerację lub wyciek w logu), może połączyć się z WS i odbierać `graph_patch` z treścią węzłów cudzej mapy.
- Severity: **P1** (nie P0, bo: moduł beta-closed = ograniczone grono; ideaId to UUID v4; exploit wymaga znajomości UUID; HTTP endpoints są bezpieczne — dane można zapisać tylko przez HTTP który ma org-scope).

**Capabilities serwerowo:** Wszystkie zapisy przez HTTP z org-scope. Brak endpointów "share" dla mapy. OK.

**Sekrety/PII w logach:** `[IdeaCollabWs]` logger loguje `user=${user.id}` i `idea=${ideaId}` — UUID, nie PII. OK.

**Findingi bezpieczeństwa:**
- [P1] **WS collab brak org-scope verify** — `ideaCollabWs.gateway.ts:258-283` — przy joinowaniu do room brak SELECT z `WHERE idea_id=? AND organization_id=?` na tabeli `my_ideas`. Naprawa: dodać DB check przed `wss.emit('connection', ...)`.
- [P2] **API beta-check tylko w UI** — `/api/my-work/my-ideas` dostępne serwerowo dla każdego uwierzytelnionego użytkownika niezależnie od beta-gating. Przy GA otwarciu Ideas nie jest to problem, ale przy beta-closed może być pominięte przez bezpośrednie API.

---

## 7. PLAN DOKOŃCZENIA (FAZA 8)

### Fala 1 — Integralność (P0/P1)

1. **Naprawa korupcji codemodu "red"→"rose"** — widoczny string `'Cost roseuction'` (`IdeaRecommendationMap.tsx:1001`) i `'Recoverose previous debug session'` (`:1824`) oraz identyfikatory `roseoStackRef`, `focusFilteroseNodes`, `roseo` (`IdeaRecommendationMap.tsx:2129-2173, 2077`); analogicznie `notebook/AIChatInlinePanel.tsx`. Weryfikacja: grep na "roseoStack|roseuction|Recoverose" = 0 wyników + Faza 4 screenshot.

2. **Migracje brakujące — `my_idea_map_snapshots` i `my_idea_activity`** — Endpointy `GET/POST/DELETE /map/snapshots` i activity insert zwrócą 503/error na każdej bazie bez tych tabel (`my-work.routes.ts:4515, 4818`). Naprawa: stworzyć `server/migrations/<numer>_my_idea_map_snapshots.sql` i `<numer>_my_idea_activity.sql` z `CREATE TABLE IF NOT EXISTS`. Weryfikacja: curl 200 na `/api/my-work/my-ideas/:id/map/snapshots` po migracji.

3. **WS collab — dodać org-scope verify przy joinowaniu** — `ideaCollabWs.gateway.ts:258-283` brak sprawdzenia, czy ideaId należy do org użytkownika z JWT. Naprawa: przed `room.set(ws, user)` dodać `db.get('SELECT id FROM my_ideas WHERE id=? AND organization_id=?', [ideaId, organizationId])` i zamknąć socket przy braku wyniku. Weryfikacja: test jednostkowy WS gateway — user z Org B nie dołącza do rooma idei z Org A.

4. **`[INTEGRACJA — INTEGRACJE.md §C poz.4 / Sprint 7+ (Fala 3)]`** ExportPowerPoint — uczciwa etykieta lub prawdziwy .pptx — `ExportPowerPoint.tsx:87-95` generuje `.html`, nie `.pptx` (UI label sam przyznaje). Naprawa: zmienić etykietę na „Export as HTML Presentation" LUB zaimplementować `pptxgenjs`. Weryfikacja: pobrany plik ma rozszerzenie zgodne z etykietą.

5. **WebhookSettings — usunąć lub przenieść na serwer** — `WebhookSettings.tsx:44-67` wysyła webhooki bezpośrednio z klienta przez localStorage. Naprawa: wyciąć feature flag lub dodać endpoint serwer-side. Weryfikacja: brak fetch do zewnętrznych URL z klienta.

### Fala 2 — Domknięcie wartości (P1)

6. **Testy integracyjne BE dla `/map/sync`** — brak testów route'ów konflikt baseVersion/409, empty-reset guard, merge extensions. Naprawa: `tests/integration/mywork-map-sync.contract.test.ts`. Weryfikacja: CI zielone.

7. **Dodanie `qa-idea-mindmap-checklist.spec.ts` do CI tier0** — E2E spec istnieje (361 ln) ale nie jest w `test:e2e:tier0` (`package.json:108`). Naprawa: dodać do komendy tier0 lub stworzyć podzbiór deterministic tier0. Weryfikacja: CI pipeline uruchamia spec.

8. **`[INTEGRACJA — INTEGRACJE.md §C poz.6 / Sprint 7+ (Fala 2)]`** Teresa — integracja sidekick event — event `idea-mindmap-sidekick-context` wysyłany z `IdeaRecommendationMap.tsx:2534`; konsumowany lokalnie w toolbarze (`AIActionsPopover.tsx:91`, `FloatingAIPopover.tsx:54`), ale **NIE przez `useOpenChatWithContext`** — bogaty kontekst węzłów nie dociera do czatu Teresy. Naprawa: dodać handler `idea-mindmap-sidekick-context` w `useOpenChatWithContext` (przekazać `sidekickCtx` zamiast prostego promptu). Weryfikacja: klik „Zapytaj Teresę o tę mapę" → czat Teresy otwiera się z kontekstem węzłów (nie generyczny prompt).

9. **Flush przy zamknięciu karty — sendBeacon/keepalive** — `useIdeaMapSync.ts:350-354` używa zwykłego fetch bez `keepalive`, co może gubić ostatni zapis przy zamknięciu karty. Naprawa: dodać `keepalive: true` do fetch lub `navigator.sendBeacon`. Weryfikacja: zamknij kartę podczas edycji → dane zapisane w DB.

### Fala 3 — Jakość i kanony (P2)

10. **Konsolidacja dwóch drawerów** — `mindmap/NodeDetailDrawer.tsx` (1042 ln) + `IdeaNodeDetailDrawer.tsx` (1374 ln) — ~2400 ln duplikacji. Naprawa: wybrać canonical i usunąć drugi. Weryfikacja: grep na obu importach = 1 punkt montażu.

11. **Uczciwe AI overlays** — AISentimentOverlay/AIAutoClustering zamiast fabrykowania wyników po stronie klienta: dedykowane endpointy z prawdziwym LLM per funkcja. Weryfikacja: AI Clustering grupuje semantycznie powiązane węzły (ocena manualna).

12. **Usunięcie martwego kodu** — `mindMapTemplates.ts` (0 importerów). Weryfikacja: plik usunięty, tsc zielone.

13. **Align/distribute, snap-to-grid** — brakuje podstawowych narzędzi kompozycji vs Miro. Naprawa: implementacja `useAlignment.ts` + toolbar button. Weryfikacja: Faza 4 screenshot — wybrane węzły można wyrównać.

14. **Naprawa React duplicate key w ColorPickerPopover** — stderr testów: `Encountered two children with the same key, #3b82f6`. Weryfikacja: test suite bez warnings.

### Definition of Done (odhaczane przy realizacji)

- [ ] 1. Testy auto FE+BE scenariuszy krytycznych zielone w CI (brakuje: BE integration map/sync + snapshot + WS test)
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami (screenshots + console czyste)
- [ ] 3. Railway: migracje `my_idea_map_snapshots` + `my_idea_activity` zastosowane, smoke endpointów 200, czyste logi
- [ ] 4. Kanony: brak string "Cost roseuction" w UI, ExportPPT uczciwa etykieta
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE (snapshots endpoint działa, WS org-scope fixed)
- [ ] 6. Zero cichych degradacji bez komunikatu (legacy persist !== 'online' → użytkownik powiadomiony)
