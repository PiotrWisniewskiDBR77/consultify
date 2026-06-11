# Moduł 02C — Ideas: Process Flow — Karta audytu + plan rozwoju

**Data audytu:** 2026-06-11 (branch `feat/deliverables-light`) · **Metoda:** weryfikacja realnego kodu, dowody `plik:linia`
**Gotowość: 48/100 — Beta (edytor UI) / Alpha (integracja backendowa)**

**Werdykt:** Solidny, bogaty funkcjonalnie edytor diagramów z realnym AI i działającą persystencją blobową, ale cała warstwa V8 (18 endpointów + nowa migracja) jest w runtime martwa lub produkuje śmieciowe dane przez 3 niezależne defekty kontraktu (brak auth, rozjazd ID, rozjazd koperty odpowiedzi), a rysowanie połączeń myszą jest w kodzie wyłączone.

---

## 1. CO JEST REALNE

- **Migracja ISTNIEJE i jest zacommitowana** — `server/migrations/20260603_v8_process_flow.sql` (commit `10d59fe7e4`): `CREATE SCHEMA v8` + `v8.v8_process_flow_nodes` (:23-38) + `v8.v8_process_flow_edges` (:47-58), idempotentna, z indeksami. `tableExists()` poprawnie szuka w schemacie `v8` (`server/src/utils/DbPromise.ts:459-467`). **Stan z audytu 06-02 („brak migracji") jest nieaktualny w kodzie.** UWAGA: runner manualny (`package.json:177` `db:migrate`) — prod (kod z 2026-05-18) **prawie na pewno tabel nie ma**.
- **`useProcessFlowCRUD` nie jest już dead code** — zamontowany z `enabled: !locked` (`IdeaProcessFlowTool.tsx:590`); wywołania: `createNode` (:1060), `createEdge` (:1008), `deleteNode` (:1383).
- **18 endpointów V8 realnych** — `server/src/routes/v8/processFlow.routes.ts` (506 linii), mount `/api/v8/process-flow` (`v8/index.ts:82`), za `verifyToken`+`requireV8OrgContext`+`v8OrgGate` (`v8/index.ts:40-57`) i `ENABLE_V8_GLOBAL` (=true w `.env:32`). Serwis `processFlowService.ts` (1222 linie) — realny SQL CRUD z limitami, walidacją 2-warstwową, readbackiem, eksportem i posture degradacji.
- **Persystencja główna (blob) działa** — `useIdeaMapSync` z wersjonowaniem (`IdeaProcessFlowTool.tsx:530-536`), autosave draft (:1554-1557), manualny zapis ze snapshotem (:1539-1552), hydratacja z `Api.getMyIdeaMap` (:884-953). Tryby/kity/lanes w `extensions.processFlow` (:638-657).
- **Realny LLM w AI Coach / Summary / Savings / ghost-nodes** — `Api.generateIdeaAI` → `ideaAIGeneratorService.ts` → `llmService.callStructured` z Zod schema (:1160-1172; schematy `process_coach/process_summary/process_savings/next_step` :623-627).
- **Edytor**: undo/redo (drag-snapshot :808-813), auto-layout dagre (:393-419), lanes z rename/delete/color/reorder + drag-między-lane po Y (:820-860), 3 tryby + 3 kity semantyczne (classic/automation/vsm/bpmn/system/org :539-541), insert-between (:1128), split-path (:1188), metryki kroku (czas/koszt/FTE/automation/savings :2578-2682), skróty (Cmd+S/Z/D/E/L/0, Enter, F2, Shift+1 :1614-1731), minimap, fullscreen, PNG eksport (`useProcessFlowExport.ts:18-26`), context menu, properties panel, floating toolbar, walidacja lokalna frontendowa (`validateFlow` :211-386).
- **VSM/KPI należą do tego narzędzia**: `VSMNodeComponent` (import :134, użycie :545), `VSMTimelineBar` (:2317-2321), `ProcessKPIDashboard` (:2324-2334). `ProcessFlowHealthScore` żyje w `IdeaWorkspaceTools.tsx:785`.
- **Git**: wszystkie pliki narzędzia zacommitowane.

## 2. CO JEST MOCK / STUB / FASADA

- **Panel „AI Proposal" (P14) to fasada bez LLM**: klient wysyła `{prompt}` (`useProcessFlowAIProposal.ts:41`), route **ignoruje prompt** i oczekuje gotowych `operations[]` (`processFlow.routes.ts:411-437`) — `createAIProposal` to in-memory store. „Wygeneruj" tworzy pustą propozycję. Realne AI żyje równolegle w `ideaAIGenerator` (inna ścieżka).
- **`messageFlow` edge type martwy**: `edgesWithHandlers` wymusza `type: 'flowEdge'` dla WSZYSTKICH krawędzi (`IdeaProcessFlowTool.tsx:748`) → `MessageFlowEdge.tsx` (121 linii) nieosiągalny.
- **`viewState` hardkod**: `{layoutMode:'horizontal', showGrid:true, snap:true}` zapisywane na sztywno (:652), nigdzie nie odczytywane.

## 3. CO JEST ZEPSUTE / BRAKUJĄCE

**P0-A — Rysowanie połączeń myszą wyłączone w kodzie.** `getIdeasToolInteractionProps` zwraca `nodesConnectable: !locked && connectMode` (`canvas/useIdeasToolDefaults.ts:46`), a Process Flow przekazuje tylko `{ locked }` (`IdeaProcessFlowTool.tsx:2288`) — `connectMode` ustawia wyłącznie mindmap (`IdeaRecommendationMap.tsx:5105`). Handle'y nie nadpisują `isConnectable` (`FlowNodeComponent.tsx:197,313`; `nodes/ActivityNode.tsx:50,112`) → `onConnect` (:991) nieosiągalny z UI. Krawędzie można dodać tylko przez insert-between/split-path/AI. *(Wymaga potwierdzenia live, ale kod jednoznaczny.)*

**P0-B — Mirror V8 produkuje niespójne dane (write-only garbage).** Serwer generuje własne `uuidv4()` (`processFlowService.ts:390`), klient **odrzuca odpowiedź** (`void pfCrud.createNode`, :1060). Skutki: (a) `deleteNode(client-id 'pf-...')` zawsze NOT_FOUND (:1383), (b) `createEdge` zapisuje klienckie ID nodów bez walidacji FK (`processFlowService.ts:572-585`) → wiszące referencje, (c) graf z tabel **nigdy nie jest czytany** — `fetchObjects` bez call-site. Mirror = rosnąca sterta osieroconych wierszy.

**P0-C — 5 hooków P14 bez autoryzacji = martwe w runtime.** Gołe `fetch()` bez `getHeaders()`: `useProcessFlowValidation.ts:42`, `useProcessFlowReadback.ts:27`, `useProcessFlowAIProposal.ts:38,62`, `useProcessFlowExport.ts:28`, `useProcessFlowDegraded.ts:32`. Auth jest Bearer-only (`api.ts:668-682`) → walidacja backendowa, readback, AI-proposals, eksport i health-poll dostają 401. Walidacja pokazuje toast błędu; reszta pada **cicho**.

**P1 — Rozjazd koperty odpowiedzi:** serwer opakowuje `{data, meta}` (`processFlow.routes.ts:349,502`), klient robi `setResult(rawJson)` (`useProcessFlowValidation.ts:47-48`); degraded-hook czyta `data.isDegraded` vs serwerowe `{data:{degraded,...}}` (`processFlowService.ts:1153-1170`) → **baner degradacji nigdy się nie pokaże**; TABLE_MISSING na prodzie niewidoczny dla użytkownika.

**P1 — Walidacja/readback/eksport backendowy operują na grafie z tabel V8**, który przez P0-B jest pusty/śmieciowy.

**P1 — Tylko 3 z 13 metod CRUD podpięte**: move, label, gateway-kind, lane, edge-label, deleteEdge nigdy nie wywoływane; insert-between/split-path/ghost-accept omijają mirror (:1128-1237, :1506-1535, :1760-1810).

**P2 — Migracja niezastosowana na środowiskach** (manualny runner; prod=05-18). Do potwierdzenia po promocji Londyn.

## 4. Wiring backendu

| Endpoint (`/api/v8/process-flow`) | Serwis | Podpięty w UI | Działa w runtime |
|---|---|---|---|
| GET /contract | realny (canon) | hook jest, 0 call-sites | n/d |
| GET /:id/objects | realny SQL | **nigdy nie wywoływany** | martwy odczyt |
| POST /:id/nodes | realny SQL | tak (:1060) | zapis OK*, ID gubione |
| PUT nodes/:id/label, /move, /gateway-kind, /lane | realny SQL | **nie** | martwe |
| DELETE nodes/:id | realny SQL | tak (:1383) | zawsze NOT_FOUND (rozjazd ID) |
| POST /:id/edges | realny SQL (bez FK dla sequence) | tak (:1008) | wiszące referencje |
| PUT edges/:id/label, DELETE edges/:id | realny SQL | **nie** | martwe |
| POST /:id/validate | realny (2 warstwy) | tak, ale 401 + zła koperta | **nie działa** |
| GET /:id/readback, /export/:fmt | realny | tak, ale 401 | **nie działa** |
| POST/GET/resolve ai-proposals | in-memory store, **bez LLM** | tak, ale zły kontrakt + 401 | **nie działa** |
| GET /:id/health | realny | tak, ale 401 + isDegraded≠degraded | **nie działa** |

\* pod warunkiem zastosowanej migracji; bez niej 503 TABLE_MISSING połykane przez fire-and-forget (`useProcessFlowCRUD.ts:88-93`).

## 5. Testy

- 4 suity, **136 testów, wszystkie zielone** (uruchomione 2026-06-11): `p14-processflow-canon.test.ts` (~68), `p14-processflow-service.test.ts` (~57, serwis na mockach DB), `processFlow.smoke.test.ts` (6), FE `useProcessFlowCRUD.smoke.test.ts` (8).
- **Czego testy NIE łapią**: rozjazdu ID klient↔serwer, braku auth w 5 hookach, rozjazdu koperty `{data,meta}`, wyłączonego `nodesConnectable`, kontraktu `{prompt}` vs `operations[]`. Zero testów komponentu `IdeaProcessFlowTool`, zero E2E.

## 6. UX vs Miro / Lucidchart

**Na plus:** pan PPM/środkowy + select LPM + Space-pan, selection-box partial, minimap, fitView, fullscreen, dagre auto-layout, context menu, floating toolbar, properties panel (F2), bogate skróty, 6 zestawów kształtów, metryki procesowe + KPI dashboard + VSM timeline — tego Miro nie ma out-of-the-box.

**Poniżej standardu rynkowego:**
- **Łączenie**: drag-to-connect wyłączony (P0-A); brak hover-connect, brak „+" na krawędzi node'a, brak „dodaj następny + połącz" jednym gestem.
- **Lanes**: tylko poziome pasy o sztywnej wysokości (`LANE_HEIGHT`), przypisanie node→lane heurystyką pozycji Y (:828-840); brak pionowych pool'i, resize lane, kolapsu.
- **Krawędzie**: jeden typ wizualny (flowEdge wymuszony :748), brak routingu ortogonalnego/waypointów, brak stylów, brak warunków per-branch na gateway'ach.
- **Brak**: smart guides/wyrównywania/dystrybucji, prawdziwego copy-paste (paste=duplicate, :2552), grupowania, komentarzy, importu/eksportu BPMN XML, realtime współedycji (CollaborationOverlay to presence, nie współedycja).

---

## 7. PLAN ROZWOJU — Process Flow

### Fala 1 — Odblokowanie podstaw (quick wins o dużym efekcie)
1. **Przywrócić rysowanie połączeń** (`connectMode`/`nodesConnectable` + tryb connect w toolbarze) — bez tego narzędzie do flow nie spełnia minimum kategorii; 1-liniowa przyczyna.
2. **Naprawić auth + kopertę w 5 hookach P14** (getHeaders + `json.data`) — odblokowuje za jednym zamachem walidację backendową, readback, eksport i baner degradacji, które są już napisane po obu stronach.
3. **Zastosować migrację na staging/prod + widoczna telemetria TABLE_MISSING.**

### Fala 2 — Jedno źródło prawdy persystencji (decyzja architektoniczna)
4. **Mirror V8: naprawić albo wyciąć** — albo kontrakt ID (klient nadaje ID / mapuje odpowiedź) + odczyt `GET /objects` przy hydratacji + podpięcie pozostałych 10 metod CRUD, albo świadome usunięcie mirroru; dziś podwójny zapis produkuje niespójne dane i fałszywe poczucie „semantycznej" persystencji.
5. **Domknąć pipeline AI Proposal E2E** (route z LLM generującym `operations[]`, diff-preview, apply) — właściwy punkt integracji Teresy na poziomie Miro AI; dziś dwa rozjechane systemy AI.

### Fala 3 — Klasa Lucidchart
6. **Edge-UX**: routing ortogonalny + waypointy, typy krawędzi (message/sequence), warunki na wyjściach gateway'a — wymagane dla wiarygodności BPMN-ish u klientów konsultingowych.
7. **Prawdziwe swimlane containers** (pionowe poole, resize, kolaps, przypisanie przez drop, nie heurystykę Y).
8. **Realtime współedycja** (rozszerzyć CollaborationOverlay o synchronizację operacji) — zależne od decyzji o wspólnym dokumencie (patrz 02A Fala 2).
