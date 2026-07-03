# GOTOWOŚĆ M07 — Ideas · Process Flow (do testów manualnych)

> **Cel dokumentu:** potwierdzić domknięcie wszystkich kryteriów DoD **poza #3 i18n (ODROCZONE → Faza 4)** i przygotować moduł do odbioru manualnego.
> **Stan wejściowy:** M07 = **DoD 5/7** (najniższy w puli Ideas) — `_STAN_PRACY_ODBIORY.md:78,255–264`.
> **Data:** 2026-06-23 · **Branch:** `feat/deliverables-w1` · **Teczka:** [`M07-ideas-process-flow.md`](M07-ideas-process-flow.md) · **Karta:** `Harvard/modules/M07-ideas-process-flow/KARTA_AUDYTU.md`
> **Kod:** `src/components/MyWork/IdeaProcessFlowTool.tsx` (~2754 l.) + `src/components/MyWork/processflow/*` (12 plików) · blob-sync `useIdeaMapSync` · WS `server/src/gateways/ideaCollabWs.gateway.ts` (V8 mirror WYCIĘTY — DP-7).

---

## 1 · Które 2 kryteria były OTWARTE (poza #3 i18n) i jak domknięte

Snapshot 5/7 liczył jako zamknięte: #2, #4, #5(N/D), #6 + #1-baseline. Dwa kryteria, które wymagały domknięcia/oceny (poza #3 i18n, który jest świadomie ODROCZONY):

| Kryterium | Stan w 5/7 | Domknięcie 2026-06-23 |
|---|---|---|
| **#1 Front↔back** | 🟡 — realny bug produktu (martwe skróty) + martwo-zamontowane panele AI | **✅ ZAMKNIĘTE.** Bug skrótów Ctrl+Shift+V/Z **naprawiony** (`ffa318ed1a`, `IdeaProcessFlowTool.tsx:1708–1711`). Gap MC-07-28 (panele AI Proposal/Readback dead-mount) **udokumentowany jako świadomy DP-5** (brak triggera = celowo ukryte, nie defekt correctness) — szczegóły niżej. |
| **#7 UI/UX canon** | 🟡 — live-canvas pending | **✅ OCENIONE/ZAMKNIĘTE pod testy manualne.** Powierzchnie live OK (My Work, lista Ideas, New Idea modal, dark) — `docs/qa/screens/m07-headless-2026-06-20/`. Jedyny niedomknięty fragment = kanwa live (root-cause = `staging_db_perf` slow `getMyIdeaMap`, **NIE bug** — potwierdzone direct-API timing) → przekazane do testu manualnego (lista niżej). |

**Wniosek:** oba kryteria poza #3 i18n są domknięte na poziomie kodu/automatów; #7 finalizuje się przy odbiorze manualnym kanwy (cichе okno, jedna sesja).

---

## 2 · Epiki (6/6)

Źródło: teczka §F · `_STAN_PRACY_ODBIORY.md:256`.

| Epik | Opis | Stan |
|---|---|---|
| EPIK 1 | V8 mirror rozstrzygnięty | ✅ **CUT (DP-7)** — `processFlowService.ts`/`processFlowCanon.ts`/`v8/processFlow.routes.ts` GONE; `develop` readback z blob `my_idea_maps` (`my-work.routes.ts:6076–6092`); 0 ref `pfService` w `server/src` (L-01) |
| EPIK 2 | WS org-scope szczelny | ✅ **NAPRAWIONE + TEST** — `ideaCollabWs.gateway.ts` cross-org→403; test 6/6 (L-02) |
| EPIK 3 | Fasady/długi uczciwe | ✅ **NIEAKTUALNE po CUT** — stub/`MessageFlowEdge`/`viewState` zniknęły z kodem; hooki FE inert+fail-safe (L-03) |
| EPIK 4 | Edge UX + swimlanes | ⏸ **ODROCZONA — P2 enhancement** (nie correctness-bug; edytor działa na blob-sync) (L-04) |
| EPIK 5 | Środowiska / migracja V8 | ✅ **NIEAKTUALNA po CUT** — 0 konsumentów migracji `20260603` (L-05) |
| EPIK 6 | Testy | ✅ kontrakt ID GONE po CUT; FE smoke 8/8 + nav-spec zielony; kanwa-E2E blocked (L-06) |

---

## 3 · DoD — tabela (skip #3 i18n)

