# M07 — Ideas — Process Flow — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `f8fec59536`) · **Audytor:** Claude (osobiście — agents stalled, źródło: `Harvard/podzial/ideas/MODULE_02C_process-flow.md`)
**Wejścia:** `MODULE_02C_process-flow.md` (pełna analiza kodu 2026-06-11) · `INV_B_my-work.md` §Process Flow · Protokół V1
**Evidence:** plik:linia zgodnie z MODULE_02C — wszystkie pozycje zweryfikowane w kodzie

## OCENA: 44/100 — Tier: Alpha · status 🟦 NIEPEŁNY (bez Fazy 4)

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 15 | Rdzeń blob-persystencji, realny LLM (AI Coach/Summary/Savings), bogaty edytor (dagre, VSM, metryki, 6 zestawów kształtów) — REALNE; ale P0-A rysowanie połączeń wyłączone w kodzie; P0-B V8 mirror write-only garbage; P0-C 5 hooków P14 bez auth → 401. |
| B. Wiring i dane | 15 | 9 | Blob-sync solid (org+user-scope, wersjonowanie, autosave); V8 18 endpointów istnieje, ale w runtime: GET objects nigdy niwywoływany, DELETE zawsze NOT_FOUND, krawędzie = wiszące referencje, walidacja/readback/export = 401. |
| C. Testy automatyczne | 15 | 8 | 136 testów PASS w 4 suitach (canon/service/smoke/crud-smoke), ale żaden nie łapie rozjazdu ID klient↔serwer, braku auth w 5 hookach, wyłączonego nodesConnectable ani rozjazdu koperty. |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana — deferred. |
| E. Kanony/UI | 10 | 6 | Bogaty edytor canvas (brak §27 — właściwe dla canvas tool); viewState hardkodowany (:652); messageFlowEdge nieosiągalny (:748); brak baneru degradacji przy TABLE_MISSING. |
| F. Bezpieczeństwo/dostęp | 10 | 6 | verifyToken+requireV8OrgContext+v8OrgGate wzorcowe; blob org+user-scope poprawny; WS `/ws/collab/:ideaId` — JWT bez org-membership check na resource (jak M06 P1). |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana — deferred; migracja `20260603_v8_process_flow.sql` w repo ale runner manualny — na prodzie prawdopodobnie tabel nie ma → TABLE_MISSING połykane cicho. |
| **Hard cap zastosowany?** | — | — | Faza 4 niewykonana → max 70; wynik 44 < 70 — cap niewiążący. Brak cross-org WRITE (V8 org+user-scoped). |

**Werdykt jednym akapitem:** Process Flow ma solidny fundament — persystencja blobowa z optimistic-lock, realny LLM w AI Coach/Summary/Savings, bogaty edytor diagramów (dagre, VSM, metryki kroków, 6 zestawów kształtów) i 136 testów. Trzy P0 sprawiają, że warstwa V8 jest de facto write-only garbage: (1) rysowanie połączeń myszą wyłączone kodem — `connectMode` nigdy nie ustawiany dla Process Flow, `nodesConnectable=false`; (2) mirror V8 produkuje niespójne dane — serwer nadaje własne UUID, klient odrzuca odpowiedź, DELETE zawsze NOT_FOUND, krawędzie bez walidacji FK; (3) pięć hooków P14 wysyła żądania bez `Authorization: Bearer` — walidacja, readback, eksport, health, AI-proposals zawsze 401. Ścieżka do Bety jest krótka: naprawić auth w 5 hookach (1 linia na hook), przywrócić `connectMode`, zdecydować o V8 mirror.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)

| Scenariusz | Status |
|---|---|
| S1: Tworzenie węzła/krawędzi → persystencja | DZIAŁA (blob) / ZEPSUTE (V8 mirror P0-B) |
| S2: Rysowanie połączeń myszą | ZEPSUTE — P0-A (`nodesConnectable=false`) |
| S3: Walidacja backendowa + health | ZEPSUTE — P0-C (401 wszystkie hooki) |
| S4: AI Coach / Summary / Savings | DZIAŁA — realny LLM |
| S5: Eksport PNG | DZIAŁA — kliencki `useProcessFlowExport` |
| S6: Migracja na prod | NIEZNANY — manual runner, prod=2026-05-18 |

