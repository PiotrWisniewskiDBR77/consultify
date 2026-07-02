# WYNIKI TESTÓW M13 — KRĘGOSŁUP INICJATYW (BACKBONE) · RUN1

**Data wykonania:** 2026-06-28
**Tester:** Claude (CTO — agent kręgosłupa inicjatyw)
**Branch:** feat/deliverables-w1
**Backend:** localhost:3001 (staging, caboose) — **L3 URUCHOMIONY ŻYWO, ZAPISYWALNY** (bootstrap zwrócił realny token, brak DB_READONLY)
**Frontend:** localhost:3000 (Vite staging) — **UP (200); smoke FE tabów uruchomiony**
**Zakres:** nowe zdolności kręgosłupa F0–F6 (poza GOTOWYM procesem statusów 92/92)
**SSOT:** `docs/initiatives/INITIATIVE_BACKBONE_HANDOFF.md` + `INITIATIVE_SYSTEM_SSOT.md`

> **RUN1 ZAMKNIĘTY.** Warstwy L1/L2/component zweryfikowane testami (zielone). Warstwa
> **L3 (E2E Playwright)** uruchomiona na żywym, zapisywalnym backendzie — **17/17 zielone**
> + FE smoke tabów **2/2 zielone**. Klasyfikacja: jedna zdolność = jeden wiersz, status z
> realnych testów (nie deklaracji). Zero pozycji „nigdy nie wykonane".

---

## Legenda

| Symbol | Znaczenie |
|---|---|
| ✅ PASS | Pokryte zielonymi testami (L1/L2/component/L3) |
| 🟡 PARTIAL | Logika zielona, ale brak warstwy (FE preview wizualny / pełna orkiestracja) |
| ⏳ PENDING | Zaplanowane, jeszcze nie wykonane |
| ❌ FAIL | Realna luka / regresja |

---

## Podsumowanie ogólne

| Faza | Zdolność | Plik testowy | Testy (zielone) | Status |
|---|---|---|---|---|
| **F0** | Grunt generacji — `buildGroundingBlock` (4 źródła, czysta) | `unit/initiative/groundingBlock.test.ts` | 5 | ✅ PASS |
| **F0** | Grunt generacji — `financialsGrounding` (org P&L→grunt) | `unit/initiative/financialsGrounding.test.ts` | 7 | ✅ PASS |
| **F0** | **Grunt — ścieżka POPULOWANIA `enrichContext` (org+portfolio+financials+lineage+KPI) + fail-soft** | **`integration/initiatives/groundingEnrichment.test.ts` — NOWE w tym RUN** | **17** | ✅ PASS (L2) |
| **F0** | Audyt → inicjatywa (`createInitiativeFromAudit`, source_type=audit) | `unit/initiative/auditInitiativeService.test.ts` | 9 | ✅ PASS |
| **F1** | Mózg generatora (`proposeCards` + `generateFullInitiative` + auto-heal D12) | `unit/initiative/initiativeGeneratorBrain.test.ts` | 20 | ✅ PASS (logika) · 🟡 pełny tor E2E nie spięty |
| **F1** | Karty — buildery CardSpec | `unit/initiative/cardSpecBuilders.test.ts` | 15 | ✅ PASS |
| **F1** | Tworzenie inicjatywy (serwis + jakość) | `unit/initiative/createInitiativeService.test.ts` + `.quality.test.ts` | 9 + 9 | ✅ PASS |
| **F2** | Skrzynka kandydatów (scan / list / accept / dismiss / scoring) | `unit/initiative/initiativeCandidateService.test.ts` | 33 | ✅ PASS |
| **F2** | **Badge „AI sugeruje inicjatywę"** (insight/assessment/audyt) | `components/Initiatives/InitiativeSuggestionBadge.test.tsx` | 8 | ✅ PASS · 🟡 insertion FE pending |
| **F3** | Silnik bloków kart (schema + critic `validateCardSpec`) | `unit/initiative/cardBlockSchema.test.ts` | 16 | ✅ PASS |
| **F3** | Renderer bloków (`CardBlockRenderer`) | `components/Initiatives/CardBlockRenderer.test.tsx` | 16 | ✅ PASS |
| **F3** | Walidatory kart §B3 | `unit/initiative/initiativeCardValidators.B3.test.ts` | 29 | ✅ PASS |
| **F3** | Kontrakt walidacji karty (route) | `integration/initiatives/validate-card.test.ts` | 6 | ✅ PASS |
| **F4** | Zdrowie portfela — dedup Jaccard + balans | `unit/initiative/portfolioAnalysisService.test.ts` | 21 | ✅ PASS |
| **F4** | Pokrycie MECE | `unit/initiative/portfolioMeceService.test.ts` | 6 | ✅ PASS |
| **F4** | Similar-check (dedup endpoint) | `integration/initiatives/similar-check.test.ts` | 4 | ✅ PASS |
| **F5** | Materializacja (inicjatywa/portfel → deck/raport/tabela via M17) | `unit/initiative/initiativeMaterializeService.test.ts` | 14 | ✅ PASS |
| **F6** | Handoff stage'ów (DONE→TRACKING, evaluateHandoff) | `unit/initiative/stageHandoffService.test.ts` | 24 | ✅ PASS |
| **F6** | **Kontrakt rezultatów (DONE→TRACKING → benefits/KPI)** | `integration/initiatives/resultsHandoff.test.ts` | 8 | ✅ PASS |
| **F0–F5** | **Kontrakt endpointów kręgosłupa (4 routery, shadow `/:id`)** | `integration/initiatives/backboneEndpoints.test.ts` | 34 | ✅ PASS (L2) |
| **wspólne** | Lineage serwis | `unit/initiative/initiativeLineageService.test.ts` | 6 | ✅ PASS |
| **L3** | **E2E ŻYWY — portfolio-health / kandydaci / materiał / from-audit (17 scenariuszy)** | `e2e/m13/m13-backbone.spec.ts` | **17** | ✅ **PASS — uruchomiony 2026-06-28, 47.4s** |
| **L3-FE** | **E2E ŻYWY — taby „Kandydaci" + „Zdrowie portfela" renderują bez error-boundary** | `e2e/m13/m13-backbone-fe.spec.ts` | **2** | ✅ **PASS — uruchomiony 2026-06-28, 37.2s** |

