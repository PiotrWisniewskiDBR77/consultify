# WP M07 — Ideas — Process Flow · dokończenie do 100%

**Pula:** ideas · **Karta:** `Harvard/modules/M07-ideas-process-flow/KARTA_AUDYTU.md` (ocena 55/100) · **Rozmiar:** M (1–3 dni) · **Żywy bloker:** P0 struct (V8 mirror ID mismatch)
**Faza programu:** FAZA 1 (blokery) → FAZA 3 (szlif) → FAZA 4 (sweepy) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Solidny fundament: persystencja blobowa z optimistic-lock przez wspólny `useIdeaMapSync` (`IdeaProcessFlowTool.tsx:530–536`), realny LLM w AI Coach/Summary/Savings (`ideaAIGeneratorService.ts:1160–1172`, `callStructured` + Zod), bogaty edytor diagramów (dagre auto-layout, lanes, metryki kroków czas/koszt/FTE/automation/savings, VSM timeline, KPI dashboard, 6 zestawów kształtów, skróty), eksport PNG, 136 testów PASS. **Re-audit karty:** P0-A (connectMode) i P0-C (auth w hookach) były fałszywymi alarmami — już naprawione; baner degradacji/walidacja naprawione (`useProcessFlowDegraded`/`useProcessFlowValidation`). Jedyny realny żywy P0: V8 mirror ID mismatch — serwer nadaje własne UUID, klient je odrzuca → DELETE zawsze NOT_FOUND, GET /objects martwy, krawędzie = wiszące referencje. Blokuje tier: decyzja o V8 mirror + migracja + WS org-scope.

## 2. Luki do DoD

### (a) BACKEND / INTEGRACJA — **P0-B bloker struct (FAZA 1)**
- **[P0-B] V8 mirror ID mismatch.** `processFlowService.ts:390` generuje serwerowe UUID; klient `void pfCrud.createNode` (`IdeaProcessFlowTool.tsx:1060`) odrzuca odpowiedź → `DELETE nodes/:id` (`:1383`) zawsze NOT_FOUND; `createEdge` (`:1008`) zapisuje klienckie ID bez FK-walidacji → wiszące referencje; `GET /:id/objects` bez call-site → graf nigdy nie odczytywany z mirror. Decyzja (Fala 2 karty): **albo naprawić kontrakt ID** (klient mapuje serwerowe UUID→localId + podpiąć `GET /objects` przy hydratacji), **albo wyciąć mirror** i zostawić wyłącznie blob-sync (który DZIAŁA, org+user-scope). Rekomendacja: jeśli mirror nie ma realnego konsumenta poza blobem — wyciąć (mniejsze ryzyko, mniej dual-stacku).

### (b) BEZPIECZEŃSTWO / WS — P1 (FAZA 1)
- **[P1/P2] WS resource-auth gap.** `/ws/collab/:ideaId` — JWT verify bez org-membership check dla resource (`ideaCollabWs.gateway.ts:258–283`). **WSPÓLNE z M06/M09** (ten sam gateway). Fix: DB org-check przy upgrade. (V8 router HTTP jest wzorcowy: `verifyToken`+`requireV8OrgContext`+`v8OrgGate`.)

### (c) BACKEND — fasady / długi (FAZA 3)
- **[INTEGRACJA] AI Proposal Panel (P14) = STUB in-memory.** Route `processFlow.routes.ts:411–437` ignoruje `{prompt}`, oczekuje gotowych `operations[]`; `createAIProposal` = in-memory store, bez LLM. Fix: route z LLM generującym `operations[]` ALBO ukrycie.
- **[P1] `messageFlow` edge nieosiągalny** — wymuszony typ `flowEdge` dla wszystkich krawędzi (`:748`) → `MessageFlowEdge.tsx` (121 l.) martwy → wytnij lub udostępnij typy krawędzi.
- **[P2] `viewState` hardkod** zapisywany (`:652`), nigdzie nieodczytywany → wczytywać lub usunąć zapis.

### (d) FRONTEND / UX (FAZA 3)
- Edge UX klasy Lucidchart: routing ortogonalny + waypointy + typy krawędzi (message/sequence/conditional).
- Prawdziwe swimlane containers (resize, collapse, pionowe poole).
- i18n inline (sweep FAZA 4).

### (e) ŚRODOWISKA (FAZA 1/5)
- Migracja `20260603_v8_process_flow.sql` w repo, runner manualny; prod (~2026-05-18) = tabele `v8_process_flow_nodes`/`_edges` prawdopodobnie nie istnieją. Zastosować na staging (zależy od decyzji V8 mirror — jeśli wycięty, migracja zbędna).

### (f) TESTY / E2E (FAZA 1 + 4)
- **[P0 testowy]** żaden z 136 testów nie łapie V8 mirror ID mismatch ani martwego GET /objects. Dodać test kontraktu ID lifecycle klient↔serwer (jeśli mirror zostaje) LUB test braku call-site (jeśli wycięty).
- Brak testów: draw-connection UX, auth flow hooków P14, E2E. CI gate dodać `Londyn` (FAZA 4).

## 3. Kroki realizacji
1. **(FAZA 1, P0-B)** Decyzja V8 mirror: naprawić kontrakt ID (mapowanie serwer UUID→localId + GET /objects przy hydratacji) ALBO wyciąć mirror (zostawić blob). Test odpowiedni do decyzji.
2. **(FAZA 1, P1 WS)** org-membership check w `ideaCollabWs.gateway.ts` (wspólny fix z M06/M09).
3. **(FAZA 1/5)** Migracja `20260603_v8_process_flow.sql` na staging (jeśli mirror zostaje).
4. **(FAZA 3)** AI Proposal: route z LLM ALBO ukrycie; wytnij/udostępnij `MessageFlowEdge`; rozstrzygnij `viewState`.
5. **(FAZA 3)** Edge UX (orthogonal+waypoints+typy), swimlane containers.
6. **(FAZA 4)** Testy kontraktu ID/E2E; CI `Londyn`.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** V8 mirror naprawiony (DELETE/GET działają, krawędzie z FK) LUB wycięty (zero martwych endpointów); AI Proposal realny LUB ukryty; zero martwych przepływów.
2. **Bezpieczeństwo:** WS org-scope verify (Org B → 403); HTTP V8 (już wzorcowe).
3. **i18n:** `t()` pełne.
4. **Tokeny:** Visual Standard.
5. **§27:** N.D. (canvas) — baner degradacji widoczny (już naprawione).
6. **E2E w PR-gate:** kontrakt ID / draw-connection zielone na `Londyn`.

## 5. Weryfikacja
- V8 mirror: utwórz węzeł → DELETE tego węzła → 200 (nie NOT_FOUND); GET /objects zwraca graf; krawędzie mają istniejące FK. LUB: grep call-site V8 endpointów = 0 (wycięte).
- WS: token Org B na `ideaId` Org A → 403.
- Blob-sync: węzły → reload → trwałe (org+user-scope).
- Migracja na staging zastosowana (jeśli mirror zostaje).
- Uwaga DB: dev `.env` → Railway zdalna; prod commit ~2026-05-18.

## 6. Zależności
- **WS org-scope WSPÓLNY z M06 i M09** (`ideaCollabWs.gateway.ts`) — jeden fix.
- Blob-sync wspólny z M05/M06/M08/M09 przez `useIdeaMapSync` — zmiany runtime promieniują.
- Eksport do prezentacji `/api/presentations/decks` — koordynacja z M19.
- Decyzja V8 mirror dotyka flagi `ENABLE_V8_GLOBAL` — uzgodnić z M22/M20 (V8 ekosystem).