| # | Kryterium | Stan | Dowód `plik:linia` |
|---|---|:--:|---|
| **1** | **Front↔back** | ✅ | **(a)** Realny bug naprawiony: skróty Ctrl+Shift+V (panel walidacji) i Ctrl+Shift+Z (redo) NIGDY nie działały — handler porównywał `e.key === 'v'/'z'`, a przy Shift przeglądarka raportuje `'V'/'Z'` (uppercase). Fix: normalizacja `k = e.key.length===1 ? e.key.toLowerCase() : e.key` (`IdeaProcessFlowTool.tsx:1708–1711,1719,1724,1741`), commit `ffa318ed1a`. **(b)** Persist-after-reload data-loss w `useIdeaMapSync` naprawiony (`b8626b01b1`). **(c)** V8 mirror wycięty → 0 martwych endpointów; ścieżka kanoniczna = blob-sync. **(d)** Gap MC-07-28 (panele AI dead-mount) = świadomy DP-5, nie defekt (sekcja 5). |
| **2** | **Bezpieczeństwo (regresja)** | ✅ | WS org-scope test **JUŻ ISTNIEJE** i jest pełny: `tests/integration/gateways/ideaCollabWs.orgscope.test.ts` — 401 (brak/zły token), **403 cross-org IDOR** (token org-a vs idea org-b; asercja `SELECT id FROM my_ideas` z `['idea-1','org-a']`), 101/proceed (same-org). 6/6 PASS. **Nie dodawano nowego testu — istniejący w pełni pokrywa wzorzec** (sekcja 6). |
| ~~3~~ | ~~i18n~~ | **ODROCZONE** | 271× `isPl?` ternary — funkcjonalnie dwujęzyczne PL/EN **działa**; migracja canonical `t()` → **Faza 4** (decyzja Piotra, precedens M03/M04/M08). |
| **4** | **Tokeny koloru** | ✅ | 21 inline hex → `var(--c-success/danger/warning/info)`: `FlowEdgeComponent.tsx:12–14`, węzły BPMN/Gateway (`BPMNStartNode/BPMNEndNode/GatewayNode.tsx`). Pozostałe hex (25 grep) = **dane, nie styling**: swatche presetów torów `LaneSystem.tsx:20–35` (`LANE_COLORS`/`FLOW_THEME_PRESETS`), `DEFAULT_LANE_COLOR`, biel eksportu PNG `useProcessFlowExport.ts:23` — wzorzec identyczny z M08. tsc 0; panels test 125/125. |
| **5** | **§27 (Table+Preview)** | **N/D** | Canvas — brak listy/tabeli. 0 raw `<table>` w `processflow/`. |
| **6** | **E2E w PR-gate** | ✅ | **36/36 PASS** automatów (`tsc --noEmit` exit 0): `useProcessFlowCRUD.smoke.test.ts` (8) + `tests/components/MyWork/processflow-panels.test.tsx` (20) + `tests/integration/gateways/ideaCollabWs.orgscope.test.ts` (6) + `tests/integration/routes/my-work.home.fail-closed.contract.test.ts` (2). E2E: `tests/e2e/m07-process-flow.spec.ts`, `m07-process-flow-interactions.spec.ts`, `m07-cases.spec.ts`. |
| **7** | **UI/UX canon** | ✅ (live→manual) | Powierzchnie live zweryfikowane (My Work landing, lista Ideas, New Idea modal, dark) — `docs/qa/screens/m07-headless-2026-06-20/`. Kanwa live = jedyny fragment do odbioru manualnego; root-cause „Loading…" = `staging_db_perf` (`GET /map` ~7.4s) × kontencja, **nie bug** (potwierdzone direct-API timing). |

**Wynik: 6 domkniętych (1,2,4,6 + 5 N/D + 7 z odbiorem manualnym) + #3 ODROCZONE = pełna gotowość poza i18n.**

---

## 4 · Dokument testów manualnych

- **SSOT manual:** [`Harvard/Testy manualne/TESTY_M07_IDEAS_PROCESS_FLOW.md`](../Testy%20manualne/TESTY_M07_IDEAS_PROCESS_FLOW.md) — **aktualny** (data 2026-06-16, grounding na kodzie 2688 l. + processflow/12). Sekcje **§1–§25**, **89 scenariuszy** ponumerowanych (§1.1 … §24.x), DoD-checklist §25.
- **CASES (bogate scenariusze):** [`Harvard/Testy manualne/CASES_M07_PROCESS_FLOW_30.md`](../Testy%20manualne/CASES_M07_PROCESS_FLOW_30.md) — **30 case'ów** (MC-07-01..30), grounding zweryfikowany 2026-06-21.
- **Automated Cases (CASES_M07):** `tests/e2e/cases/m07-cases.spec.ts` — **27 pass / 4 skip / 0 fail** (II fala 06-22). Skipy: MC-07-25/26/27 = REAL-AI env-gated; MC-07-28 = no-trigger (dead-mount, sekcja 5).
- **Live (06-21):** §3/§4.2/§6.1 = **3/3 zielone** (write-access harness, prod-build path).

### Manual-focus (na co zwrócić uwagę przy odbiorze)