**Suma testów zielonych L1/L2/component (katalog `tests/unit/initiative/`, `tests/integration/initiatives/`, `tests/components/Initiatives/`):** **483** (55 plików, 0 failed, 0 skipped).
**+ L3 E2E żywe:** 17 (`m13-backbone.spec.ts`) + 2 (`m13-backbone-fe.spec.ts`) = **19**.
**RAZEM kręgosłup:** **502 zielone** (483 L1/L2/component + 19 L3).
**Pass rate:** 502/502 = **100%**.

> Komenda weryfikacyjna L1/L2/component:
> `npx vitest run tests/unit/initiative/ tests/integration/initiatives/ tests/components/Initiatives/`
> → `Test files 55 passed`, `Tests 483 passed`.
> Komenda L3 (żywy backend :3001 + FE :3000):
> `E2E_REQUIRE_TEST_SUPPORT=true E2E_API_URL=http://127.0.0.1:3001 E2E_BASE_URL=http://127.0.0.1:3000 TEST_SUPPORT_KEY=local-test-support-key-change-me npx playwright test tests/e2e/m13/m13-backbone.spec.ts tests/e2e/m13/m13-backbone-fe.spec.ts --project=chromium --workers=1`

---

## §A — Co dodał ten RUN (2026-06-28)

