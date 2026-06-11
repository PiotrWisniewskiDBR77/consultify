# Moduł 02D — Ideas: Table — Karta audytu + plan rozwoju

**Data audytu:** 2026-06-11 (branch `feat/deliverables-light`) · **Metoda:** weryfikacja realnego kodu, dowody `plik:linia`
**Gotowość: 60/100 — Beta+**

**Werdykt:** Rdzeń legacy (grid + 7 widoków + 25 typów kolumn + realne AI przez llmService + trwałość map-sync + 137 testów) jest solidny i działa, ale ~40% powierzchni UI to uśpiony kod platformy za flagą domyślnie OFF, a 4 widoczne funkcje (konektory, activity feed, audit trail, snapshoty) są w trybie produkcyjnym martwe — biją w nieistniejące/nieautoryzowane endpointy.

**Uwaga tożsamościowa:** `IdeasTableContent.tsx` to NIE narzędzie Tabela — to lista pomysłów (inwentarz My Ideas wg kanonu Table+Preview); sam tool to `IdeaTableTool.tsx` (3692 linie), jedyny mount: `IdeaMapWorkspace.tsx:2849` (z ErrorBoundary).

---

## 1. CO JEST REALNE

**Trwałość (ścieżka produkcyjna):**
- `table/useTablePersistence.ts:118-159` — pełny payload do map-sync: kolumny (key/header/type/width/options/optionColors/formula/aiPrompt/aggregation), savedViews, activeViewId, viewState (sort/filters/groupBy), formatRules, viewLayout — wszystko w `extensions.table`.
- `:161-264` — hydratacja z `Api.getMyIdeaMap` z normalizacją typów node'ów i artifactLinks; `:275-288` manualny zapis z checkpointem; `:290-293` autosave draft.
- `canvas/useIdeaMapSync.ts:264-267` — konflikt 409 z `baseVersion`, stany idle/queued/saving/saved/offline/conflict.
- Server: `POST /my-ideas/:id/map/sync` + projekcja platformy tylko gdy `ENABLE_TABLE_PLATFORM_METADATA_FIRST` (`my-work.routes.ts:3508-3520`).

