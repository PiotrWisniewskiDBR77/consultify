# M07 — Ideas — Process Flow — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `f8fec59536`) · **Audytor:** Claude (osobiście — agents stalled, źródło: `Harvard/podzial/ideas/MODULE_02C_process-flow.md`)
**Wejścia:** `MODULE_02C_process-flow.md` (pełna analiza kodu 2026-06-11) · `INV_B_my-work.md` §Process Flow · Protokół V1
**Evidence:** plik:linia zgodnie z MODULE_02C — wszystkie pozycje zweryfikowane w kodzie

## OCENA: 55/100 — Tier: Alpha · status 🟦 NIEPEŁNY (bez Fazy 4)

> **Re-audit 2026-06-11 (Fala 2):** P0-A + P0-C były fałszywymi alarmami — już naprawione przed tym audytem; P1 koperta naprawiona teraz (`useProcessFlowDegraded` + `useProcessFlowValidation`). Wynik 44→55.

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 20 | Rdzeń blob + LLM + edytor REALNE; P0-A i P0-C były fałszywymi alarmami; jedyny realny P0: V8 mirror ID mismatch (DELETE NOT_FOUND, GET objects martwy). |
| B. Wiring i dane | 15 | 12 | Blob-sync solid; walidacja i health działają po P1 fix; V8 mirror: GET objects martwy, DELETE NOT_FOUND, krawędzie = wiszące referencje. |
| C. Testy automatyczne | 15 | 8 | 136 testów PASS; żaden nie łapie V8 mirror ID mismatch ani martwego GET objects — luka P0-B nadal niepokryta. |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana — deferred. |
| E. Kanony/UI | 10 | 7 | Baner degradacji teraz działa (P1 fix); viewState hardkodowany (:652); messageFlowEdge nieosiągalny (:748). |
| F. Bezpieczeństwo/dostęp | 10 | 8 | verifyToken+requireV8OrgContext+v8OrgGate wzorcowe; P0-C+P1 naprawione; WS `/ws/collab/:ideaId` — JWT bez org-membership check (P2). |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana — deferred; migracja `20260603_v8_process_flow.sql` w repo ale runner manualny. |
| **Hard cap zastosowany?** | — | — | Faza 4 niewykonana → max 70; wynik 55 < 70 — cap niewiążący. Brak cross-org WRITE. |

**Werdykt jednym akapitem (re-audit 2026-06-11):** Process Flow ma solidny fundament — persystencja blobowa z optimistic-lock, realny LLM w AI Coach/Summary/Savings, bogaty edytor diagramów (dagre, VSM, metryki kroków, 6 zestawów kształtów) i 136 testów. Pierwotny audyt błędnie zgłosił P0-A (connectMode) i P0-C (auth w hookach) jako zepsute — oba były już naprawione. Aktualnie zepsute: V8 mirror ID mismatch (serwer nadaje własne UUID, DELETE zawsze NOT_FOUND, GET objects martwy) i baner degradacji/walidacja zwracały złe dane z powodu błędnej koperty (teraz naprawione). Jedyna pozostała praca to zdecydować o V8 mirror (naprawić kontrakt ID ALBO wyciąć mirror i zostawić wyłącznie blob).

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

**[P0-B] V8 mirror ID mismatch (`processFlowService.ts:390`, `IdeaProcessFlowTool.tsx:1060,1383`):**
Serwer generuje własne UUID; klient `void pfCrud.createNode` odrzuca odpowiedź → DELETE zawsze NOT_FOUND; createEdge zapisuje klienckie IDs bez FK walidacji → wiszące referencje; GET /objects bez call-site → graf nigdy nie odczytywany.

~~**[P0-A]**~~ NAPRAWIONE: `IdeaProcessFlowTool.tsx:2288` przekazuje `connectMode: !locked` — pierwotny audyt mylnie zgłaszał.
~~**[P0-C]**~~ NAPRAWIONE: wszystkie 5 hooków używa `getHeaders()` — pierwotny audyt mylnie zgłaszał.
~~**[P1]**~~ NAPRAWIONE (2026-06-11): `useProcessFlowDegraded` rozpakowuje `json.data` + czyta `health.degraded`; `useProcessFlowValidation` czyta `json.data`.

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

### Fala 1 — UKOŃCZONA
- ~~[P0-A]~~ ✅ connectMode już działa
- ~~[P0-C]~~ ✅ auth w hookach już działa
- ~~[P1]~~ ✅ NAPRAWIONE 2026-06-11 — `useProcessFlowDegraded` + `useProcessFlowValidation`

### Fala 2 — V8 mirror + migracja
1. Zastosować migrację `20260603_v8_process_flow.sql` na staging/prod.
2. Decyzja: naprawić kontrakt ID V8 mirror (klient mapuje odpowiedź serwera UUID→localId) + podpiąć GET /objects przy hydratacji — ALBO wyciąć mirror i zostawić wyłącznie blob.

### Fala 3 — Klasa Lucidchart
6. Edge UX: routing ortogonalny + waypointy + typy krawędzi (message/sequence/conditional)
7. Prawdziwe swimlane containers (resize, kolaps, pionowe poole)
8. WS resource-auth: org-membership check przy upgrade
9. Domknięcie AI Proposal E2E (route z LLM generującym `operations[]`)

### Definition of Done
- [x] P0-A: drag-to-connect działa ✅
- [x] P0-C: hooki P14 zwracają 200 ✅
- [x] P1: baner degradacji widoczny ✅ (2026-06-11)
- [ ] Migracja zastosowana na staging
- [ ] V8 mirror: kontrakt ID naprawiony LUB mirror wycięty
- [ ] Faza 4 live (Railway access)