## 1. Prawda kodu (FAZA 1)

### 1a. REALNE
- Blob-sync: `useIdeaMapSync` z wersjonowaniem, autosave, offline-queue (`IdeaProcessFlowTool.tsx:530-536`)
- LLM: `ideaAIGeneratorService.ts:1160-1172` — realny `llmService.callStructured` z Zod schema (coach/summary/savings/next_step/ghost-nodes)
- Edytor: dagre auto-layout, lanes (rename/delete/color/reorder), metryki kroków (czas/koszt/FTE/automation/savings `:2578-2682`), VSM timeline (:2317-2321), KPI dashboard (:2324-2334), 6 zestawów kształtów, skróty Cmd+S/Z/D/E/L/0/Enter/F2 (:1614-1731), minimap, fullscreen, insert-between, split-path
- Migracja `20260603_v8_process_flow.sql`: schema v8, tabele `v8_process_flow_nodes` + `v8_process_flow_edges` z indeksami

### 1b. MOCK / STUB
- **AI Proposal Panel (P14)**: route `processFlow.routes.ts:411-437` ignoruje `{prompt}`, oczekuje gotowych `operations[]`; `createAIProposal` = in-memory store (brak LLM)
- **`messageFlow` edge**: wymuszony typ `flowEdge` dla wszystkich krawędzi (`:748`) → `MessageFlowEdge.tsx` (121 linii) nieosiągalny
- **`viewState` hardkod**: zapisywane sztywno (`:652`), nigdzie nie odczytywane

### 1c. ZEPSUTE

**[P0-A] Rysowanie połączeń wyłączone (`canvas/useIdeasToolDefaults.ts:46`, `IdeaProcessFlowTool.tsx:2288`):**
`nodesConnectable: !locked && connectMode` — `connectMode` ustawiany tylko w mindmapie, Process Flow przekazuje `{locked}` bez `connectMode` → `onConnect` (:991) nieosiągalny.

**[P0-B] V8 mirror write-only garbage (`processFlowService.ts:390`, `IdeaProcessFlowTool.tsx:1060,1383`):**
Serwer generuje własne UUID; klient `void pfCrud.createNode` odrzuca odpowiedź → DELETE zawsze NOT_FOUND; createEdge zapisuje klienckie IDs bez FK walidacji → wiszące referencje; GET /objects bez call-site → graf nigdy nie odczytywany.

**[P0-C] 5 hooków bez Authorization header:**
`useProcessFlowValidation.ts:42`, `useProcessFlowReadback.ts:27`, `useProcessFlowAIProposal.ts:38,62`, `useProcessFlowExport.ts:28`, `useProcessFlowDegraded.ts:32` — gołe `fetch()` bez `getHeaders()` → wszystkie 401.

**[P1] Rozjazd koperty odpowiedzi:** serwer `{data,meta}` (`:349,502`), klient `setResult(rawJson)` → baner degradacji nigdy nie pokaże się; `data.isDegraded` vs `{data:{degraded,...}}` (`processFlowService.ts:1153`).

### 1d. MARTWY KOD
- `MessageFlowEdge.tsx` — 121 linii nieosiągalnych
- `viewState` zapis bez odczytu

### 1e. Wiring

| Endpoint `/api/v8/process-flow` | Call-site | Runtime | Status |
|---|---|---|---|
| `POST /:id/nodes` | `:1060` | ID gubione | P0-B |
| `DELETE nodes/:id` | `:1383` | zawsze NOT_FOUND | P0-B |
| `POST /:id/edges` | `:1008` | wiszące referencje | P0-B |
| `GET /:id/objects` | brak | martwy | Dead |
| `POST /:id/validate` | tak, bez auth | 401 | P0-C |
| `GET /:id/readback`, `/export/:fmt` | tak, bez auth | 401 | P0-C |
| `POST/GET /ai-proposals` | tak, bez auth + brak LLM | 401 | P0-C |
| `GET /:id/health` | tak, bez auth + zła koperta | 401 | P0-C+P1 |
| PUT label/move/gateway, DELETE edge | brak | martwe | P1 |

