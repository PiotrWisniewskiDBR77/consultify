# TECZKA M07 — Ideas · Process Flow (pełna teczka wg wzorca)

> Teczka = **cienki indeks + reconciliation**. Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).
> **Pula Ideas — uwaga R6:** NIE testowana na żywo 2026-06-13 (brak wpisu Ideas w `UWAGI_TESTY_2026-06-13.md`) → wejścia dziedziczone z karty + reconciliation w kodzie.

## 00 · Nagłówek
- **Moduł:** M07 Ideas-Process Flow · **Pula:** ideas
- **Ocena audytu:** 55/100 · **Status:** FAZA 1 → FAZA 3 · **Rozmiar:** M (i18n **252**×) · **Żywy bloker:** P0-B (V8 mirror ID mismatch)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-12 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M07-ideas-process-flow/KARTA_AUDYTU.md` (§1e · §1g · §5 · §6 · §7) · **Evidence:** `…/evidence/`
- **Kod:** `src/components/MyWork/IdeaProcessFlowTool.tsx` · `src/components/MyWork/processflow/` · `server/src/services/processFlowService.ts` · `server/src/routes/processFlow.routes.ts` · `server/src/gateways/ideaCollabWs.gateway.ts`

## MAPA POKRYCIA
| Warstwa | Stan | Źródło | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟡 | karta §0 | job-to-be-done (niżej) |
| B UX docelowe | 🟡 | karta §5 (canvas) | stany + delty Edge UX (niżej) |
| C Dane+API+reguły | 🟢 | karta §1e + blob-sync + V8 mirror | kontrakt + V8 (niżej) |
| D AI/Teresa | 🟡 | karta (Coach/Summary/Savings) | granice + AI Proposal stub (niżej) |
| E Integracje | 🟢 | karta §1g | WS + V8 ekosystem (niżej) |
| F Epiki | 🟢 | karta §7 | epiki (niżej) |
| G DoD | 🟢 (dołożone) | karta §0/§2 | **liczby grepem** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść+Decyzji+R3** (niżej) |

---

## A · INTENCJA *(z karty + kodu)*
- **Job-to-be-done:** modelować procesy (diagramy z lanes, metryki czas/koszt/FTE/automation/savings, VSM, KPI) jako narzędzie idea — z AI Coach i analizą oszczędności.
- **Persony/role:** konsultant (właściciel), uczestnicy collab org. Org+user-scope (blob-sync wzorcowy).
- **Zakres v1:** edytor diagramów (dagre auto-layout, lanes, 6 zestawów kształtów, skróty) · metryki kroków · VSM timeline + KPI dashboard · realny LLM Coach/Summary/Savings · eksport PNG · blob-sync. **POZA v1 (decyzja):** V8 mirror (jeśli wycięty), Edge UX klasy Lucidchart (delta).
- **Metryka:** trwałość blob-sync; zero martwych endpointów V8.

## B · UX DOCELOWE *(karta §5 + delty — konkretnie kanwa procesu)*
**Layout docelowy (`IdeaProcessFlowTool.tsx` 2688 l.):**
- **Kanwa procesu** — diagram z lanes (swimlanes), 6 zestawów kształtów (BPMN-like: task/gateway/event/data…), dagre auto-layout, skróty klawiaturowe.
- **Toolbar** — dodaj kształt, połącz, auto-layout, eksport PNG; **properties panel** (metryki kroku: czas/koszt/FTE/automation/savings).
- **Analizy** — VSM timeline + KPI dashboard + health-score.
- **AI Coach** — panel oszczędności/summary (realny LLM).

**Stany ekranu:**
| Stan | Docelowo | Dziś |
|---|---|---|
| pełny/edycja | OK | OK |
| **degradacja V8** | banner „Tryb ograniczony — graf zapisywany lokalnie" | **naprawiony (`useProcessFlowDegraded`)** |
| walidacja | inline-błędy struktury | **naprawiona (`useProcessFlowValidation`)** |
| **V8 mirror ID-mismatch** | DELETE/GET działają, FK spójne | **ZEPSUTY (L-01, P0-B)** |
| §27 | N.D. (canvas) | N.D. |

**Mikro-flow zapisu (docelowy):** edycja → blob-sync przez `useIdeaMapSync` (optimistic-lock, org+user-scope) — **DZIAŁA**. Mirror V8 (równoległy serwerowy graf) = ZEPSUTY: rekomendacja DP-7 = **wyciąć mirror, zostać przy blob**.

**Delty Edge UX (jeśli mirror zostaje — niżej priorytet):** routing ortogonalny + waypointy + typy krawędzi (message/sequence/conditional); prawdziwe swimlane containers (resize/collapse/poole pionowe — dziś tylko wizualne pasy).

## C · DANE + API + REGUŁY *(link + V8 mirror enumeracja)*
- **Blob-sync (DZIAŁA — ścieżka kanoniczna):** optimistic-lock przez wspólny `useIdeaMapSync` (`IdeaProcessFlowTool.tsx:530-536`), org+user-scope. Graf procesu trzymany jako blob w `my_idea_maps.extensions_json` (jak M08).
- **V8 mirror — pełny kontrakt (`server/src/routes/v8/processFlow.routes.ts`, 18 endpointów):**
  | Metoda | Ścieżka | Stan |
  |---|---|---|
  | GET | `/contract` | meta |
  | GET | `/:processId/objects` (`:102`) | **martwy — brak call-site klienta** |
  | POST | `/:processId/nodes` (`:115`) | serwer generuje UUID ≠ localId |
  | PUT | `/nodes/:nodeId/{label,move,gateway-kind,lane}` | wymaga serwerowego ID |
  | DELETE | `/nodes/:nodeId` (`:237`) | **zawsze NOT_FOUND (ID mismatch)** |
  | POST/PUT/DELETE | `/:processId/edges`, `/edges/:edgeId/label`, `/edges/:edgeId` | **klienckie ID bez FK → wiszące** |
  | POST | `/:processId/validate` | walidacja |
  | GET | `/:processId/readback`, `/export/:format` | odczyt/eksport |
  | POST/GET/POST | `/ai-proposals`, `/ai-proposals/:id`, `/:id/resolve` | **STUB in-memory (`:411-437` oczekuje gotowych `operations[]`, ignoruje `{prompt}`, brak LLM)** |
  | GET | `/:processId/health` | health-score |
- **Root-cause mirror (P0-B):** `processFlowService.ts:390` generuje serwerowe UUID; klient `void pfCrud.createNode` (`IdeaProcessFlowTool.tsx:1060`) odrzuca odpowiedź → DELETE/`:1383` zawsze NOT_FOUND; `createEdge`/`:1008` zapisuje klienckie ID bez FK; `GET /:id/objects` nigdy nie wołane → mirror nigdy nie odczytywany. **Migracja `20260603_v8_process_flow.sql`** (runner manualny, prawdopodobnie nie na prod ~2026-05-18).
- **WS collab:** `ideaCollabWs.gateway.ts:237-242` — org-scope DB-check + 403/destroy (WSPÓLNY z M06/M09, **zweryfikowany naprawiony**; placeholder `?` do potwierdzenia na PG).
- **DP-7 rekomendacja = WYCIĄĆ mirror:** usuwa 18 martwych/zepsutych endpointów + migrację V8; ścieżka blob-sync wystarcza. **Weryfikacja konsumentów (2026-06-13):** poza modułem `pfService` importuje TYLKO `my-work.routes.ts:36` — i to jeden punkt: `/my-ideas/:id/develop` (`:6031-6089`) czyta `pfService.readback` → wstrzykuje „## Process Flow" do init-summary inicjatywy. **M20/M22 NIE konsumują V8 process-flow** (mount tylko `v8/index.ts:82 /process-flow`). → **Cut jest bezpieczny pod warunkiem przekierowania `develop` readback na blob (`extensions_json`) zamiast `pfService` (jedno call-site).**

## D · AI / TERESA *(link + delty)*
- **Co generuje:** AI Coach/Summary/Savings (`ideaAIGeneratorService.ts:1160-1172`, `callStructured` + Zod) — realny LLM.
- **Delta:** AI Proposal Panel (P14) = STUB in-memory (`processFlow.routes.ts:411-437` ignoruje `{prompt}`, oczekuje gotowych `operations[]`, brak LLM) → route z LLM ALBO ukrycie.

## E · INTEGRACJE *(karta §1g + zależności)*
- **←** lista idei. **→** eksport prezentacji `/api/presentations/decks` (M19).
- **Kręgosłup:** **WS gateway WSPÓLNY z M06 i M09** (jeden fix org-scope, zweryfikowany); blob-sync `useIdeaMapSync` wspólny z M05/M06/M08/M09.
- **Zależności blokujące:** decyzja V8 mirror dotyka flagi `ENABLE_V8_GLOBAL` — uzgodnić z M20/M22 (ekosystem V8).

## F · EPIKI → STORIES → ZADANIA *(Gherkin)*

**EPIK 1 — V8 mirror rozstrzygnięty (P0-B, D-01 → rekom. CUT/DP-7)** *(domyka C/mirror)*
- **Story 1.1 (ścieżka CUT — rekomendowana):** jako utrzymujący chcę usunąć martwy/zepsuty mirror, aby skończyć z dual-stackiem i wiszącymi krawędziami.
  - *Dane* graf trzymany w blobie *gdy* usuwam `v8/processFlow.routes.ts` + `processFlowService.ts` + migrację `20260603` *wtedy* edytor działa wyłącznie na blob-sync **i** brak martwych endpointów (DELETE/GET).
  - Zadania: Z-01 przekieruj `my-work.routes.ts:6031-6089` (`develop` readback) na blob zamiast `pfService` → L-01; Z-02 usuń 18 endpointów + service + migrację → L-01,L-05; Z-03 sprawdź `ENABLE_V8_GLOBAL` brak innych konsumentów (zweryfikowane: brak) → L-01.
  - **Story 1.1-alt (ścieżka FIX):** mapuj serwerowe UUID→localId + wołaj `GET /:id/objects` przy hydratacji + FK na krawędziach. (tylko jeśli mirror w roadmapie).

**EPIK 2 — WS org-scope szczelny (P1, wspólny M06/M09)** — cross-org → 403 + `socket.destroy()` (`:237-242`, naprawione) + test gateway. → **L-02 (naprawione, domknąć testem).**

**EPIK 3 — Fasady/długi uczciwe** *(domyka D + B)*
- **Story 3.1:** jako użytkownik nie chcę panelu AI Proposal, który nic nie generuje.
  - *Gdy* wysyłam `{prompt}` do `/ai-proposals` (`:411-437`) *wtedy* dostaję realne `operations[]` z LLM **lub** panel jest ukryty.
  - Zadania: Z-04 route z LLM generującym operations (D-02) LUB ukryj panel → L-03; Z-05 `MessageFlowEdge` (`:748`) udostępnij/wytnij → L-03; Z-06 `viewState` (`:652`) wczytaj/usuń hardkod → L-03.

**EPIK 4 — Edge UX + swimlanes (P2, jeśli mirror NIE wycięty/po cut)** — orthogonal+waypoints+typy krawędzi; resize/collapse containers. → L-04.

**EPIK 5 — Środowiska** — migracja `20260603_v8_process_flow.sql` na staging **TYLKO jeśli mirror zostaje** (przy CUT — usunięcie). → L-05.

**EPIK 6 — Testy** — kontrakt ID lifecycle / brak call-site (lub regresja po cut) + E2E draw-connection + CI `Londyn`. → L-06.

## G · JAKOŚĆ / DoD *(skwantyfikowane grepem 2026-06-13)*
| # | Kryterium | Miara M07 |
|---|-----------|-----------|
| 1 | Front↔back | V8 mirror naprawiony (DELETE/GET działają, FK) LUB wycięty (0 martwych endpointów); AI Proposal realny LUB ukryty; 0 martwych przepływów |
| 2 | Bezpieczeństwo | WS org-scope (Org B→403) — **kod OK**, dodać test; HTTP V8 wzorcowe |
| 3 | i18n | **0 z 252** `isPolish`/inline (grep `processflow/`+`IdeaProcessFlowTool`) |
| 4 | Tokeny | **0 z 45** hex inline → Visual Standard |
| 5 | §27 | N.D. (canvas); **0** `<table>` — baner degradacji widoczny (naprawiony) |
| 6 | E2E w PR-gate | kontrakt ID / draw-connection zielone na `Londyn` |

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | → Luka |
|----|--------|------|--------|
| W-01 | Karta audytu §1-§7 | 2026-06-12 | L-01..06 |
| W-02 | **Uwagi żywe 2026-06-13** | 2026-06-13 | **BRAK wpisu Ideas — pula nietestowana żywo; dziedzicz z karty (R6 do domknięcia)** |
| W-03 | Re-audit karty (connectMode/auth = fałszywe alarmy; degradacja/walidacja naprawione) | 2026-06-12 | — (zamknięte) |
| W-04 | Kod (`processFlowService.ts`, `ideaCollabWs.gateway.ts`) | 2026-06-13 | weryfikacja R3 |

### 02 · Stan obecny (prawda kodu, R3 zweryfikowane 2026-06-13)
- **WS org-scope = REALNY:** `ideaCollabWs.gateway.ts:237-242` (wspólny z M06/M09) — **POTWIERDZONY.**
- **V8 mirror = ŻYWY P0:** asymetria ID klient↔serwer niezmieniona; jedyny realny żywy bloker M07 (re-audit potwierdza P0-A/P0-C były fałszywymi alarmami — naprawione).
- **Migracja `20260603_v8_process_flow.sql`:** w repo, runner manualny — [do weryfikacji: czy na staging/prod; zbędna jeśli mirror wycięty].

### 03 · Rejestr luk
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status |
|----|------|---------|--------------------|-------|------|--------|
| L-01 | V8 mirror ID mismatch (DELETE NOT_FOUND, GET martwy, wiszące krawędzie) | W-01,W-04 | `processFlowService.ts:390`, `IdeaProcessFlowTool.tsx:1008,1060,1383`; jedyny ext-konsument `my-work.routes.ts:36,6031-6089` (`develop` readback) | P0-B | 1 | otwarta — **D-01 → DP-7 rekom. CUT** (cut bezpieczny po przekierowaniu 1 call-site na blob) |
| L-02 | WS resource-auth gap | W-01 | `ideaCollabWs.gateway.ts:237-242` | P1 | 1 | **NAPRAWIONA (zweryf. w kodzie 2026-06-13)** — domknąć testem |
| L-03 | AI Proposal STUB; `MessageFlowEdge` martwy; `viewState` hardkod | W-01 | `processFlow.routes.ts:411-437`, `:748`, `:652` | INTEGR/P1/P2 | 3 | otwarta — **D-02** (Proposal) |
| L-04 | Edge UX (orthogonal/waypoints/typy) + swimlane containers | W-01 | edytor diagramów | P2 | 3 | otwarta |
| L-05 | Migracja V8 process_flow nie na staging | W-01,W-04 | `20260603_v8_process_flow.sql` | INTEGR | 1/5 | otwarta (zależna od D-01) |
| L-06 | Brak testu kontraktu ID / call-site + E2E + CI bez `Londyn` | W-01 | `tests/*` (brak) | P0-test | 1+4 | otwarta |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | V8 mirror | naprawić kontrakt ID (UUID→localId + GET /objects) / **wyciąć mirror** | Piotr | TBD | **DP-7 = WYTNIJ** (rekom.; M07 mirror = silny kandydat). Weryf.: 0 konsumentów M20/M22, 1 call-site `develop` do przekierowania na blob |
| D-02 | AI Proposal Panel (P14) | route z LLM generującym operations[] / ukryć | Piotr | TBD | otwarta (DP-5: ukryj za flagą jeśli nie v1-critical) |
| D-03 | Kontrakt `my_idea_maps` per-resource (DP-3) | single-player / shared+membership | Piotr | TBD | **DP-3 — M09 zmienia; WS gateway wspólny** |

### 05 · Flagi/rollout — beta Ideas; `ENABLE_V8_GLOBAL` (przy CUT/DP-7 — flaga i cała ścieżka V8 process-flow usunięte).
### 06 · Ryzyka — wycięcie V8 mirror upraszcza, ale jeśli inny moduł V8 (M20/M22) konsumuje te endpointy — koordynować. Migracja V8 zbędna przy wycięciu. Dev `.env` → Railway PROD; prod ~2026-05-18 (tabele v8_process_flow_* prawdopodobnie nie istnieją).
### 07 · Log — 2026-06-13: zweryfikowano L-02 (WS org-scope realny). Audyt 2026-06-12: 55/100 (P0-A/P0-C odrzucone jako fałszywe alarmy). Re-ocena po D-01 + sesji żywej (R6).

---

## Bramka teczki: 8/9 dokumentacyjnie
R1 ✅ · R2 ✅ · R3 statusy z dowodem (L-02 zweryfikowane; L-01 żywy z dowodem `plik:linia`) ✅ · R4 DoD z liczbami (252/45/0) ✅ · R5 decyzje z właścicielem ✅ · A-E ✅ · F epiki↔luki ✅ · G DoD+S+sec ✅ · **R6 sesja żywa NIEZALICZONA (pula nietestowana żywo) — W-02 puste.** **8/9.**
