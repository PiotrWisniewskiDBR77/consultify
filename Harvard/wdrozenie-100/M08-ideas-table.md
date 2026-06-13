# WP M08 — Ideas — Table · dokończenie do 100%

**Pula:** ideas · **Karta:** `Harvard/modules/M08-ideas-table/KARTA_AUDYTU.md` (ocena 54/100) · **Rozmiar:** M (1–3 dni) · **Żywy bloker:** brak P0 (P1 funkcjonalne — szlif)
**Faza programu:** FAZA 3 (szlif) → FAZA 4 (sweepy) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Rdzeń narzędzia canvas (`IdeaTableTool.tsx`, 3692 l., w `IdeaMapWorkspace.tsx:2877`) solidny i unikalny: trwałość blob-JSON w `my_idea_maps.extensions_json` przez map-sync (`useTablePersistence.ts:118–264`, `my-work.routes.ts:3677`, org+user-scope), 25 typów kolumn, 7 widoków legacy, realne AI (table-action/ai-fill/copilot przez `llmService` + kontekst assessmentów org), FormulaEngineV2, undo/redo, CSV, ExportToPresentation→realny deck, CrossTableRelations, 137 testów PASS. Bez żywego P0. **Zaufanie psują 4 widoczne przyciski zawsze-błąd** (Import 404, ActivityFeed 401, AuditTrail 404, Snapshot 404 — karta zgłasza ActivityFeed/AuditTrail jako naprawione w `606c9f2c0e`/`f35aa8d7c8`, zweryfikować), fałszywy streaming Copilot, cichy fallback ai-fill „—", `generate_table` promowane ale nigdy nie zwracane, oraz **137 testów poza CI**. Inny moduł niż M20 Tabele Studio (table-platform). §27 N.D. (canvas, nie lista).

## 2. Luki do DoD

### (a) FRONTEND / INTEGRACJA — P0/P1 zepsute przyciski (FAZA 3)
- **[P1] 4 przyciski zawsze-błąd.** Import/Konektory → `GET /api/workspaces/:id/connectors` 404 (mount nie istnieje; connector CRUD jest pod `/api/table-platform/connectors`, `useConnectors.ts:112`, przycisk `TableToolbar.tsx:1058–1065`); ActivityFeed → surowy `fetch` bez Authorization + `tableId=ideaId` 401 (`ActivityFeed.tsx:148–150`, przycisk `IdeaTableTool.tsx:1828,3332`); AuditTrail → `/api/tables/:id/audit` 404 (mount nie istnieje, `AuditTrailPanel.tsx:177`); Snapshot → `/api/bases/:id/snapshots` 404 (`SnapshotManager.tsx:117,136,157`, przycisk `:1837`). **Karta:** ActivityFeed naprawione (`606c9f2c0e`), AuditTrail path+auth OK (`f35aa8d7c8`), SnapshotManager USUNIĘTY — **zweryfikować, które żywe.** Fix: naprawić mount/auth ALBO ukryć za flagą `usePlatform`.

### (b) FRONTEND — ciche degradacje / fałszywe afordancje (FAZA 3)
- **[P2] Fałszywy streaming Copilot** — `simulateStreaming()` (`AICopilotMode.tsx:117–131`): odpowiedź przychodzi całością, „wypisywana" setIntervalem.
- **[P2] Cichy fallback ai-fill „—"** — błąd LLM → wszystkie komórki `'—'` bez komunikatu (`ideaAISuggestionsService.ts:488–490`). + cicha kategoryzacja po pierwszym słowie z confidence 0.5 udającym AI (`AICategorizeTool.tsx:94–118`). Fix: toast/error UI.
- **[P1] `generate_table` martwa komenda** — promowana w przykładach (`AITableAssistant.tsx:39–58`), FE obsługuje `case 'generate_table'`, ale prompt serwera (`ideaAISuggestionsService.ts:391–402`) nie zawiera tego typu → LLM nigdy nie wygeneruje. Fix: dodać typ do promptu+parsowanie ALBO usunąć z przykładów.
- **[P1] Fenced JSON crashuje table-action** — `JSON.parse(content)` wprost (`ideaAISuggestionsService.ts:425`); LLM często otacza ```json``` → cichy `type:'error'`. Fix: strip fences.
- **[P2] Rename tabeli tylko React state** (`IdeaTableTool.tsx:791–797`, znika po reload) → PATCH na map extensions.
- **[P2] saveStatusLabel hardcode** „Automatycznie zapisane" (`useTablePlatformIntegration.ts:518`).
- **[P2] between/in filtry przepuszczają** — zadeklarowane (`tableTypes.ts:50–58`), default case (`useTableRows.ts:86–96`) nie filtruje. Fix: implementacja operatorów.