**AI — realne wywołania LLM (nie mocki):**
- `AITableAssistant.tsx:151` → `POST /my-ideas/:id/ai-table-action` (`my-work.routes.ts:8755`) → `generateTableAction` (`ideaAISuggestionsService.ts:381-432`) — prawdziwy llmService + modelRouter (tier BUDGET); sort/filter/group/add_column/add_rows/summarize. Wysyła artifactContext — grounding na wierszach (`IdeaTableTool.tsx:2457-2465`).
- `InlineAIFill`/`BatchAIFillButton` → `POST /my-ideas/:id/ai-fill` (:8790) → `generateAIFill` (`ideaAISuggestionsService.ts:434-491`) — LLM tier STANDARD + kontekst assessmentów firmy.
- `AICopilotMode.tsx:157-170` → `Api.getIdeaAISuggestions` → `generateSuggestions` — 4 tryby (brainstorm/devil's advocate/expand/summarize).
- `AICategorizeTool.tsx:63-82` — realne LLM klastrowanie + duplikaty; `IdeaScoringModel.tsx:137`, `TableSummaryDashboard.tsx:116`, `VoiceImageInput.tsx:154` (Web Speech API + LLM) — wszystkie na realnym endpoincie.

**Rdzeń tabeli:**
- 25 typów kolumn z pełną mapą rendererów — `CellRenderer.tsx:489-515` (text/number/select/multiselect/status/date/checkbox/rating/person/url/progress/formula/ai_generated/file/relation/rollup/emoji/color/currency/phone/email/created_time/created_by/last_edited_time/last_edited_by).
- 7 widoków legacy działających: table (`IdeaTableTool.tsx:2767+`), kanban (:2701), calendar (:2719), grid/gallery (:2728), matrix z wyborem osi (:2736), timeline (:2683), sticky (:2693).
- `FormulaEngineV2.ts` — SUM/AVG/MIN/MAX/COUNT po `children.`/`related.` (po krawędziach grafu), IF, CONCAT, SCORE, arytmetyka.
- Undo/redo 50 kroków (`useUndoRedo.ts:11-25`), klawiatura Tab/Enter/Arrows/Ctrl+Z (`useTableKeyboard.ts`), CSV import/export + clipboard (`csvUtils.ts`), zapisane widoki, formatowanie warunkowe, heatmapa, rollupy, RowDetailPanel/RecordExpandModal, FrameworkGenerator (lokalne szablony SWOT itp.).
- `ExportToPresentation.tsx:237` → `Api.createPresentationDeck` — realny eksport do decka.
- `CrossTableRelations.tsx:142` — realne łączenie między mapami idei.
- **`applyProposal` NIE jest już stubem** (stan z 2026-06-02 nieaktualny): `TableAiEditorService.ts:336-430` wykonuje realne mutacje przez `executeProposalOperations`.

## 2. CO JEST MOCK / STUB / HARDCODE

- **Fałszywy streaming** — `AICopilotMode.tsx:117-131` `simulateStreaming()`: odpowiedź przychodzi w całości, potem „wypisywana" setIntervalem.
- **Cichy fallback ai-fill**: błąd LLM → wszystkie komórki dostają `'—'` bez informacji o błędzie (`ideaAISuggestionsService.ts:488-490`).
- **Cichy fallback kategoryzacji**: nieparsowalny JSON → lokalne klastrowanie po pierwszym słowie labela z confidence 0.5 udającym AI (`AICategorizeTool.tsx:94-118`).
- **Rename tabeli (tab strip) tylko lokalny** — `IdeaTableTool.tsx:791-797` zmienia nazwę w stanie Reacta, zero API → znika po przeładowaniu.
- **`saveStatusLabel` platformy = hardcode** „Automatycznie zapisane" niezależnie od faktu zapisu (`useTablePlatformIntegration.ts:518`).
- FrameworkGenerator — hardcodowane definicje (`FrameworkGenerator.tsx:39`); legitne jako szablony, ale UI sugeruje „generator".

## 3. CO JEST ZEPSUTE / BRAKUJĄCE

- **Konektory danych — 404 zawsze**: `useConnectors.ts:112` woła `/api/workspaces/{id}/connectors`, a serwer montuje connector CRUD pod `/api/table-platform/connectors` (`Gateway.ts:953` + `data-collection.routes.ts:91-458`); mount `/api/workspaces` nie istnieje. Przycisk „Import" widoczny w legacy (`TableToolbar.tsx:1058-1065`) → wizard zawsze kończy się błędem.
- **ActivityFeed — 401 zawsze**: surowy `fetch('/api/table-platform/tables/{id}/audit')` **bez Authorization** (`ActivityFeed.tsx:148-150`), trasa wymaga verifyToken (`table-platform.routes.ts:306`); dodatkowo tableId=ideaId (id mapy, nie tp_tables). Przycisk widoczny (`IdeaTableTool.tsx:1828, 3332`).
- **AuditTrailPanel — 404 zawsze**: `fetch('/api/tables/{id}/audit')` (`AuditTrailPanel.tsx:177`) — mount `/api/tables` nie istnieje.
- **SnapshotManager — 404 zawsze**: `fetch('/api/bases/{id}/snapshots')` (`SnapshotManager.tsx:117,136,157`) — mount `/api/bases` nie istnieje; przycisk widoczny (`IdeaTableTool.tsx:1837`).
- **Martwa gałąź renderu**: `IdeaTableTool.tsx:2641-2682` — `usePlatform && (kanban|calendar|grid)` NIEOSIĄGALNE (wcześniejszy warunek :2635 konsumuje przypadki platformy); cały LegacyViewRouter + `table/views/` (GalleryView, GanttView, FormView) martwy w runtime.
- **`generate_table` martwe na ścieżce legacy**: frontend obsługuje akcję (`AITableAssistant.tsx:210-246`), ale prompt serwera jej nie zawiera (`ideaAISuggestionsService.ts:391-402`, 0 wystąpień) → promowane przykłady „Stwórz tabelę oceny ryzyka…" (`AITableAssistant.tsx:41,51`) **nigdy nie zadziałają** przy fladze OFF.
- **Operatory `between`/`in`** zadeklarowane (`tableTypes.ts:50-58`), niezaimplementowane w filtrze legacy (`useTableRows.ts:86-96` — 6 operatorów, default przepuszcza).
- `generateTableAction`: `JSON.parse(content)` wprost (`ideaAISuggestionsService.ts:425`) — odpowiedź w ```json fences → cichy error.
- **Martwe pliki**: PublicFormView.tsx, RecordTemplateManager.tsx, useAttachments.ts, useAuditTrail.ts, katalog `offline/`.

## 4. Wiring backendu + granica z modułem Tabele (platforma)

**Architektura dual-stack z przełącznikiem flagowym:**
- **Ścieżka A (PRODUKCYJNA, legacy)**: IdeaTableTool → useTablePersistence → useIdeaMapSync → `POST /my-work/my-ideas/:id/map/sync` → `my_idea_maps` (cała tabela = 1 blob JSON). AI → `/my-work/my-ideas/:id/{ai-table-action,ai-fill,ai-suggestions}` → llmService.
- **Ścieżka B (UŚPIONA, platforma)**: `useTablePlatformBridge` (useTablePlatformBridge.ts:147-148) aktywna tylko gdy `tablePlatformMetadataFirst` = ON. **Default frontend: false, `allowLocalOverride: false`, lokalne override'y czyszczone** (`useFeatureFlags.tsx:138-145, 170`). **Default server `ENABLE_TABLE_PLATFORM_METADATA_FIRST: false`** (`server/src/config/FeatureFlags.ts:23`). Jedyna droga włączenia: rekord w `feature_flags` przez `/api/feature-flags/runtime` (per-org, możliwe zdalnie).
- `ENABLE_TABLE_PLATFORM_RECORDS_API` default **true** (FeatureFlags.ts:24) — endpointy `/api/table-platform/*` żyją, ale tool ich nie używa bez metadataFirst.
- Fallback safety: `usePlatform = platformActive && !(platformLooksEmpty && legacyLooksPopulated)` (`IdeaTableTool.tsx:404-409`).
- **Zależne od platformy (martwe przy fladze OFF)**: TableTabStrip/multi-tabele (:3042), StatusBar z agregatami (:3019), zakładki Forms/Interfaces/Models/Workflow (:2547-2633), P15ViewRouter, FormBuilder (:3411), WebhookRelay, realtime socket (`tableId: platformActive ? ideaId : null` :275; serwerowy namespace `/table-platform` istnieje — `RealtimeService.ts:51`), useSchemaProposal/ChatToSchemaPanel, AutomationsManager/SyncManager/SharingManager/DistributionManager.

## 5. Testy

**137 testów / 14 plików — wszystkie PASS** (uruchomione: `vitest run src/components/MyWork/table`, 7.6 s):
- `__tests__/TablePlatformFrontend.test.tsx` (37) — bridge, mappery, P15, breadcrumby, watch, ActivityFeed path (test potwierdza URL, ale nie auth!).
- `PlatformCellRenderer.specialized.test.tsx`, `cells/__tests__/` (5 plików), `provenance/__tests__/` (5 plików), `forms/__tests__/` (2).
- **Luka**: testy pokrywają głównie ścieżkę platformy (wyłączoną w prod); zero testów dla useTablePersistence, useTableRows, FormulaEngineV2, csvUtils, widoków legacy — czyli tego, co faktycznie działa u klientów. Nadal najlepiej przetestowane narzędzie Ideas.

## 6. UX vs Airtable/Notion

| Obszar | Stan | Ocena |
|---|---|---|
| Typy kolumn | 25 typów z edytorami, w tym relation/rollup/formula/ai_generated | **A-** (relation/rollup po krawędziach grafu, nie cross-base) |
| Widoki | 7 layoutów + zapisane widoki per-layout; brak Gantt/Form w legacy | **B** |
| Filtry/sort | 6 operatorów, 1 poziom and/or, pojedynczy sort i groupBy; FilterBuilder z 40 operatorami platform-only | **C** |
| Edycja komórek | inline per-typ, Tab/Enter/strzałki, undo/redo, expand popover, bulk select/delete/convert | **B+** |
| Formuły | regex-engine: agregacje children/related, IF/CONCAT/SCORE; brak zagnieżdżania, walidacji, podpowiedzi | **C-** |
| Współpraca | wersjonowanie + 409; realtime/presence wyłącznie za flagami → w praktyce single-player | **C** |
| AI | NL command bar + copilot + kategoryzacja + ai-fill + scoring — realne, **lepszy grounding niż Airtable AI** (kontekst firmy z assessmentów) | **B+** |

---

## 7. PLAN ROZWOJU — Table

### Fala 1 — Zaufanie użytkownika (P0)
1. **Decyzja strategiczna dual-stack: dokończyć migrację metadata-first albo wyciąć ścieżkę B** — ~40% kodu narzędzia gotowe, ale martwe za flagą OFF; każdy tydzień dual-stacku to podwójne utrzymanie wzorca `effective*` (`IdeaTableTool.tsx:301-562`).
2. **Naprawić/ukryć 4 zepsute funkcje widoczne w prod**: Import/konektory (404), ActivityFeed (401), AuditTrailPanel (404), SnapshotManager (404) — użytkownik klika przyciski, które zawsze kończą się błędem.

### Fala 2 — Wartość AI + parytet filtrów (P1)
3. **Naprawić `generate_table` end-to-end** — najbardziej „wow" komenda AI jest promowana w przykładach, ale serwer nigdy jej nie zwraca; dodanie typu akcji do promptu (`ideaAISuggestionsService.ts:391-402`) + parsowanie fenced JSON = małym kosztem największy skok wartości.
4. **Filtry/sort do poziomu Airtable**: between/in, multi-sort, operatory per-typ (przenieść 40-operatorowy FilterBuilder z platformy na legacy).
5. **Historia per-wiersz na ścieżce legacy** — cała tabela to jeden blob; brak audit trail i row-level concurrency, last-write-wins — bez tego nie ma „Airtable-grade" pracy zespołowej.

### Fala 3 — Współpraca i silnik (P2/P3)
6. **Realtime collab w prod** — odblokować socket `/table-platform` (serwer gotowy: `RealtimeService.ts:51`) lub presence po kanale map-sync; zależne od decyzji o wspólnym dokumencie (02A Fala 2).
7. **Silnik formuł v3** — parser zamiast regexów, walidacja, błędy w komórce, autouzupełnianie pól.
8. **Sprzątanie**: nieosiągalna gałąź LegacyViewRouter (:2641), katalog offline/, PublicFormView, RecordTemplateManager, useAuditTrail/useAttachments, lokalny-only rename; testy dla ścieżki legacy (useTablePersistence, useTableRows, FormulaEngineV2).