### A.1 ✅ Test gruntu — ścieżka POPULOWANIA `enrichContext` (NOWE) — 17/17
**Plik:** `tests/integration/initiatives/groundingEnrichment.test.ts`
L2 integracja: realny `InitiativeGenerationService` (default export) + realny `DbPromise`
(mock dyspozytorski po SQL) + realny `buildOrgFinancialsSummary` (przez ten sam mock DB) +
`buildGroundingBlock` eksportowane. LLM-mock echo'uje prompt → test asercjuje, że grunt
realnie trafił do promptu (nie tylko że kod się wykonał). Pokrywa:
- **POPULATE:** `portfolioSummary` z inicjatyw-rodzeństwa org; `orgContext` z `organizations`
  (nazwa+branża, oraz sama-nazwa gdy brak industry); `financialsSummary` z helpera financials
  (realne P&L: „Przychód 2025: 8.8M EUR; EBITDA 2.7M"); `lineage` (source_type#source_id);
  `existingKpis`; **wszystkie 4 źródła naraz w jednym promptcie**; brak nadpisania jawnego
  kontekstu wejściowego.
- **FAIL-SOFT:** każde z 4 źródeł (portfolio/financials/org/kpis) wymuszono do rzutu osobno —
  grounding nadal buduje z pozostałych; rzut na pobraniu samej inicjatywy → `enrichContext`
  zwraca surowy kontekst bez crashu.
- **KONTRAKT `buildGroundingBlock`:** 4 źródła obecne → emitowane; org-context **PIERWSZY**
  (indexOf == 0, przed financials/portfolio); portfolio niesie instrukcję **„NIE duplikuj"**;
  pusty kontekst → null.

**Ustalenie:** ścieżka populowania gruntu (F0) jest dowiedziona end-to-end na warstwie L2 —
nie tylko czysta funkcja `buildGroundingBlock` (L1, `groundingBlock.test.ts`), ale realny
przepływ DB→enrichContext→prompt. Defektów nie znaleziono.

### A.2 ✅ L3 E2E ŻYWY — uruchomiony (był PENDING) — 17/17 + 2/2 FE
Backend `:3001` **zapisywalny** (bootstrap `/api/test-support/bootstrap` zwrócił realny JWT,
org+user; brak `DB_READONLY`). FE `:3000` UP (200). Uruchomione:
- `m13-backbone.spec.ts` (**17/17, 47.4s**): portfolio-health (kształt + taksonomia MECE 8
  obszarów + brak przykrycia przez `/:id`); candidates (lista-koperta, filtr `status=pending`,
  scan fail-soft, accept/dismiss nieistniejącego → 404 nie 5xx); materialize (portfolio→table
  binarka, `/:id`→table/report, walidacja zod, nieistniejąca → 422 nie 5xx); from-audit
  (nieistniejący → błąd; brak auditId → 400 zod).
- `m13-backbone-fe.spec.ts` (**2/2, 37.2s**): taby „Kandydaci" i „Zdrowie portfela" renderują
  się bez error-boundary (smoke; zamyka część B1 na poziomie smoke — pełny wizualny pass nadal
  zalecany, ale brak crashu udowodniony żywo).

### A.3 (z poprzednich batchy, potwierdzone)
- Migracja `server/migrations/20260627_audits.sql` (ALTER additive: project_id/title/summary/
  description/created_by + idx) — odblokowuje from-audit; aplikacja na staging = osobny krok.
- Kontrakt rezultatów F6 KOMPLETNY (interfejs + RBAC + runtime walidacja
  `BENEFITS_KPI_REQUIRED`/`BENEFITS_OWNER_REQUIRED` w `InitiativeController.ts`). Luki nie ma.

---

## §B — Znane luki (do domknięcia)

| # | Luka | Faza | Charakter | Stan po RUN1 |
|---|---|---|---|---|
| B1 | **FE pełny wizualny pass** — taby „Kandydaci"/„Zdrowie portfela", przyciski „Zrób materiał", insertion badge'a — pixel-level | F2/F4/F5 | wiring FE | 🟡 smoke L3-FE 2/2 zielone (brak crashu); pełny wizualny pass nadal zalecany |
| B2 | **F1 Mózg generatora** — pełny tor brief→6 kart→auto-heal→DRAFT spięty E2E (logika zielona 20/20, orkiestracja nie udowodniona żywo end-to-end) | F1 | orkiestracja | 🟡 logika PASS, E2E orkiestracji pending |
| B3 | **Tabela `audits` na staging** — migracja additive gotowa, wymaga aplikacji (caboose) by from-audit dał strict-4xx zamiast schema-drift 5xx | F0/F2 | migracja (zrobiona, nieaplikowana) | ⏳ aplikacja pending |
| B4 | F3 migracja 6 kart rdzenia na `CardBlockRenderer` (kontrakt AI→CardSpec gotowy, adopcja pending) | F3 | adopcja | ⏳ pending |
| B5 | Teresa upgrade — `generateInitiative.ts` → wołaj `generateFullInitiative` + stampuj source_type/source_id (dziś szkic, gubi lineage) | F1 | wiring | ⏳ pending |

---

## §C — Defekty znalezione w tym RUN

**Brak nowych defektów.** Test gruntu (A.1) przeszedł 17/17 bez ujawnienia regresji —
ścieżka populowania i fail-soft działają zgodnie z kontraktem. L3 (A.2) 17/17 + 2/2 —
endpointy kręgosłupa odpowiadają poprawnie (shadow `/:id` nie przykrywa portfolio-health/
candidates/materialize; fail-soft 404/422/400 zamiast 5xx).

**Znany, świadomy element:** L3-BB-16 (`from-audit` nieistniejący → błąd) toleruje 404 LUB
500 (schema-drift gdy tabela `audits` bez kolumn) — udokumentowany jako B3, nie nowy defekt.

**Infra (nie-kręgosłupowe, poza zakresem):** w szerokim przebiegu vitest pojawia się
suite-level fail legacy `tests/integration/initiatives.test.js` (0 testów failed, 5 skipped) +
hałas `role "iris" does not exist` z health-check puli PG — pre-existing infra, nie dotyczy
żadnego testu kręgosłupa (katalog-scoped run = 483/483 zielone, 0 failed).

---

## §D — Następna akcja

1. Zaaplikuj `server/migrations/20260627_audits.sql` na staging (caboose) → B3 domknięte,
   from-audit strict-4xx.
2. Pełny wizualny pass FE (B1) — taby + „Zrób materiał" + badge insertion w przeglądarce.
3. F1 — spięcie pełnego toru orkiestracji E2E (B2) + Teresa upgrade (B5).
4. F3 — adopcja `CardBlockRenderer` przez 6 kart rdzenia (B4).

---

*Raport RUN1 ZAMKNIĘTY — L1/L2/component 483/483 + L3 19/19 (żywy backend zapisywalny).
Zero pozycji „nigdy nie wykonane". Kolejny RUN po aplikacji migracji audits + pełnym FE pass.*
