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

## B · UX DOCELOWE *(karta §5 + delty)*
- **Layout:** kanwa procesu + toolbar + properties panel + health-score.
- **Stany:** baner degradacji V8 (`useProcessFlowDegraded`) — **naprawiony** (karta); walidacja (`useProcessFlowValidation`) — naprawiona.
- **§27 N.D.** (canvas).
- **Delty Edge UX:** routing ortogonalny + waypointy + typy krawędzi (message/sequence/conditional); prawdziwe swimlane containers (resize/collapse/poole pionowe).

## C · DANE + API + REGUŁY *(link + V8)*
- **Blob-sync (DZIAŁA):** optimistic-lock przez wspólny `useIdeaMapSync` (`IdeaProcessFlowTool.tsx:530-536`), org+user-scope.
- **V8 mirror (ZEPSUTY — P0-B):** `processFlowService.ts:390` generuje serwerowe UUID; klient `void pfCrud.createNode` (`:1060`) odrzuca odpowiedź → `DELETE nodes/:id` (`:1383`) zawsze NOT_FOUND; `createEdge` (`:1008`) zapisuje klienckie ID bez FK → wiszące referencje; `GET /:id/objects` bez call-site → graf nigdy nie odczytywany z mirror.
- **WS collab:** `ideaCollabWs.gateway.ts:237-242` — org-scope DB-check + 403 (WSPÓLNY z M06/M09, **zweryfikowany jako naprawiony**).

## D · AI / TERESA *(link + delty)*
- **Co generuje:** AI Coach/Summary/Savings (`ideaAIGeneratorService.ts:1160-1172`, `callStructured` + Zod) — realny LLM.
- **Delta:** AI Proposal Panel (P14) = STUB in-memory (`processFlow.routes.ts:411-437` ignoruje `{prompt}`, oczekuje gotowych `operations[]`, brak LLM) → route z LLM ALBO ukrycie.

## E · INTEGRACJE *(karta §1g + zależności)*
- **←** lista idei. **→** eksport prezentacji `/api/presentations/decks` (M19).
- **Kręgosłup:** **WS gateway WSPÓLNY z M06 i M09** (jeden fix org-scope, zweryfikowany); blob-sync `useIdeaMapSync` wspólny z M05/M06/M08/M09.
- **Zależności blokujące:** decyzja V8 mirror dotyka flagi `ENABLE_V8_GLOBAL` — uzgodnić z M20/M22 (ekosystem V8).

## F · EPIKI *(z karty §7)*
- **EPIK 1 — V8 mirror (P0-B):** naprawić kontrakt ID (serwer UUID→localId + `GET /objects` przy hydratacji) ALBO wyciąć mirror (zostaw blob) (L-01).
- **EPIK 2 — WS org-scope (P1, wspólny):** cross-org→403 + test (L-02) — **kod naprawiony.**
- **EPIK 3 — Fasady/długi:** AI Proposal realny lub ukryty; `MessageFlowEdge` udostępnij/wytnij; `viewState` wczytaj/usuń (L-03).
- **EPIK 4 — Edge UX + swimlanes:** orthogonal+waypoints+typy; containers (L-04).
- **EPIK 5 — Środowiska:** migracja `20260603_v8_process_flow.sql` na staging (jeśli mirror zostaje) (L-05).
- **EPIK 6 — Testy:** kontrakt ID lifecycle / brak call-site + E2E + CI `Londyn` (L-06).

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
| L-01 | V8 mirror ID mismatch (DELETE NOT_FOUND, GET martwy, wiszące krawędzie) | W-01,W-04 | `processFlowService.ts:390`, `IdeaProcessFlowTool.tsx:1008,1060,1383` | P0-B | 1 | otwarta — **D-01** |
| L-02 | WS resource-auth gap | W-01 | `ideaCollabWs.gateway.ts:237-242` | P1 | 1 | **NAPRAWIONA (zweryf. w kodzie 2026-06-13)** — domknąć testem |
| L-03 | AI Proposal STUB; `MessageFlowEdge` martwy; `viewState` hardkod | W-01 | `processFlow.routes.ts:411-437`, `:748`, `:652` | INTEGR/P1/P2 | 3 | otwarta — **D-02** (Proposal) |
| L-04 | Edge UX (orthogonal/waypoints/typy) + swimlane containers | W-01 | edytor diagramów | P2 | 3 | otwarta |
| L-05 | Migracja V8 process_flow nie na staging | W-01,W-04 | `20260603_v8_process_flow.sql` | INTEGR | 1/5 | otwarta (zależna od D-01) |
| L-06 | Brak testu kontraktu ID / call-site + E2E + CI bez `Londyn` | W-01 | `tests/*` (brak) | P0-test | 1+4 | otwarta |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | V8 mirror | naprawić kontrakt ID (UUID→localId + GET /objects) / **wyciąć mirror (rekomendacja — mniej dual-stacku)** | Piotr | TBD | otwarta |
| D-02 | AI Proposal Panel (P14) | route z LLM generującym operations[] / ukryć | Piotr | TBD | otwarta |

### 05 · Flagi/rollout — beta Ideas; `ENABLE_V8_GLOBAL` (zależna od D-01).
### 06 · Ryzyka — wycięcie V8 mirror upraszcza, ale jeśli inny moduł V8 (M20/M22) konsumuje te endpointy — koordynować. Migracja V8 zbędna przy wycięciu. Dev `.env` → Railway PROD; prod ~2026-05-18 (tabele v8_process_flow_* prawdopodobnie nie istnieją).
### 07 · Log — 2026-06-13: zweryfikowano L-02 (WS org-scope realny). Audyt 2026-06-12: 55/100 (P0-A/P0-C odrzucone jako fałszywe alarmy). Re-ocena po D-01 + sesji żywej (R6).

---

## Bramka teczki: 8/9 dokumentacyjnie
R1 ✅ · R2 ✅ · R3 statusy z dowodem (L-02 zweryfikowane; L-01 żywy z dowodem `plik:linia`) ✅ · R4 DoD z liczbami (252/45/0) ✅ · R5 decyzje z właścicielem ✅ · A-E ✅ · F epiki↔luki ✅ · G DoD+S+sec ✅ · **R6 sesja żywa NIEZALICZONA (pula nietestowana żywo) — W-02 puste.** **8/9.**