### (c) BEZPIECZEŃSTWO (FAZA 3)
- **[P2] 2 pomocnicze zapytania `my_idea_maps` bez `organization_id`** (`my-work.routes.ts:6022,6097`) w handlerze `develop` — id zweryfikowane wcześniej (ryzyko minimalne), ale formalnie dodać `AND organization_id=?`.
- **[P2] AI endpoints bez ownership check `ideaId`** (`ai-table-action`/`ai-fill`/`ai-suggestions`) — user może wywołać LLM na cudzym UUID (koszt, nie wyciek danych). Fix: `SELECT id FROM my_ideas WHERE id=? AND user_id=? AND organization_id=?` na wejściu.

### (d) MARTWY KOD (FAZA 3)
- Nieosiągalna gałąź `LegacyViewRouter` (`IdeaTableTool.tsx:2641–2682`); `PublicFormView.tsx`, `RecordTemplateManager.tsx`, `useAttachments.ts`, `useAuditTrail.ts`, katalog `offline/`, `GalleryView/GanttView/FormView` w `table/views/` → wytnij.
- Ścieżka platformy (B) za flagą `ENABLE_TABLE_PLATFORM_METADATA_FIRST: false` (~40% kodu) → **decyzja strategiczna dual-stack:** dokończyć metadata-first ALBO wyciąć ścieżkę B (każdy tydzień = podwójne utrzymanie).

### (e) TESTY / E2E — **137 testów poza CI (FAZA 4)**
- **[P0 testowy]** `.github/workflows/test-suite.yml` uruchamia tylko `tests/unit`+`tests/integration` (l. 314, 509) → **żaden z 137 testów `src/components/MyWork/table` w CI.** (Karta: W15 CI gate `99bda16792` — zweryfikować zakres.) Fix: dodać job / rozszerzyć `vitest run src/components/MyWork/table` + CI gate `Londyn`.
- Brak testów ścieżki produkcyjnej: `useTablePersistence` (S1), `generateAIFill` fallback (S3), ActivityFeed brak-auth (S4), fenced JSON parse, between/in.

## 3. Kroki realizacji
1. **(FAZA 3)** Zweryfikować stan 4 przycisków; naprawić mount/auth (Import→`/table-platform/connectors`, ActivityFeed→`getHeaders()`) ALBO ukryć za `usePlatform`. Network tab: zero 4xx.
2. **(FAZA 3)** Strip fenced JSON; `generate_table` E2E lub usunięcie z przykładów; toast przy ai-fill/kategoryzacja fallback; rename→PATCH; saveStatusLabel realny; between/in operatory.
3. **(FAZA 3)** org-scope: `AND organization_id=?` w 2 zapytaniach develop; ownership check `ideaId` w AI endpoints.
4. **(FAZA 3)** Streaming Copilot: realny stream lub uczciwy wskaźnik.
5. **(FAZA 3)** Sprzątanie martwego kodu; decyzja dual-stack (ścieżka B).
6. **(FAZA 4)** Podłączyć 137 testów do CI + testy S1–S5 + CI gate `Londyn`.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** zero przycisków 404/401 (naprawione lub ukryte); rename trwały; persist→reload trwały.
2. **Bezpieczeństwo:** `organization_id` w pomocniczych zapytaniach; ownership check `ideaId` w AI; org+user-scope (już OK).
3. **i18n:** `t()` pełne (koniec `isPl` inline w IdeaTableTool).
4. **Tokeny:** Visual Standard.
5. **§27:** N.D. (canvas) — empty/error/loading states OK.
6. **E2E w PR-gate:** 137 testów + S1–S5 zielone na `Londyn`.

## 5. Weryfikacja
- Przyciski: kliknij Import/ActivityFeed/AuditTrail/Snapshot → brak 4xx w network (lub niewidoczne).
- AI: komenda NL „Sort by priority desc" → sortuje; ai-fill odcięcie sieci → toast (nie ciche „—"); `generate_table` → propozycja lub brak w przykładach.
- Persist: 3 wiersze → reload → trwałe; rename → reload → nazwa zachowana.
- CI: PR uruchamia 137 testów (zielone) na `Londyn`.
- Uwaga DB: dev backend uderza w PROD DB — ostrożnie.

## 6. Zależności
- Map-sync/`useIdeaMapSync` wspólny z M05/M06/M07/M09 — zmiany runtime promieniują.
- Connector CRUD pod `/api/table-platform/*` (M20) — naprawa Import dotyka mountów M20.
- ExportToPresentation → M19 Prezentacje (`/api/presentations/decks`).
- Ścieżka platformy (B) = bridge do M20 Tabele Studio — decyzja dual-stack koordynować z M20.
- CI gate `Londyn` wspólny z całą pulą (sweep FAZA 4).