Blob-sync: `GET/PUT /api/my-work/my-ideas/:id/map` — DZIAŁA, org+user-scope.

### 1f. Flagi
| Flaga | Default | Wpływ |
|---|---|---|
| `ENABLE_V8_GLOBAL` | false | V8 mirror aktywny tylko przy true |
| `MYWORK_IDEAS` | `'closed'` | beta gating — blokuje non-admin |

### 1g. Połączenia
- Blob-sync wspólny z mindmap/whiteboard/table przez `useIdeaMapSync`
- Eksport do prezentacji: `/api/presentations/decks`

## 2. Testy automatyczne (FAZA 2)

| Test | Pokrycie | Luka |
|---|---|---|
| `p14-processflow-canon.test.ts` (~68) | spec constants + walidacja | NIE łapie wyłączonego nodesConnectable |
| `p14-processflow-service.test.ts` (~57) | serwis na mockach DB | NIE łapie rozjazdu ID klient↔serwer |
| `processFlow.smoke.test.ts` (6) | dymne route-check | NIE łapie braku auth w hookach |
| `useProcessFlowCRUD.smoke.test.ts` (8) | hook smoke | NIE łapie rozjazdu koperty |

Brak testów dla: draw-connection UX, auth flow hooków P14, kontrakt ID lifecycle klient↔serwer, E2E.

## 3. Środowiska / Railway (FAZA 3) — PENDING

Migracja w repo, runner manualny. Prod (2026-05-18) = tabele prawdopodobnie nie istnieją. Weryfikacja zbiorczo.

## 4. Żywa weryfikacja frontu (FAZA 4) — PENDING (deferred)

## 5. Kanony i standardy (FAZA 5)

- **§27**: nie dotyczy — canvas tool, nie tabela listowa
- **Degradacja**: brak baneru TABLE_MISSING; health baner niewidoczny (P0-C)
- **Beta gating**: `MYWORK_IDEAS: 'closed'`, SSOT betaAccess.ts ✅

## 6. Bezpieczeństwo i dostęp (FAZA 6)

V8 router: `verifyToken` + `requireV8OrgContext` + `v8OrgGate` — wzorcowe.
Blob-sync: `WHERE idea_id=? AND user_id=? AND organization_id=?` — poprawny.
**[P1] WS resource-auth gap**: `/ws/collab/:ideaId` — JWT verify bez org-membership check dla resource (`ideaCollabWs.gateway.ts:258-283`).
Brak cross-org WRITE. Hard cap security nieaktywny.

## 7. PLAN DOKOŃCZENIA (FAZA 8)

### Fala 1 — Odblokowanie P0 (1-2 dni, duży efekt)
1. **[P0-A]** Dodać `connectMode` do `IdeaProcessFlowTool.tsx:2288` + przycisk connect w toolbarze — Weryfikacja: drag-connect między węzłami działa.
2. **[P0-C]** Dodać `getHeaders()` do 5 hooków P14 — Weryfikacja: walidacja/readback/eksport zwracają 200.
3. **[P1]** Klient czyta `json.data` zamiast `rawJson`; health sprawdza `data.degraded` — Weryfikacja: baner degradacji pojawia się przy TABLE_MISSING.

### Fala 2 — V8 mirror + migracja
4. Zastosować migrację `20260603_v8_process_flow.sql` na staging/prod.
5. V8 mirror: naprawić kontrakt ID (klient mapuje odpowiedź) + podpiąć GET /objects przy hydratacji + pozostałe 10 metod CRUD — ALBO wyciąć mirror i zostawić wyłącznie blob.

### Fala 3 — Klasa Lucidchart
6. Edge UX: routing ortogonalny + waypointy + typy krawędzi (message/sequence/conditional)
7. Prawdziwe swimlane containers (resize, kolaps, pionowe poole)
8. WS resource-auth: org-membership check przy upgrade
9. Domknięcie AI Proposal E2E (route z LLM generującym `operations[]`)

### Definition of Done
- [ ] P0-A: drag-to-connect działa
- [ ] P0-C: hooki P14 zwracają 200
- [ ] P1: baner degradacji widoczny
- [ ] Migracja zastosowana na staging
- [ ] Faza 4 live (Railway access)