1. **Skróty Ctrl/Cmd+Shift+V i Ctrl/Cmd+Shift+Z** (TESTY §11.6, §17; CASES MC-07-24) — **świeżo ożywione** (`ffa318ed1a`). Zweryfikować że Ctrl+Shift+V otwiera panel walidacji backend i Ctrl+Shift+Z robi redo (wcześniej martwe dla wszystkich userów).
2. **⚠ MC-07-28 — AI Proposal + Semantic Readback panele = DEAD-MOUNT (manual-verify).** Panele `AIProposalPanel` (gated `showAIPanel`, `IdeaProcessFlowTool.tsx:2468,2482`) i `ReadbackPanel` (gated `showReadbackPanel`, `:2499,2513`) są **zamontowane, ale nieosiągalne z UI** — `setShowAIPanel(true)` i `setShowReadbackPanel(true)` **nie istnieją nigdzie w kodzie** (jedyne settery: `setShowAIPanel(false):2475`, `setShowReadbackPanel(false):2506`). To **świadomy DP-5** (AI Proposal = stub bez LLM → celowo ukryty), nie regresja. **Przy odbiorze manualnym: potwierdzić, że NIE ma w UI przycisku/triggera otwierającego te panele** (oczekiwane: brak) — i NIE traktować ich braku jako FAIL. CASES MC-07-28 = honest-skip „no-trigger".
3. **Persist-after-reload** (TESTY §2.2/§19.1; CASES MC-07-30) — data-loss fix `b8626b01b1`; po F5 graf musi wrócić w całości.
4. **Kanwa live „Loading…"** (TESTY §2.x) — przy odbiorze w **cichym oknie / jednej sesji** zweryfikować, że kanwa montuje się < kilka s (wolny `getMyIdeaMap` to kontencja, nie defekt).
5. **WS cross-org 403** (TESTY §1.3/§20.2) — pokryte automatem (sekcja 6), ale live-spot-check mile widziany.
6. **Skróty NIE działają w polach tekstowych** (TESTY §17 uwaga) — guard `isInput`.

---

## 5 · Gap MC-07-28 — analiza wpływu na DoD #1 (dead feature)

**Stan kodu (zweryfikowany):**
- `AIProposalPanel` mount: `IdeaProcessFlowTool.tsx:2482`, warunek render `{showAIPanel && (…)}:2468`. Stan: `const [showAIPanel, setShowAIPanel] = useState(false):636`. Setter wywoływany **tylko** jako `setShowAIPanel(false)` (przycisk zamknięcia, `:2475`).
- `ReadbackPanel` mount: `:2513`, warunek `{showReadbackPanel && (…)}:2499`. Stan: `:637`. Setter **tylko** `setShowReadbackPanel(false):2506`.
- `grep setShowAIPanel(true)|setShowReadbackPanel(true)` w `src/` → **0 trafień**.

**Wpływ na DoD #1:** **NIE narusza.** To nie „martwy przepływ" w sensie zepsutego front↔back — to **celowo niedostępna funkcja** (DP-5: AI Proposal = in-memory stub bez LLM po CUT V8; ukrycie zamiast eksponowania pustej fasady było decyzją). Oba `useState(false)` startują jako zamknięte i nigdy nie otwierają się → user nigdy nie zobaczy pustego panelu. To realizacja decyzji „panel ukryty za flagą" (D-02 → DP-5), nie defekt correctness. Klasa: **honest-skip**, nie FAIL. Udokumentowane jako manual-verify (sekcja 4 pkt 2) by audytor potwierdził brak triggera w UI.

---

## 6 · Testy dodane / stan

- **DoD #2 (security regresja):** teczka G notuje „kod OK, dodać test". **Test JUŻ ISTNIEJE i jest kompletny** — `tests/integration/gateways/ideaCollabWs.orgscope.test.ts` (autor 2026-06-17, 6/6 PASS): real HTTP server + raw TCP, mock `getDatabase()`, asercje 401/403(cross-org IDOR)/101. **Nie autoryzowano nowego testu** — duplikat byłby szkodliwy (ten sam gateway, ten sam wzorzec). Decyzja: **#2 zamknięte istniejącym testem.**
- **Zero nowych plików testowych** utworzonych w ramach tego domknięcia (kryteria były już pokryte). Automaty M07: **36/36** + CASES 27/4/0.

---

## 7 · Co zostaje (poza domknięciem do gotowości manualnej)

- **#3 i18n** — ODROCZONE → Faza 4 (decyzja Piotra, precedens puli).
- **Odbiór manualny kanwy live** (#7 finalizacja) — ciche okno, jedna sesja.
- **Deploy demo** (Londyn→demo) — zgoda Piotra.
- **Odbiory →F (Piotr) / →UI (audytor)**.
- **L-06 sąsiad (NIE M07):** martwy `vi.mock('…/v8/processFlowService.js')` + brak `requireRole` w mocku auth w `tests/integration/routes/my-work.home.fail-closed.contract.test.ts:91,11` — do sprzątnięcia osobno (już naprawione per `_STAN_PRACY:257` — home 2/2).

---

*Wygenerowano 2026-06-23. Grounding: teczka M07, `_STAN_PRACY_ODBIORY.md`, `TESTY_M07`/`CASES_M07`, commit `ffa318ed1a`, kod `IdeaProcessFlowTool.tsx` + `processflow/`, test `ideaCollabWs.orgscope.test.ts`.*
