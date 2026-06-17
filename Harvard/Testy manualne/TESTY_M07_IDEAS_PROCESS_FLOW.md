# TESTY — M07 Ideas · Process Flow

> **Moduł:** M07 Ideas – Process Flow (`/my-work/ideas/workspace/process_flow`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`
> **Zakres tej paczki:** kompletny edytor przepływów procesów — tworzenie/edycja węzłów wszystkich kształtów, lanes, krawędzie z warunkami, undo/redo, AI Coach/Summary/Savings, AI Proposal (stub), eksport PNG, persistencja blob-sync, walidacja front + backend, baner degradacji, skróty klawiszowe, pełen E2E z weryfikacją payloadów Network i stanu bazy (blob).
> **Cel:** agent piszący i testujący moduł ma na tej podstawie dogłębnie przetestować każdy epik (F1–F6) z teczki `Harvard/wdrozenie-100/M07-ideas-process-flow.md` z dowodem E2E.
> **Bazuje na:** karta `Harvard/modules/M07-ideas-process-flow/KARTA_AUDYTU.md`, MODULE_02C `Harvard/podzial/ideas/MODULE_02C_process-flow.md`, teczka M07, kod `src/components/MyWork/IdeaProcessFlowTool.tsx` (2688 l.) + `src/components/MyWork/processflow/` (12 plików) + `server/src/routes/v8/processFlow.routes.ts` + `server/src/services/v8/processFlowService.ts`.
> **Legenda:** `[MANUAL]` = ręczna weryfikacja (drag&drop, rysowanie myszą); `[FLAG]` = zależne od flagi/roli/capability; `[DB]` = dowód obejmuje sprawdzenie bloba w bazie; `[KNOWN-BUG]` = znany defekt z kart audytu — weryfikuj zachowanie, odnotuj PASS/FAIL ze szczegółami.
> **Data:** 2026-06-16

---

## 0. Kontekst architektoniczny (przeczytaj przed testami)

### Mapa komponentów

| Komponent / Plik | Odpowiedzialność |
|---|---|
| `src/components/MyWork/IdeaProcessFlowTool.tsx` (2688 l.) | Główny canvas — React Flow + cały stan edytora |
| `src/components/MyWork/processflow/FlowNodeComponent.tsx` | Renderowanie węzłów (24 kształty `FlowShape`) |
| `src/components/MyWork/processflow/FlowEdgeComponent.tsx` | Krawędzie z edytowalnymi etykietami i typami warunków |
| `src/components/MyWork/processflow/LaneSystem.tsx` | Swimlanes — tła, rename, kolory, kolejność |
| `src/components/MyWork/processflow/ProcessFlowToolbar.tsx` | Toolbar górny — tryby (classic/automation/vsm), kity semantyczne, kształty |
| `src/components/MyWork/processflow/ProcessFlowFloatingToolbar.tsx` | Pływający toolbar przy zaznaczonym węźle |
| `src/components/MyWork/processflow/ProcessFlowPropertiesPanel.tsx` | Panel właściwości węzła (F2 lub przycisk) |
| `src/components/MyWork/processflow/ProcessFlowContextMenu.tsx` | Context menu (PPM na węźle / canvasie) |
| `src/components/MyWork/processflow/useProcessFlowCRUD.ts` | V8 API CRUD — createNode/createEdge/deleteNode (fire-and-forget, getHeaders) |
| `src/components/MyWork/processflow/useProcessFlowValidation.ts` | Walidacja backendowa przez `/api/v8/process-flow/:id/validate` |
| `src/components/MyWork/processflow/useProcessFlowAIProposal.ts` | AI Proposal — `POST /ai-proposals` (STUB bez LLM) |
| `src/components/MyWork/processflow/useProcessFlowReadback.ts` | Readback — `GET /:id/readback` |
| `src/components/MyWork/processflow/useProcessFlowExport.ts` | Eksport PNG (kliencki html-to-image) / JSON / readback (V8) |
| `src/components/MyWork/processflow/useProcessFlowDegraded.ts` | Health poll — `GET /:id/health` co 30 s |
| `src/components/MyWork/processflow/useProcessFlowUndoRedo.ts` | Undo/Redo (stos w pamięci) |
| `src/components/MyWork/processflow/useProcessFlowNodes.ts` | Node-level operacje (delete, duplicate, rename, lane) |
| `src/components/MyWork/canvas/useIdeaMapSync.ts` | Blob-sync główny — `GET/PUT /api/my-work/my-ideas/:id/map` z optimistic-lock |
| `server/src/routes/v8/processFlow.routes.ts` (506 l.) | 18 endpointów V8 za verifyToken+requireV8OrgContext+v8OrgGate |
| `server/src/services/v8/processFlowService.ts` (1222 l.) | SQL CRUD na tabelach `v8.v8_process_flow_nodes/edges` |
| `server/src/gateways/ideaCollabWs.gateway.ts` | WS collab — org-scope check (wspólny z M06/M09) |

### Zasada weryfikacji E2E (obowiązkowa)

Każdy save/create/delete MUSI być potwierdzony w zakładce **Network** przeglądarki:

1. **Blob (ścieżka główna):** `PUT /api/my-work/my-ideas/:id/map` — zawiera `nodes[]`, `edges[]`, `extensions.processFlow.lanes/flowMode/semanticKit` w payloadzie. Odpowiedź 200 z `version` — odnotuj numer wersji.
2. **V8 CRUD (ścieżka uzupełniająca, gdy `ENABLE_V8_GLOBAL=true`):** `POST /api/v8/process-flow/:id/nodes`, `POST /:id/edges`, `DELETE nodes/:nodeId`. **[KNOWN-BUG L-01]** DELETE zawsze NOT_FOUND (ID mismatch); V8 piszemy, ale nie czytamy — blob jest jedynym źródłem prawdy.
3. **Persistencja:** po każdej operacji odśwież stronę (`F5`) i sprawdź, że stan przetrwał przez hydratację z bloba.

### Stan beta-gating

```
MYWORK_IDEAS: 'open'   // betaAccess.ts:58 — Ideas tab dostępna (badge beta, bez blokady)
```

Dostęp do Ideas nie jest blokowany. Sprawdź badge beta w nawigacji My Work — powinien być widoczny, ale zakładka otwiera się normalnie.

### Znane defekty (z kart audytu) — weryfikuj, odnotuj

| ID | Defekt | Oczekiwane zachowanie w teście |
|---|---|---|
| L-01 | V8 mirror ID mismatch: DELETE `nodes/:id` zawsze NOT_FOUND | Blob-zapis OK, V8 DELETE zwraca 404 → canvas mimo to funkcjonuje (blob jest prawdą); FAIL jeśli UI pokazuje błąd |
| L-03 | AI Proposal STUB: `/ai-proposals` nie ma LLM | Wyślij prompt → odpowiedź bez realnych operations[] LUB endpoint niedostępny; DP-5 = ukryty za flagą |
| L-06 | Brak E2E testu kontraktu ID w CI | Testy jednostkowe przechodzą (uruchom `npx vitest run`), ale nie łapią rozjazdu ID |

### Flagi/capability

| Flaga | Gdzie | Wpływ |
|---|---|---|
| `ENABLE_V8_GLOBAL` | `.env` (true dev, false prod) | V8 CRUD aktywny; przy false `pfCrud.enabled=false` → fire-and-forget wyłączone |
| `MYWORK_IDEAS: 'open'` | `betaAccess.ts:58` | Ideas dostępne dla wszystkich |
| V8 org-gate | `v8OrgGate` middleware | Non-V8 org → 404 na endpointach `/api/v8/*` |

---

## Setup środowiska testowego

1. Uruchom dev server: `npm run dev` (`:3000` FE, `:3001` BE) lub otwórz lokalny preview.
2. Zaloguj się jako **Owner organizacji DBR77** (org z dostępem do V8 i Ideas).
3. Wejdź na **My Work → Pomysły (Ideas)**. Utwórz nowy pomysł (lub wybierz istniejący) i przełącz na zakładkę **Process Flow**.
4. Otwórz DevTools:
   - **Network** — filtr: `my-ideas` + `process-flow` + `v8` (łap wszystkie save/CRUD/validate)
   - **Console** — zero błędów JS i 0 warning czerwonych to wymóg (odnotuj każde odchylenie)
5. **Dane testowe do przygotowania przed testami:**
   - Pomysł A: świeży, pusty (brak węzłów, default lane „Main Process")
   - Pomysł B: z 3-5 węzłami i co najmniej 2 krawędziami (gotowy do testów edycji/usunięcia)
   - Pomysł C: wersja na staging z wieloma węzłami do testów eksportu PNG
6. Drugi użytkownik (dla §9 collab/conflict): konto w tej samej organizacji z rolą `member`.

---

## 1. Gating i wejście do modułu

### 1.1 Beta badge i dostępność zakładki

- Wejdź na `/my-work`. W nawigacji tabs sprawdź: zakładka **Pomysły** ma badge `beta` (widoczny, ale nie blokuje dostępu).
- Klik w zakładkę → otwiera się widok listy Ideas (`/my-work/ideas`).
- **Asercja:** żaden komunikat „access restricted" nie pojawia się; `betaAccess.ts` `MYWORK_IDEAS='open'`.

### 1.2 Navigacja do workspace Process Flow

- Na liście Ideas klik w istniejący pomysł (lub „Nowy pomysł") → otwiera się workspace.
- Klik w tab **Process Flow** (`activeTool='process_flow'`) w toolbarze workspace.
- **Asercja:** URL aktualizuje się do `/my-work/ideas/workspace/process_flow` (lub parametr `tool=process_flow`). Canvas ReactFlow jest widoczny, nie ma spinner-loopa ani error.
- DevTools Console: zero błędów.

### 1.3 Gating roli — użytkownik z innej org

- [FLAG] Zaloguj się jako użytkownik z **innej organizacji** (nie DBR77).
- Wejdź bezpośrednio na URL `/api/v8/process-flow/<random-id>/objects`.
- **Asercja:** odpowiedź 403 lub 404 (v8OrgGate blokuje); NIGDY 200 z danymi innej org.

---

## 2. Stan pusty i hydratacja (EPIK 6 — blob-sync)

### 2.1 Pusty pomysł — stan domyślny

- Otwórz Pomysł A (pusty).
- **Asercja:**
  - Canvas ReactFlow widoczny z jednym swimlane „Main Process" (kolor `#e0e7ff`).
  - Brak węzłów, brak krawędzi.
  - Toolbar górny widoczny z trybem `Classic Flow` zaznaczonym.
  - Przycisk Save aktywny (nie disabled).
  - Ikona cloud/sync nie pokazuje „niezapisane" (stan czysty).

### 2.2 Hydratacja z bloba [DB]

- Wejdź na Pomysł B (z węzłami).
- **Asercja hydratacji:**
  - Network: `GET /api/my-work/my-ideas/:id/map` → 200, odpowiedź zawiera `nodes[]` i `edges[]` w `extensions_json`.
  - Canvas wyświetla wszystkie węzły i krawędzie z bloba.
  - `flowMode`, `semanticKit`, `lanes` odczytane z `extensions.processFlow`.
- Odśwież stronę (F5) → te same węzły nadal widoczne. `[DB]`

### 2.3 Autosave draft

- Dodaj węzeł (§3). NIE klikaj Save.
- Odczekaj 3 sekundy (autosave debounce).
- **Asercja:** Network: `PUT /api/my-work/my-ideas/:id/map` wysłane automatycznie; payload zawiera nowy węzeł.

---

## 3. Tworzenie węzłów (EPIK 3 — typy węzłów)

### 3.1 Każdy kształt (Classic mode) — po kolei

Dla każdego kształtu z listy `CLASSIC_SHAPES = ['start', 'end', 'action', 'decision']`:

1. Klik w przycisk kształtu na toolbarze.
2. **Asercja wizualna:**
   - Nowy węzeł pojawia się na canvasie w pierwszym lane.
   - Ikona zgodna z `SHAPE_CONFIG` (start=CircleDot, end=StopCircle, action=Square, decision=Diamond).
   - Etykieta: PL lub EN w zależności od języka UI (`SHAPE_CONFIG[shape].labelPl` / `.label`).
3. **Asercja Network (blob):** `PUT /api/my-work/my-ideas/:id/map` — nowy węzeł w `nodes[]` z prawidłowym `id` (`pf-<timestamp>-<random>`), `type: 'flowNode'`, `data.shape` = kształt.
4. **[FLAG] Asercja Network (V8, gdy `ENABLE_V8_GLOBAL=true`):** `POST /api/v8/process-flow/:id/nodes` z body `{ object_type: <mapped>, label: <string>, position_x, position_y, lane_id }`. `shapeToObjectType('decision')` = `'decision_gateway'`, `shapeToObjectType('action')` = `'task'`.
5. Odśwież → węzeł nadal widoczny. `[DB]`

### 3.2 Tryb Automation — kształty auto_*

- Przełącz tryb na **Automation** w toolbarze.
- **Asercja:** paleta kształtów zmienia się na `AUTOMATION_SHAPES = ['start', 'end', 'action', 'auto_trigger', 'auto_api', 'auto_condition']`.
- Dodaj `auto_trigger` (Zap icon, „Wyzwalacz" / „Trigger").
- Dodaj `auto_api` (GitMerge icon, „Wywołanie API" / „API Call").
- Dodaj `auto_condition` (Diamond icon, „Warunek" / „Condition").
- **Asercja:** wszystkie trzy węzły pojawiają się z właściwymi ikonami i etykietami.
- Blob: `PUT /api/my-work/my-ideas/:id/map` zawiera wszystkie trzy.

### 3.3 Tryb VSM — kształty vsm_*

- Przełącz na **Value Stream** (vsm).
- **Asercja:** paleta = `VSM_SHAPES` (9 kształtów: vsm_process, vsm_inventory, vsm_supplier, vsm_customer, vsm_kaizen, vsm_push_arrow, vsm_pull_arrow, vsm_supermarket, vsm_fifo).
- Dodaj `vsm_process`, `vsm_inventory`, `vsm_supplier`.
- **Asercja wizualna VSM:** węzły vsm_* używają bogatszych komponentów (`vsmNodeTypes` — inne renderowanie niż FlowNodeComponent).
- **Asercja:** po dodaniu węzłów vsm_* pojawia się **VSM Timeline Bar** na dole canvasu (komponent `VSMTimelineBar`, warunkowy render: `nodes.some(n => n.data?.shape?.startsWith('vsm_'))`).
- KPI Dashboard: klik w przycisk KPI → `ProcessKPIDashboard` pokazuje się w prawym górnym rogu z metrykami zbiorczymi.

### 3.4 Kity semantyczne BPMN / System / Org

- W toolbarze wybierz kit **BPMN**: paleta = `['bpmn_event', 'bpmn_task', 'bpmn_gateway', 'start', 'end']`.
- Dodaj `bpmn_gateway`.
- Przełącz na kit **System**: `['system_actor', 'system_service', 'system_db', 'decision']`.
- Dodaj `system_db`.
- Przełącz na kit **Org**: `['org_role', 'org_team', 'org_handoff', 'decision']`.
- Dodaj `org_handoff`.
- **Asercja:** węzły zachowują właściwy `data.semanticKit` w blobie; przy hydratacji semanticKit odczytany z `extensions.processFlow.semanticKit`.

### 3.5 Skrót Enter / Shift+Enter

- Zdefokusuj pola tekstowe. Naciśnij **Enter** (bez Shift).
- **Asercja:** nowy węzeł dodany (kształt = default dla trybu: classic→'action', automation→'auto_trigger', vsm→'vsm_process').
- Naciśnij **Shift+Enter**.
- **Asercja:** nowy węzeł typu `decision` (classic/automation) lub `vsm_inventory` (vsm).

### 3.6 Ghost nodes (AI next-step, po dodaniu węzła)

- Dodaj węzeł inny niż `end` (np. `action`).
- **Asercja:** po dodaniu węzła, po chwili mogą się pojawić „ghost nodes" (cieniowane sugestie AI następnego kroku, generowane przez `generateAIProposal` z `generatorType: 'next_step'`).
- Jeśli ghost node widoczny: klik w niego → `acceptGhostNode` → węzeł staje się normalny.
- Jeśli ghost nodes się nie pojawiają: odnotuj (AI może nie odpowiadać w czasie testu) — nie jest to FAIL, o ile Canvas nie crashuje.

---

## 4. Edycja węzłów (EPIK 3 — właściwości)

### 4.1 Rename węzła — inline (F2 / double-click)

- Dwukrotnie kliknij węzeł LUB zaznacz i naciśnij **F2** (otwiera `ProcessFlowPropertiesPanel`).
- Wpisz nową etykietę.
- Potwierdź (Enter lub klik poza).
- **Asercja:** etykieta węzła zaktualizowana w UI.
- **Asercja blob:** `PUT /api/my-work/my-ideas/:id/map` — węzeł z nowym `data.label`.
- **[FLAG] Asercja V8:** `PUT /api/v8/process-flow/nodes/:nodeId/label` — **[KNOWN-BUG]** ta ścieżka jest martwa (nie ma call-site w kodzie) → brak V8 call dla rename jest **oczekiwany**; weryfikuj tylko blob.

### 4.2 Metryki kroku (ProcessFlowPropertiesPanel)

- Zaznacz węzeł `action`. Otwórz Properties Panel (F2 lub pływający toolbar → ikona).
- Wpisz: **Czas** = `30`, jednostka = `min`; **Koszt** = `500`; **FTE** = `2`; **Automation** = `40%`; **Savings** = `200`.
- Zamknij panel.
- **Asercja:** metryki zapisane w `data` węzła (widoczne w properties panelu po ponownym otwarciu).
- **Asercja blob:** `PUT /api/my-work/my-ideas/:id/map` — węzeł zawiera `data.duration`, `data.cost`, `data.fteCount`, `data.automationPct`, `data.savings`.
- **Asercja KPI Dashboard:** otwórz KPI Dashboard → wartości zbiorcze są przeliczone (totalCost, totalFTE, etc.).
- Odśwież → metryki przetrwały. `[DB]`

### 4.3 Pływający toolbar (zaznaczony węzeł)

- Zaznacz węzeł. **Asercja:** `ProcessFlowFloatingToolbar` pojawia się nad węzłem z przyciskami: Rename, Duplicate, Delete, Insert Between, Open Chat (jeśli `onOpenChat` dostępny).
- Klik **Rename** → otwiera PropertiesPanel.
- Klik **Duplicate** → duplikat węzła pojawia się obok.
- Klik **Delete** → węzeł usunięty z canvasu.
- **Asercja:** po każdej akcji `PUT /api/my-work/my-ideas/:id/map` wysłane.

### 4.4 Context menu (PPM na węźle)

- PPM na węźle → `ProcessFlowContextMenu` z opcjami per `getNodeContextActions` (np. Rename, Delete, Duplicate, Set as Start, Set as End, Insert Between, Split Path, Add to Lane).
- PPM na pustym canvasie → `getCanvasContextActions` (np. Paste, Add Node, Auto Layout).
- **Asercja:** każda opcja context menu wykonuje właściwą akcję.

### 4.5 Tryb zablokowany (locked=true)

- [FLAG] Jeśli idea jest tylko do odczytu (lock): otwórz jako `member` bez uprawnień edycji.
- **Asercja:** żaden węzeł nie jest edytowalny, toolbar nie wyświetla przycisków edycji, `locked=true` propaguje się do `FlowNodeComponent.data.locked`.
- **Asercja:** `PUT /api/my-work/my-ideas/:id/map` NIE jest wysyłane (handler `if (locked) return` w każdym addNode/connect/delete).

---

## 5. Usuwanie węzłów (EPIK 3 — delete)

### 5.1 Usunięcie węzła przez Delete / Backspace

- Zaznacz węzeł. Naciśnij **Delete** lub **Backspace**.
- **Asercja:** węzeł usunięty z canvasu; krawędzie do/z węzła znikają.
- **Asercja blob:** `PUT /api/my-work/my-ideas/:id/map` — węzeł nie ma go w `nodes[]`.
- **[KNOWN-BUG L-01] Asercja V8:** `DELETE /api/v8/process-flow/nodes/:nodeId` zwraca 404 NOT_FOUND (ID klienta `pf-...` ≠ UUID serwera). Odnotuj status 404, ale Canvas NIE powinien pokazywać błędu użytkownikowi (fire-and-forget).

### 5.2 Usunięcie zaznaczenia wielokrotnego

- Zaznacz 3 węzły (Ctrl/Cmd+klik).
- Naciśnij Delete.
- **Asercja:** wszystkie 3 węzły i ich krawędzie usunięte; jeden `PUT /api/my-work/my-ideas/:id/map`.

### 5.3 Edge-case: próba usunięcia węzła start/end, gdy jest jedynym

- Gdy istnieje tylko 1 węzeł `start`, usuń go.
- **Asercja:** Węzeł usunięty (brak blokady po stronie FE); lokalna walidacja (`validateFlow`) powinna zgłosić ostrzeżenie „Brak start" po następnym uruchomieniu walidacji — nie blokuje kasowania.

---

## 6. Łączenie węzłów — krawędzie [MANUAL]

### 6.1 Drag-to-connect (rysowanie myszą) [MANUAL]

> **Kontekst architektoniczny:** `getIdeasToolInteractionProps('processflow', { locked, connectMode: !locked })` przekazuje `nodesConnectable: true` gdy `locked=false` (`IdeaProcessFlowTool.tsx:2289`). Rysowanie jest AKTYWNE.

- Najedź na węzeł `start` — Handle (ReactFlow) powinien być widoczny na krawędzi węzła.
- Kliknij Handle i przeciągnij do węzła `action` → upuść.
- **Asercja:** krawędź `flowEdge` pojawia się między węzłami z animacją.
- **Asercja blob:** `PUT /api/my-work/my-ideas/:id/map` — nowa krawędź w `edges[]` z `source`, `target`, `type: 'flowEdge'`.
- **[FLAG] Asercja V8:** `POST /api/v8/process-flow/:id/edges` z body `{ source_node_id, target_node_id, edge_type: 'sequence_flow' }`. **[KNOWN-BUG L-01]** klienckie ID bez FK → 200 ale wiszące referencje; odnotuj status.
- **Jeśli drag-to-connect nie działa:** zgłoś P0-A i odnotuj dokładne zachowanie (handle widoczny / nie widoczny, czy `onConnect` jest wywoływane w DevTools).

### 6.2 Insert Between

- Zaznacz krawędź (klik w nią).
- W pływającym toolbarze lub context menu wybierz **Insert Between**.
- **Asercja:** nowy węzeł `action` pojawia się na krawędzi, oryginalna krawędź podzielona na 2.
- **Asercja blob:** 3 nowe wpisy — 1 węzeł + 2 krawędzie; stara krawędź usunięta.

### 6.3 Split Path

- Zaznacz węzeł `decision`.
- Context menu → **Split Path**.
- **Asercja:** 2 nowe węzły i krawędzie wychodzące z decision; krawędzie mają etykiety Yes/No.

### 6.4 Etykieta krawędzi — inline edit

- Dwukrotnie kliknij krawędź → pojawia się edytowalne pole etykiety.
- Wpisz „Tak / Yes".
- Klik poza.
- **Asercja:** etykieta widoczna na krawędzi.
- **Asercja blob:** `PUT /api/my-work/my-ideas/:id/map` — krawędź zawiera `label: 'Tak / Yes'`.
- **[FLAG] V8:** `PUT /api/v8/process-flow/edges/:edgeId/label` — **[KNOWN-BUG L-01]** martwa ścieżka w kodzie; spodziewaj się braku call lub 404.

### 6.5 Typ warunki krawędzi (condition type)

- Wybierz krawędź wychodzącą z węzła `decision`.
- W Properties Panel lub FloatingToolbar zmień typ na `yes` / `no` / `default`.
- **Asercja:** krawędź zmienia styl wizualny (kolor/styl linii) odpowiadający typowi warunku.
- **Asercja blob:** `data.conditionType` krawędzi zapisany.

### 6.6 Reconnect / przekierowanie krawędzi [MANUAL]

- Przeciągnij endpoint istniejącej krawędzi na inny węzeł (`edgesReconnectable={!locked}` — `IdeaProcessFlowTool.tsx:2269`).
- **Asercja:** krawędź przeniesiona; blob zaktualizowany.

### 6.7 Usunięcie krawędzi

- Zaznacz krawędź → Delete.
- **Asercja:** krawędź usunięta z canvasu; `PUT /api/my-work/my-ideas/:id/map` bez tej krawędzi.

---

## 7. Drag & Drop — reorganizacja [MANUAL]

### 7.1 Przenoszenie węzła w obrębie lane [MANUAL]

- Chwyt i przeciągnij węzeł `action` w poziomie wewnątrz lane 1.
- Puść w nowej pozycji.
- **Asercja:** węzeł w nowym miejscu; `onNodesChange` z `type: 'position'`.
- **Asercja blob:** `PUT /api/my-work/my-ideas/:id/map` — `position.x`, `position.y` zaktualizowane.
- **[FLAG] V8:** `PUT /api/v8/process-flow/nodes/:nodeId/move` — **[KNOWN-BUG L-01]** call-site nieobecny w kodzie (brak `moveNode` w `onNodesChange`); brak V8 call jest oczekiwany.

### 7.2 Przenoszenie węzła między lanes [MANUAL]

> Implementacja: przy drop, Y-pozycja węzła określa lane (`drag-między-lane po Y`, `:820-860`).

- Utwórz dwa lanes (§8.1).
- Przeciągnij węzeł z lane 1 do lane 2 (w dół, poza poziom `LANE_HEIGHT = 140 px`).
- **Asercja:** `data.laneId` węzła zmienione na id drugiego lane; kolor tła węzła zmieniony (odpowiada `laneColor` nowego lane).
- **Asercja blob:** `data.laneId` zaktualizowany.
- `[FLAG] V8:` `PUT /api/v8/process-flow/nodes/:nodeId/lane` — **[KNOWN-BUG L-01]** brak call-site.

### 7.3 Undo po drag [MANUAL]

- Po drag węzła naciśnij **Cmd+Z** (undo).
- **Asercja:** węzeł wraca na poprzednią pozycję. (`pushUndo` jest wołane w `onNodeDragStart` jako drag-snapshot `IdeaProcessFlowTool.tsx:808-813`).

---

## 8. Swimlanes (EPIK 4 — lanes)

### 8.1 Dodanie lane

- Klik **+ Add Lane** (w toolbarze lub context menu pane).
- **Asercja:** nowy lane pojawia się pod istniejącymi (label „New Lane" lub `Lane 2`).
- **Asercja blob:** `PUT /api/my-work/my-ideas/:id/map` — `extensions.processFlow.lanes[]` zawiera nowy lane z unikalnym `id`.

### 8.2 Rename lane

- Dwukrotnie kliknij nagłówek lane → edytowalne pole.
- Wpisz „Dział sprzedaży".
- Enter.
- **Asercja:** nazwa zaktualizowana; blob zaktualizowany.

### 8.3 Kolor lane

- Na nagłówku lane klik ikona palety (Palette icon).
- Wybierz kolor z `LANE_COLORS` (10 presetów).
- **Asercja:** tło lane zmienione; blob zawiera `color: <hex>`.

### 8.4 Zmiana kolejności lanes [MANUAL]

- Przy lane z min. 3 lanes: klik strzałki Góra/Dół (ArrowDownUp) na headerze.
- **Asercja:** kolejność lanes zaktualizowana; węzły przypisane do lane zachowują `laneId` (nie są przetasowane do innych lanes).
- **Asercja blob:** kolejność tablic `lanes[]` zmieniona.

### 8.5 Usunięcie lane

- Klik ikona X na nagłówku lane (gdy `laneCount > 1`).
- **Asercja:** lane usunięty; węzły z usuniętego lane przeniesione do lane 1 (lub widoczne jako "orphaned" — zweryfikuj zachowanie kodu).
- **Asercja blob:** lane nie ma go w `lanes[]`.

### 8.6 Motyw kolorów (theme presets)

- W toolbarze lub workspace tools wybierz temat: `ops`, `workshop`, `strategy` (`FLOW_THEME_PRESETS`).
- **Asercja:** wszystkie lanes otrzymują kolory z wybranego presetu; zmiana pojawia się w `extensions.processFlow.themeId`.

---

## 9. Undo/Redo (EPIK 3 — historia)

### 9.1 Podstawowy undo/redo

- Dodaj węzeł. Naciśnij **Cmd+Z**.
- **Asercja:** węzeł znika; `canUndo=false` (jeśli to jedyna operacja) lub przycisk Undo w toolbarze dezaktywowany.
- Naciśnij **Cmd+Shift+Z**.
- **Asercja:** węzeł wraca.
- Blob wysyłany przy każdym undo/redo.

### 9.2 Undo łańcucha operacji

- Dodaj 3 węzły kolejno. Naciśnij Cmd+Z trzy razy.
- **Asercja:** wszystkie 3 węzły znikają w odwrotnej kolejności.

### 9.3 Undo po drag [MANUAL]

- Przeciągnij węzeł. Cmd+Z.
- **Asercja:** pozycja wraca do stanu przed drag (`dragSnapshotTakenRef` + `pushUndo` przy `onNodeDragStart`).

### 9.4 Redo nie działa po nowej akcji

- Undo operacji, potem dodaj nowy węzeł, potem Cmd+Shift+Z.
- **Asercja:** redo nie przywraca usuniętego węzła (historia redo wyczyszczona po nowej operacji).

---

## 10. Auto-layout (EPIK 3 — dagre)

### 10.1 Auto-layout (Cmd+L)

- Utwórz 5 węzłów w przypadkowych miejscach z krawędziami.
- Naciśnij **Cmd+L** lub klik Auto Layout w toolbarze.
- **Asercja:** węzły ułożone automatycznie przez dagre — poziomy przepływ lewo→prawo (lub górny-dół), bez nakładania się.
- **Asercja:** toast „Auto-layout applied" / „Układ automatyczny zastosowany".
- **Asercja blob:** `PUT /api/my-work/my-ideas/:id/map` z nowymi pozycjami węzłów.

### 10.2 Auto-layout z lanes

- Utwórz 2 lanes z węzłami.
- Auto-layout.
- **Asercja:** węzły pozostają w swoich lanes (nie przekraczają `LANE_HEIGHT` granic).

### 10.3 Auto-layout cofnięty przez Undo

- Auto-layout. Cmd+Z.
- **Asercja:** węzły wracają na pozycje sprzed auto-layout.

---

## 11. Walidacja frontendowa (EPIK 3 — validateFlow)

### 11.1 Brak węzła Start

- Utwórz przepływ wyłącznie z `action` i `end` (brak `start`) w trybie Classic.
- Klik **Validate** (lub ikona AlertTriangle w toolbarze).
- **Asercja:** lista ostrzeżeń zawiera „Brak węzła startowego" / „No start node found".
- Ostrzeżenie ma `id` węzła (lub brak — dotyczy całego grafu).

### 11.2 Brak węzła End

- Utwórz `start` + `action` bez `end`.
- Validate.
- **Asercja:** ostrzeżenie „Brak węzła końcowego" / „No end node found".

### 11.3 Węzeł bez krawędzi (dangling)

- Dodaj węzeł `action` bez żadnych połączeń.
- Validate.
- **Asercja:** ostrzeżenie „Węzeł niepodłączony" / „Node has no connections" z ID węzła.

### 11.4 Decision bez 2 wyjść

- Dodaj `decision` z tylko 1 krawędzią wychodzącą.
- Validate.
- **Asercja:** ostrzeżenie „Węzeł decyzji powinien mieć co najmniej 2 wyjścia" / „Decision node should have ≥2 exits".

### 11.5 Walidacja OK — przepływ poprawny

- Utwórz prosty przepływ: start→action→decision→(yes)end + (no)action2→end.
- Validate.
- **Asercja:** „Przepływ poprawny" / „Flow is valid". Badge checkmark w toolbarze.

### 11.6 Skrót Cmd+Shift+V — uruchamia walidację backendową

- Naciśnij **Cmd+Shift+V**.
- **Asercja Network:** `POST /api/v8/process-flow/:id/validate` wysłane z `getHeaders()`.
- **Asercja odpowiedzi:** 200 z `{data: {valid: bool, issues: []}}` lub 404 (V8 org gate).
- **ValidationResultsPanel** pojawia się z wynikami (lub błędem).

---

## 12. Walidacja backendowa (EPIK 6 — backend validate)

### 12.1 Manual backend validation

- Klik **Validate** (backend) → `runBackendValidation()` → `POST /api/v8/process-flow/:id/validate`.
- **Asercja Network:**
  - Request headers zawierają `Authorization: Bearer <token>` (`getHeaders()` — naprawione, brak P0-C).
  - Status 200.
  - Response body: `{ data: { valid: bool, issues: [{layer, severity, object_id, rule, message}] } }`.
- **Asercja UI:** `ValidationResultsPanel` pokazuje issues z severity `error/warning`.

### 12.2 Backend validation — issue per węzeł (issuesForObject)

- Utwórz przepływ z błędem (np. cykl lub brak start).
- Uruchom backend validation.
- **Asercja:** węzły z powiązanymi issues (`issuesForObject(nodeId)`) mają wizualne oznaczenie (czerwona ramka / ikona ostrzeżenia na węźle).

### 12.3 Auto-validate wyłączone (autoValidate=false)

- **Weryfikacja kodu:** `useProcessFlowValidation` w `IdeaProcessFlowTool.tsx` jest mountowane z `autoValidate: false` (`:556`).
- **Asercja:** po każdej edycji węzła/krawędzi NIE jest wysyłany automatyczny `POST /validate`. Walidacja backendowa tylko na żądanie (Cmd+Shift+V lub przycisk).

---

## 13. AI Coach / Summary / Savings (EPIK 3 — realne AI)

### 13.1 AI Coach

- Klik przycisk **AI Coach** (Teresa icon) w toolbarze lub bocznym panelu.
- **Asercja Network:** `POST /api/my-ideas/:id/generate-ai` z `{ generatorType: 'process_coach', ... }` (przez `Api.generateIdeaAI` → `ideaAIGeneratorService.ts` → realny LLM `llmService.callStructured`).
- **Asercja:** po odpowiedzi pojawia się `ProcessCoachPanel` z `coachInsights[]` — lista insightów (type: bottleneck/redundancy/improvement + message + suggestion + confidence).
- Status 200. Zero błędów Console.
- **Asercja danych:** odpowiedź zawiera niepuste `insights` (nie pusta tablica ani mock).

### 13.2 AI Summary (processBrief)

- Klik **Summarize** / **AI Summary**.
- **Asercja Network:** request z `generatorType: 'process_summary'`.
- **Asercja:** `processBriefData` zapisywane w `extensions.processFlow.processBrief` → widoczne w UI (panel z objectives, nextMoves, reviewCheckpoints).
- **Asercja blob:** `PUT /api/my-work/my-ideas/:id/map` zawiera `extensions.processFlow.processBrief`.

### 13.3 AI Savings Analysis

- Klik **Run Savings Analysis** (ikona Rocket lub podobna).
- **Asercja Network:** request z `generatorType: 'process_savings'`.
- **Asercja:** panel `SavingsPanel` z `totalSavingsEstimate`, `notes[]`.
- **Asercja blob:** `extensions.processFlow.savingsAnalysis` zapisane.

### 13.4 AI Coach z kontekstem selekcji

- Zaznacz 2 węzły (Cmd+klik). Klik AI Coach.
- **Asercja:** w payloadzie `seedText` zawiera nazwy zaznaczonych węzłów (sprawdź request body w Network).

---

## 14. AI Proposal Panel — STUB [FLAG][KNOWN-BUG L-03]

> **Kontekst:** Panel `AIProposalPanel` jest widoczny w UI tylko gdy decyzja DP-5 nie ukryła go za flagą. Endpoint `/api/v8/process-flow/:id/ai-proposals` to in-memory stub bez LLM (`.routes.ts:411-437` ignoruje `{prompt}`).

### 14.1 Wywołanie AI Proposal

- Kliknij przycisk **AI Proposal** (jeśli widoczny w UI).
- Wpisz prompt (np. „Optymalizuj ten proces").
- Klik Generuj.
- **Asercja Network:** `POST /api/v8/process-flow/:id/ai-proposals` z body `{ prompt: "..." }`.
- **Asercja odpowiedzi (oczekiwana):**
  - [JEŚLI STUB AKTYWNY] Response: brak realnych `operations[]` lub `summary`; pusta/mockowa propozycja — odnotuj KNOWN-BUG L-03.
  - [JEŚLI DP-5 ZASTOSOWANE] Przycisk AI Proposal ukryty lub label „Wkrótce" — odnotuj jako PASS z DP-5.
- **Asercja:** Canvas NIE crashuje w żadnym przypadku.

### 14.2 Resolve Proposal (jeśli proposal istnieje)

- Jeśli `activeProposal` powstał (nawet mockowy): klik **Accept** lub **Reject**.
- **Asercja Network:** `POST /api/v8/process-flow/ai-proposals/:id/resolve` z body `{ action: 'accept'|'reject' }`.
- **Asercja:** `activeProposal` znika z UI.

---

## 15. Eksport

### 15.1 Eksport PNG — kliencki (html-to-image)

- Naciśnij **Cmd+E** lub klik Eksport w toolbarze → ExportDialog.
- Wybierz format **PNG**.
- **Asercja:** plik `process-flow-<ideaId>.png` pobierany do przeglądarki (`link.click()`).
- **Asercja Network:** BRAK wywołania do serwera (eksport PNG jest w pełni kliencki przez `html-to-image.toPng`).
- **Asercja wizualna:** plik PNG zawiera aktualny stan canvasu (wszystkie węzły i krawędzie widoczne, białe tło `backgroundColor: '#ffffff'`).
- **Edge-case:** pusty canvas (brak węzłów) → eksport PNG mimo to pobierany (nawet jeśli biały obraz).

### 15.2 Eksport JSON (V8) [FLAG]

- W ExportDialog wybierz **JSON**.
- **Asercja Network:** `GET /api/v8/process-flow/:id/export/json` z `getHeaders()`.
- **Asercja:** plik `process-flow-<ideaId>.json` pobierany.
- **Asercja zawartości:** JSON zawiera strukturę grafu (nodes, edges).
- **[FLAG] Jeśli V8 org-gate blokuje (non-V8 org):** 404 → brak pobrania; odnotuj.

### 15.3 Eksport Readback (V8)

- W ExportDialog wybierz **Readback** (readback format).
- **Asercja Network:** `GET /api/v8/process-flow/:id/export/readback`.
- **Asercja:** plik tekstowy z czytelnym opisem ścieżek procesu (`ReadbackResult.paths[]`).

### 15.4 Readback Panel

- Klik przycisk **Readback** w toolbarze (nie eksport, tylko podgląd).
- **Asercja Network:** `GET /api/v8/process-flow/:id/readback` z `getHeaders()`.
- **Asercja UI:** `ReadbackPanel` wyświetla listę ścieżek z krokami (`ReadbackStep: type, label, object_id`).

---

## 16. Minimap i widok

### 16.1 Toggle minimapy

- Klik przycisk toggle miniatury (w `CanvasZoomControls`).
- **Asercja:** `MiniMap` pojawia się / znika w prawym dolnym rogu canvasu.
- MiniMap ma `zoomable=true, pannable=true` — interakcja z minimapą przewija/przybliża canvas.

### 16.2 Fit View (Cmd+0 / Shift+1)

- Utwórz węzły rozrzucone po canvasie.
- Naciśnij **Cmd+0**.
- **Asercja:** `reactFlowInstanceRef.current.fitView({ padding: 0.15, duration: 300 })` — canvas dopasowuje widok do zawartości.
- Naciśnij **Shift+1** (alternatywny skrót).
- **Asercja:** to samo zachowanie.

### 16.3 Fullscreen

- Klik Fullscreen w `CanvasZoomControls`.
- **Asercja:** canvas przechodzi w tryb pełnoekranowy (Fullscreen API lub wewnętrzny CSS fullscreen).
- Wyjście z fullscreen (Escape lub klik).
- **Asercja:** canvas wraca do normalnego widoku.

### 16.4 Pan / Zoom gestures [MANUAL]

- Przewijaj myszką (scroll) na canvasie → zoom in/out.
- PPM + drag → pan (Space+drag lub środkowy przycisk).
- **Asercja:** viewport zmienia się płynnie; żaden węzeł nie znika.

---

## 17. Skróty klawiaturowe — pełna lista

Dla każdego skrótu: naciśnij, potwierdź akcję, odnotuj PASS/FAIL.

| Skrót | Oczekiwana akcja |
|---|---|
| Cmd+S | Manualny save → `handleSave()` → `PUT /api/my-work/my-ideas/:id/map` |
| Cmd+Z | Undo ostatniej operacji |
| Cmd+Shift+Z | Redo |
| Cmd+D | Duplikuj zaznaczone węzły |
| Cmd+E | Otwiera ExportDialog |
| Cmd+Shift+V | Uruchamia backend validation + otwiera ValidationResultsPanel |
| Cmd+L | Auto-layout (dagre) |
| Cmd+0 | Fit View |
| Shift+1 | Fit View (alternatywny) |
| F2 | Otwiera PropertiesPanel dla zaznaczonego węzła |
| Escape | Czyści zaznaczenie (deselect all) |
| Enter | Dodaj węzeł (default shape dla trybu) |
| Shift+Enter | Dodaj węzeł (alt shape: decision/vsm_inventory) |

> **Uwaga:** skróty działają tylko gdy żadne pole tekstowe (INPUT/TEXTAREA/contentEditable) nie jest fokusowane. Sprawdź, że skróty NIE działają gdy kursor jest w polu etykiety węzła.

---

## 18. Baner degradacji (EPIK 1 — useProcessFlowDegraded)

### 18.1 Health poll — normalny stan

- Otwórz Process Flow. Odczekaj 5 sekund.
- **Asercja Network:** `GET /api/v8/process-flow/:id/health` wysłane automatycznie z `getHeaders()` (poll co 30 s).
- **Asercja:** response 200 z `{ data: { degraded: false, scenario: null } }` → `isDegraded=false` → baner NOT widoczny.

### 18.2 Baner degradacji — mockowanie degradacji

- [FLAG] Jeśli tabele V8 nie istnieją na staging: health endpoint zwróci `degraded: true` ze scenario `TABLE_MISSING`.
- **Asercja:** baner „Tryb ograniczony — graf zapisywany lokalnie" / „Degraded mode — saving to local blob" pojawia się w górnej części edytora.
- **Asercja:** Canvas NADAL DZIAŁA normalnie (blob-sync jest ścieżką główną, niezależną od V8).

### 18.3 Health poll — błąd sieci

- [MANUAL] Odłącz sieć (DevTools → Network → Offline). Poczekaj 30 s na kolejny poll.
- **Asercja:** `useProcessFlowDegraded` ustawia `isDegraded=true` ze scenario `network_error` (catch blok hook`a).
- Ponownie włącz sieć → baner znika po kolejnym poll.

---

## 19. Persistencja — pełny cykl [DB]

### 19.1 Reload zachowuje wszystko

- Utwórz: 5 węzłów różnych kształtów, 3 krawędzie z etykietami, 2 lanes z nazwami, flowMode=automation, semanticKit=bpmn.
- Cmd+S → confirm blob save (200 response).
- Odśwież stronę (F5).
- **Asercja (DB):**
  - Canvas pokazuje te same 5 węzłów (shapes, labels, positions).
  - Te same 3 krawędzie (z etykietami).
  - Te same 2 lanes (nazwy, kolory, kolejność).
  - `flowMode=automation`, `semanticKit=bpmn` odczytane.
  - Network: `GET /api/my-work/my-ideas/:id/map` → 200, `extensions_json` zawiera kompletny stan.

### 19.2 Optimistic lock — conflict 409

- Otwórz tę samą ideę w dwóch zakładkach.
- W zakładce A: dodaj węzeł, Cmd+S.
- W zakładce B: bez reloadu dodaj inny węzeł, Cmd+S.
- **Asercja:** zakładka B dostaje 409 Conflict (wersja nie zgadza się). `useIdeaMapSync` obsługuje toast „Konflikt wersji — odświeżam".
- **[KNOWN-BUG IDEAS]** Toast pojawia się ale bez automatycznego refresh (silent overwrite ryzyko) — odnotuj zachowanie.

### 19.3 Autosave offline-queue

- Odłącz sieć (DevTools Offline). Dodaj 3 węzły.
- Ponownie włącz sieć.
- **Asercja:** `useIdeaMapSync` ma offline-queue; po przywróceniu sieci zapisuje skumulowane zmiany.

---

## 20. Collaboration Overlay (EPIK 2 — WS org-scope) [FLAG]

### 20.1 Presence overlay

- Otwórz tę samą ideę jednocześnie z dwóch kont (Owner + Member, ta sama org).
- **Asercja:** `CollaborationOverlay` w narzędziu pokazuje cursory / avatary obu użytkowników.
- **Asercja Network:** WebSocket połączenie do `wss://.../ws/collab/:ideaId` nawiązane przez obu.

### 20.2 Cross-org WS — 403 [FLAG][KNOWN-BUG naprawiony L-02]

- [FLAG] Użytkownik z INNEJ organizacji próbuje nawiązać WS do `/ws/collab/<ideaId>` z tokena swojej org.
- **Asercja:** WebSocket odmówiony (403 + `socket.destroy()` w `ideaCollabWs.gateway.ts:237-242`).
- Odnotuj jako PASS (L-02 naprawione według kodu).

### 20.3 Selekcja widoczna dla innych

- Użytkownik A zaznacza węzeł.
- **Asercja:** Użytkownik B widzi podświetlony węzeł (presence selection przez WS).

---

## 21. Ścieżki cross-module

### 21.1 Process Flow → Czat (M01)

- Klik przycisk **Open Chat** z kontekstem (w FloatingToolbar lub toolbarze).
- **Asercja:** wywołanie `onOpenChat(contextString)` → panel czatu Teresy (M01) otwiera się z prefilowanym kontekstem zawierającym opis węzłów i ostrzeżeń walidacji.
- **Asercja Network:** request do `/api/.../chat` zawiera context Process Flow w prompcie systemowym.

### 21.2 Process Flow → Inicjatywy (M13) — develop endpoint [FLAG]

- Na liście Ideas klik **Rozwiń ideę** / **Develop Idea** (przycisk na karcie idei).
- **Asercja Network:** `POST /api/my-work/my-ideas/:id/develop` (`my-work.routes.ts:6701`).
- **[FLAG] Asercja readback:** jeśli V8 aktywny i tabele istnieją → `pfService.semanticReadback(ideaId)` wywoływane; wynik wstrzyknięty do init-summary inicjatywy jako sekcja „## Process Flow".
- Inicjatywa tworzona z kontekstem Process Flow.

### 21.3 Process Flow → Eksport do prezentacji (M17/M19)

- Klik eksport do prezentacji (jeśli przycisk dostępny).
- **Asercja Network:** `POST /api/presentations/decks` z danymi z Process Flow.
- Deck tworzony z zawartością grafu procesu.

### 21.4 Process Flow → Workspace inne narzędzia (M06/M08/M09)

- Przełącz z Process Flow na Mind Map (M06) w tym samym workspace.
- **Asercja:** stan Process Flow zachowany w `extensions.processFlow`; Mind Map ładuje własny stan.
- Wróć do Process Flow → węzły nadal tam są.

---

## 22. Testy przekrojowe

### 22.1 i18n — PL/EN

- Ustaw język UI na **PL**. Sprawdź:
  - Toolbar: nazwy trybów PL (`Klasyczny przepływ`, `Automatyzacja`, `Strumień wartości`).
  - Etykiety nowych węzłów PL (`Start`, `Koniec`, `Akcja`, `Decyzja`, `Wyzwalacz`, itd.).
  - Toast messages PL (`Układ automatyczny zastosowany`, `Walidacja przepływu nie powiodła się`).
  - ARIA label canvas: `role="region" aria-label="Edytor przepływu procesu"`.
- Przełącz na **EN**. Sprawdź odpowiedniki EN.
- **Asercja:** zero hardkodowanych PL-only lub EN-only napisów. `[252 i18n marker w module — §G DoD]`

### 22.2 Dark mode

- Przełącz na dark mode (jeśli dostępny w UI).
- **Asercja:** canvas ma `dark:bg-navy-950`; MiniMap `dark:!bg-navy-900/80`; lanes zachowują kolory presetów (nie przekształcone do niezgodnych barw); węzły czytelne w ciemnym tle.
- Zero kontrastowych artefaktów (białe węzły na białym tle = FAIL).

### 22.3 Zero błędów konsoli

- Podczas wszystkich powyższych testów: Console (zakładka DevTools) NIE zawiera żadnych:
  - `Uncaught TypeError`
  - `React Error`
  - `Unhandled Promise Rejection`
  - Czerwonych ERROR wpisów
- **Dozwolone:** warning (`[Deprecation]`, ReactFlow internal warnings o keys) — odnotuj jeśli są.
- **[KNOWN-BUG L-01]** 404 do `/api/v8/process-flow/nodes/<clientId>` w Network jest oczekiwane — NIE produkuje błędu w Console (fire-and-forget z `catch {}`).

### 22.4 Disabled state — locked=true

- [FLAG] Zaloguj jako `member` bez edycji na idei (read-only).
- **Asercja:** toolbar bez przycisków edycji; węzły nieinteraktywne (`data.locked=true`); skróty Enter/Cmd+D/Delete nie działają (guard `if (locked) return`); `PUT /api/my-work/my-ideas/:id/map` NIE wysyłane.

### 22.5 Duży graf — performance [MANUAL]

- Utwórz lub zaimportuj graf z ~50 węzłami i ~60 krawędziami.
- **Asercja:** Canvas renderuje się bez widocznego freezu (< 1 s na auto-layout, < 500 ms na undo/redo).
- Blob-save z dużym grafem: `PUT /api/my-work/my-ideas/:id/map` z dużym body → 200 (brak 413 Payload Too Large).

### 22.6 Viewport i responsive [MANUAL]

- Zmniejsz okno przeglądarki do ~1024x768.
- **Asercja:** toolbar nie jest ucięty (scroll lub wrap); panele boczne nie zasłaniają canvasu; minimapa nie wychodzi poza ekran.

### 22.7 Accessibility (A11y) — podstawowe

- `role="region" aria-label="Edytor przepływu procesu"` na głównym div (`IdeaProcessFlowTool.tsx:1875-1876`).
- Przyciski toolbaru mają `aria-label` lub `title`.
- Sprawdź fokus klawiatury: Tab → przyciski toolbaru; Shift+Tab wstecz.
- **Asercja:** brak `tabIndex=-1` na interaktywnych elementach bez tytułu.

---

## 23. Testy regresji automatyczne

### 23.1 Uruchom suity jednostkowe

```bash
# W katalogu repozytorium:
npx vitest run src/components/MyWork/processflow/__tests__/useProcessFlowCRUD.smoke.test.ts
npx vitest run server/src/routes/v8/__tests__/p14-processflow-canon.test.ts
npx vitest run server/src/routes/v8/__tests__/p14-processflow-service.test.ts
npx vitest run server/src/routes/v8/__tests__/processFlow.smoke.test.ts
```

**Asercja:** wszystkie 136 testów PASS (zero FAIL).

### 23.2 Weryfikacja specyficznych cases z testów

- `shapeToObjectType('decision')` = `'decision_gateway'` ✓
- `shapeToObjectType('action')` = `'task'` ✓
- `useProcessFlowCRUD` disabled → zero wywołań fetch ✓
- `createNode` wysyła `snake_case` body (object_type, position_x, position_y, lane_id) ✓
- `createEdge` wysyła `source_node_id`, `target_node_id`, `edge_type: 'sequence_flow'` ✓
- Hook swallows network errors (fire-and-forget, nie rzuca do UI) ✓

### 23.3 Luki w testach (odnotuj, nie fix)

Testy jednostkowe NIE łapią:
- Rozjazdu ID klient↔serwer (L-01) — wymaga E2E z prawdziwym DB
- Wyłączonego `nodesConnectable` — wymaga renderowania ReactFlow
- Rozjazdu koperty `{data,meta}` dla readback
- Kontraktu AI Proposal `{prompt}` vs `operations[]`

---

## 24. Format raportu testowego

Każdy tester po przejściu sekcji wypełnia tabelę:

```markdown
## Raport — M07 Process Flow — [IMIĘ] — [DATA]

| # Sekcja | Tytuł | Status | Uwagi / Dowód |
|---|---|---|---|
| 1.1 | Beta badge i dostępność | PASS/FAIL | screenshot / URL |
| 2.2 | Hydratacja z bloba | PASS/FAIL | Network GET /my-ideas/:id/map [wersja X] |
| 3.1 | Każdy kształt Classic | PASS/FAIL | 4/4 kształtów OK / brak kształtu X |
| ... | ... | ... | ... |
| [KNOWN-BUG L-01] | V8 DELETE 404 | EXPECTED-FAIL | DELETE /nodes/<id> → 404, Canvas OK |
| [KNOWN-BUG L-03] | AI Proposal STUB | EXPECTED-FAIL/SKIPPED | DP-5 ukryte LUB stub aktywny |
```

**Wymagane dowody:**
- Screenshot canvasu dla §3 (wszystkie kształty widoczne)
- Network log dla §6.1 (blob POST krawędzi) i §15.1 (brak serwerowego requestu dla PNG)
- Network log §12.1 (backend validate — 200 + body `issues[]`)
- Network log §13.1 (AI Coach — 200 + niepuste `insights`)
- Screenshot §19.1 po reload (te same węzły)

---

## 25. Definition of Done (DoD)

Test M07 Process Flow uznajemy za **ZALICZONY** gdy:

- [ ] §1: Gating OK (beta badge, nawigacja do workspace, cross-org 403)
- [ ] §2: Hydratacja blob PASS (reload zachowuje stan)
- [ ] §3: Wszystkie 24 kształty (`FlowShape`) tworzą węzły bez błędów (podzielone na tryby Classic/Automation/VSM + kity BPMN/System/Org)
- [ ] §4: Edycja węzła (rename, metryki, toolbar) — blob zaktualizowany
- [ ] §5: Usunięcie węzła — blob zaktualizowany; V8 DELETE 404 = EXPECTED-FAIL (odnotuj)
- [ ] §6: Drag-to-connect [MANUAL] tworzy krawędź lub zgłoszony P0-A z dowodem
- [ ] §7: Drag & drop node [MANUAL] zmienia pozycję
- [ ] §8: Lanes — add/rename/kolor/kolejność/delete — wszystkie PASS
- [ ] §9: Undo/Redo — 3+ operacje cofnięte i przywrócone
- [ ] §10: Auto-layout — wizualnie poprawne + undo
- [ ] §11: Walidacja FE — 4 scenariusze (no-start, no-end, dangling, decision) PASS
- [ ] §12: Backend validation — `POST /validate` zwraca 200 z `issues[]`
- [ ] §13: AI Coach/Summary/Savings — realne odpowiedzi LLM (nie puste/mock)
- [ ] §14: AI Proposal — EXPECTED-FAIL (STUB) lub SKIPPED (DP-5 ukryte)
- [ ] §15: Eksport PNG — plik pobrany bez server call; JSON/Readback PASS gdy V8 aktywne
- [ ] §16: Minimap/fullscreen/fit-view PASS
- [ ] §17: Wszystkie 13 skrótów klawiszowych PASS
- [ ] §18: Health poll wysyłany; baner degradacji widoczny jeśli `degraded=true`
- [ ] §19: Persistencja pełna — reload + conflict 409 odnotowany
- [ ] §21: Cross-module — Open Chat z kontekstem PASS; develop endpoint odnotowany
- [ ] §22: i18n PL+EN, dark mode, zero błędów Console, disabled-state, A11y
- [ ] §23: 136 testów jednostkowych PASS
- [ ] KNOWN-BUGI odnotowane z dowodem, Canvas funkcjonalny mimo nich

---

*Wygenerowano 2026-06-16. Wzorzec: `TESTY_M01_CZAT.md`. Grounding: `Harvard/wdrozenie-100/M07-ideas-process-flow.md`, `Harvard/modules/M07-ideas-process-flow/KARTA_AUDYTU.md`, `MODULE_02C_process-flow.md`, kod źródłowy `IdeaProcessFlowTool.tsx` (2688 l.) + processflow/ (12 plików).*
