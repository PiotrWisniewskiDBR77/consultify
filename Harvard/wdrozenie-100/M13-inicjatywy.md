# TECZKA M13 — Inicjatywy (wzorzec referencyjny, 100%)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu + `docs/product/INITIATIVE_*` + formuły) i dokłada brakujące ogniwa (Rejestr Wejść z uwagami żywymi · Rejestr Decyzji · DoD z liczbami). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md).

## 00 · Nagłówek
- **Moduł:** M13 Inicjatywy · **Pula:** core (kliencki: VTS/Apator/Elkomtech)
- **Ocena audytu:** 54/100 · **Status:** FAZA 2 · **Rozmiar:** M (rdzeń) + **L** (i18n ~1820×) · **Żywy bloker:** brak P0
- **Właściciel:** Piotr · **Daty:** karta 2026-06-12 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M13-inicjatywy/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md`
- **Kod:** `src/components/Initiatives/` · `server/src/routes/pmo/initiatives.routes.ts` · `server/src/services/stageGateService.ts` · `src/types/initiative.ts`

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + `INITIATIVE_GOVERNANCE_MODEL.md`, `…ENTRYPOINTS_*_V8.md` | job-to-be-done + zakres (niżej) |
| B UX docelowe | 🟢 | **`INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`** + karta §5 | link + delta #14 |
| C Dane+API+reguły | 🟢 | karta §1e/§1f + `initiative.ts` + `stageGateService.ts` + `…AUTOMATION_AND_TRANSITIONS.md` | maszyna stanów (niżej) |
| D AI/Teresa | 🟢 | `INITIATIVE_FORMULA.md` + `CARD_CONTENT_FORMULA.md` + `INITIATIVE_GENERATOR_*` | link + delta #16 |
| E Integracje | 🟢 | karta §1g | — |
| F Epiki | 🟢 | karta §7 (3 fale) | przeformułowane na epiki (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
Pełny model ról/wejść: `docs/product/INITIATIVE_GOVERNANCE_MODEL.md`, `…ENTRYPOINTS_AND_SOURCE_GOVERNANCE_V8.md`, `ROLES_MODEL.md`.
- **Job-to-be-done:** zamienić wnioski z diagnozy (wywiady/insighty) w zarządzalne inicjatywy — od pomysłu, przez kartę i bramki, po wdrożenie i rozliczenie wartości.
- **Persony/role:** efektywne role z backendu (`userRoles[]`): Owner/Sponsor, Portfolio Owner, Steering Committee, Project member, **Pilot VTS** (ograniczony), Admin. Vocab: `ROLES_MODEL.md`.
- **Zakres v1:** portfolio (4 widoki) · dokument (~30 sekcji) · charter/AI-wizard · generator z M10 · bramki+zatwierdzenia · ROI · archive · czat. **POZA v1:** symulacje portfela what-if, integracje Jira/Asana, wersjonowanie kart.
- **Metryka:** % inicjatyw draft→realizacja z kartą ≥90 (`CARD_CONTENT_FORMULA`); czas insight→inicjatywa.

## B · UX DOCELOWE *(SSOT istnieje — linkuj)*
**Kanon zachowania = `docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`** (statusy × role × CTA, edytowalność „6 pól", AI-per-status; backend SoT przez `GET /api/initiatives/:id/gate-readiness-check`). UI-stan obecny + odstępstwa §27: karta §5.
**Delta do zbudowania (#14):** ujawnić matrix w UI — pasek statusu jako pipeline + „next-gate", CTA per status×rola, properties-strip „6 pól" wg edytowalności z matrix. **To rekoncyliacja docs↔kod↔UI, nie greenfield.**

## C · DANE + API + REGUŁY *(link + maszyna stanów)*
- **Wiring FE↔BE↔DB:** karta §1e (kompletna tabela). **Flagi:** karta §1f.
- **Maszyna stanów (kanon, `src/types/initiative.ts` + matrix):** 13 statusów — `DRAFT · PENDING_REVIEW · REVIEW · PROMOTED · PLANNING · APPROVED · SCHEDULED · EXECUTING · BLOCKED · DONE · TRACKING · CANCELLED · ARCHIVED`. Happy path: `DRAFT→REVIEW→PROMOTED→PLANNING→APPROVED→SCHEDULED→EXECUTING→DONE→TRACKING`. Przejścia/bramki: `stageGateService.ts` (`GATE_CRITERIA`, `evaluateGate`, `getGateType`) + `…AUTOMATION_AND_TRANSITIONS.md`.
- **API (`pmo/initiatives.routes.ts`, `requireOrgRole('user')` + `validateBody` zod):** CRUD (`GET/POST /`, `GET/PUT/PATCH /:id`, `/by-status/:statuses`, `/:id/duplicate`); **bramki** (`GET /:id/readiness`, `GET /:id/gate-readiness-check`, `POST /:id/submit-review|approve|reject`); portfolio (`/portfolio[/rollups|/dependencies]`, `/capacity`); programy, szablony+WBS, section-types, generacja (`/generate-section`, `/readiness-analysis`, `/suggest-sections`), `/:id/apply-template|apply-blueprint`.
- **Sekcje dokumentu:** `src/components/Initiatives/sections/registry.ts` — `SECTION_REGISTRY` (Record<key,Component>) + `DEFAULT_SECTION_ORDER` + `DEFAULT_VISIBLE_SECTIONS` (~30 sekcji).

## D · AI / TERESA *(SSOT istnieje — linkuj)*
- **Formuła treści:** `docs/initiatives/INITIATIVE_FORMULA.md` (doktryna MECE/Kerzner/Kaplan-Norton/McKinsey) + `docs/standards/CARD_CONTENT_FORMULA.md`. Build/handoff generatora: `INITIATIVE_GENERATOR_BUILD.md`, `…HANDOFF.md`.
- **Co generuje:** propozycje z insightów (`generate_from_evidence`), uzupełnianie sekcji.
- **AI-per-status:** zgodnie z matrix (gdzie AI dozwolone). **Delta #16:** AI-fill każdej sekcji do standardu formuły (`initiativeGenerationService.ts`/`InitiativeDocumentView.tsx`).

## E · INTEGRACJE
Pełna tabela: karta §1g. Skrót: **←** M10 (Charter/`generate_from_evidence`, `InterviewHub.tsx:12955`), M01 (czat), M23/M03 (governance links). **→** M14 (realizacja), M15/M16 (ROI/economics `/api/economics/analyses`), M03 (kalendarz). **Kręgosłup:** generacja z czatu → Faza 0; in-context open (#10) → klaster nawigacyjny.

## F · EPIKI *(z karty §7, forma epików)*
- **EPIK 1 — Tworzenie z huba żyje:** New/Charter/Wizard (L-01) + gating pilota serwerowo (L-06). [karta §7 Fala 2.1–2.2]
- **EPIK 2 — System statusów/bramek (#14):** ujawnić STATUS_ROLE_CTA_MATRIX w UI (pipeline+next-gate+CTA per rola, gate-readiness-check) (L-03).
- **EPIK 3 — AI-fill wg formuły (#16):** sekcje ≥90 wg CARD_CONTENT_FORMULA (L-04).
- **EPIK 4 — Odporność:** baner degradacji V8 (L-05); bulk BE/ukrycie (L-02). [karta §7 Fala 2.3, 3.4]
- **EPIK 5 — Szlif kanonu:** i18n/§27/tokeny (L-11a/b/c) + E2E S2/S3/S5 do PR-gate. [karta §7 Fala 3.1–3.2, §2 backlog]
- **EPIK 6 (decyzja):** in-context open #10 — po D-01.

## G · JAKOŚĆ / DoD *(skwantyfikowane)*
| # | Kryterium | Miara M13 |
|---|-----------|-----------|
| 1 | Front↔back | New/Charter/Wizard tworzą (lub usunięte); bulk żywe/ukryte; 0 martwych CTA; statusy sterowalne wg matrix |
| 2 | Bezpieczeństwo | gating pilota serwerowy (403, test); governance org-scope ✅ `b9f2dee9d2` (potwierdzić testem cross-org) |
| 3 | i18n | 0 z **~1820** inline (`i18n.language==='pl'`/`isPolish`) — `InitiativeDocumentView.tsx` 423 + `sections/*` ~1000 |
| 4 | Tokeny | 0 z **13** hex (9 = graf `DependencyGraphCanvas.tsx`, potwierdzić) |
| 5 | §27 | **18** surowych `<table>` (13 plików) → FilterableTable; Portfolio resize+popover+kebab per status (karta §5) |
| 6 | E2E w PR-gate | S2 (deep-link create), S3 (edycja sekcji), S5 (Charter z M10) zielone na `Londyn` |

Scenariusze S1–S6 + pokrycie + pułapka CI: karta §0/§2. Bezpieczeństwo: karta §6.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | → Luka |
|----|--------|------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-12 | L-01,02,05,06,11 |
| W-02 | **Uwaga żywa #15** | 2026-06-13 | L-08 ✅ |
| W-03 | **Uwaga żywa #10** | 2026-06-13 | L-07 (D-01) |
| W-04 | **Uwaga żywa #14** | 2026-06-13 | L-03 |
| W-05 | **Uwaga żywa #16** | 2026-06-13 | L-04 |
| W-06 | `docs/product/INITIATIVE_*` (~15 dok.: STATUS_ROLE_CTA_MATRIX, GOVERNANCE_MODEL, AUTOMATION_AND_TRANSITIONS, ENTRYPOINTS, CAPABILITIES…) | — | B/C/D (kanon docelowy) |
| W-07 | `INITIATIVE_FORMULA.md` + `CARD_CONTENT_FORMULA.md` | — | L-04 |
| W-08 | Feedback prod (VTS pilot, `project_vts_card_audit`) | — | L-06; treść kart = poza M13 |

*(Korekta zaniżeń karty: „7 dok. INITIATIVE_*" → realnie ~15 w `docs/product/`+`docs/initiatives/`.)*

### 02 · Stan obecny — karta §1 (REALNE 12+2 · disabled 2 · ukryte 1 · martwe 1). Naprawione: `b9f2dee9d2` (governance), `ea77dc678c` (CRUD 5/5), `3aec45a21d` (Wizard CTA), `dc1dd6154d` (ROI nav), `2dbebfdd74` (ConflictsPanel usunięty), **`18ed3e44f7` (Otwórz CTA, 2026-06-13)**.

### 03 · Rejestr luk
| ID | Opis | Wejście | Dowód | Klasa | Faza | Status |
|----|------|---------|-------|-------|------|--------|
| L-01 | create-from-hub disabled | W-01 | `InitiativesHub.tsx:1985-1997,1943-1952,1953-1962` | P1 | 2 | **ZAMKNIĘTA 2026-06-16** — pilot dostaje locked CTA (grayed button + pilotAccessBlocked) zamiast undefined; server guard dopięty (L-06) |
| L-02 | bulk Tag/Due/Delete (brak BE) | W-01 | hub bulk-bar | P3 | 4 | **NAPRAWIONA — DP-5 zrealizowane: `showBulkStubActions = isInitiativesBulkStubEnabled()` (OFF default); Tag/ChangeDueDate ukryte (`InitiativesHub.tsx:1781,1808,1820`)** | 2026-06-16 |
| L-03 | system statusów/bramek/preview/menu (#14) | W-04,W-06 | `stageGateService.ts` + `STATUS_ROLE_CTA_MATRIX.md` + UI | P1-design | 2 | **W WIĘKSZOŚCI ZAMKNIĘTA — D-02 rozstrzygnięta (PEŁNY). Feature ~90% pre-built; slice C (`dd597dce0b`: G3 next-gate accuracy + G5 AI-per-status gating) domknięty. Odroczone slice B/D + Slice A (legacy-endpoint unifikacja) = behavior-change na żywych klientach, per-org rollout (patrz D-02). SSOT statusów POGODZONY `53daa3e227` (2026-06-17): enum 13 / `VALID_TRANSITIONS` / `GATE_PERMISSIONS` (14×role) / `GATE_TRANSITIONS` zgodne 1:1 FE `initiativeLifecycle.ts` ↔ serwer `initiativeStatuses.ts` ↔ docs; brak string-mismatch. 2 rozbieżności tylko-tekstowe, ZERO bug runtime (serwer `MODULES.initiatives`=5 NIEUŻYWANY; `getLifecycleOrder` BLOCKED/CANCELLED). Pozostaje OTWARTE: UI #14 (pipeline/CTA per status×rola) — design-blocked przez D-02** |
| L-04 | AI-fill wg formuły McKinsey (#16) | W-05,W-07 | `initiativeGenerationService.ts`, `InitiativeDocumentView.tsx` | P1-design | 2 | **ZAMKNIĘTA `2ffc02b101` — spięcie backend↔FE ZWERYFIKOWANE + ZABLOKOWANE TESTEM: `generateSectionContent` wstrzykuje doktrynę CARD_CONTENT_FORMULA (PL/EN) + per-sekcja guidance; `reviewSectionContent` PASS tylko score≥90, heurystyczny fallback FAIL na thin/empty; FE łapie `result.review` → chip `sectionReview`. Test `initiativeGenerationService.formula.test.ts` 5/5 PASS (LLM/DB mock). Breadth (withReview na więcej sekcji) = osobny tradeoff kosztowy/decyzja, NIE blokuje zamknięcia rdzenia #16. RDZEŃ ZBUDOWANY (zweryf. 2026-06-17 sub-agentem): backend `initiativeGenerationService` 100% (gen per-sekcja wg CARD_CONTENT_FORMULA + DOCTRINE prompt PL/EN + 12 sekcji guidance + adversarial `reviewSectionContent` score 0-100/PASS≥90/gaps/fixes + heurystyczny fallback); routes `/generate-section`,`/review-section`,`/suggest-sections`,`/readiness-analysis` guarded. FE: pętla pełna — `withReview:true` + `sectionReview` state + chip werdyktu (`InitiativeDocumentView.tsx:585,4256,7246`) DZIAŁA. Pozostała część (breadth): przyciski AI-fill na 7/34 sekcjach; rozszerzenie `withReview` poza finansowe = **świadomy tradeoff kosztowy** (komentarz :583-584 „keeping default generate path cheap" — dodatkowy LLM-call/sekcję) → decyzja produktowa + per-sekcja live-verify, NIE czysty bug-fix. Faza-4/decyzja Piotra (koszt vs pokrycie formuły)** |
| L-05 | cicha degradacja V8 bez banera | W-01 | chip V8 (vs Finance/Results) | P1 | 2 | **ZAMKNIĘTA** — `v8PlanningDegraded` state + Banner już w InitiativesHub.tsx:234,1979-1993 (L-05 comment in code) |
| L-06 | gating pilota tylko klient | W-01,W-08 | `createInitiative`/bulk/generator | P1 | 2 | **ZAMKNIĘTA 2026-06-16** — `requireInitiativeWriteAccess()` dodane do POST/PUT/DELETE `/api/initiatives` (initiatives.routes.ts); PMO routes i generator już miały guard |
| L-07 | in-context open (nawiguje do modułu) | W-03 | `MyWorkHub.tsx:1249,3193` | P1-design | 0.4 | **D-01 ROZSTRZYGNIĘTA→DP-2 (globalny dok IDE-tabs). IMPLEMENTACJA w `MyWorkHub.tsx` = STREFA HARVARD 2 (nie moja). Poza scope H3 — czeka na Harvard 2** |
| L-08 | brak CTA „Otwórz" board-preview | W-02 | `InitiativePreviewV3.tsx:399` | P1-TOP | — | **NAPRAWIONA `18ed3e44f7`** |
| L-09 | cross-org governance IDOR | W-01 | `initiativeGovernanceService` | P0 | — | **ZAMKNIĘTA — naprawa `b9f2dee9d2`; R3 test cross-org `be0dd36d88` (`initiativeGovernanceService.crossorg.test.ts`, 10/10 PASS: link/read/probe goals↔init↔decisions + evaluateGate odrzucają obcą org 404/[] bez mutacji; same-org positive control; queryHelpers mock = brak realnej DB)** |
| L-10 | 0 testów CRUD (stale import) | W-01 | `initiatives-crud.test.ts` | P0-test | — | naprawiona `ea77dc678c` |
| L-11a | i18n inline ~1820× | W-01 | `Initiatives/` (`InitiativeDocumentView` 423+`sections/*`) | P1 | 4 | **ZABLOKOWANA-i18n — konwersja `tr(en,pl)`→`t()` wymaga kluczy w `public/locales/*` = STREFA ZAKAZANA (round-2/3 git rule). Nie-bug (pełne PL+EN, DP-10). Czeka na zdjęcie zakazu locales przez Piotra LUB osobny agent translacji** |
| L-11b | 18 surowych `<table>` (§27)+RC-4 | W-01 | 13 plików `sections/*`,`Analysis/*` | P2 | 4 | **ZAMKNIĘTA `5ff719a12f` (§27 sweep, fan-out 2 sub-agentów + lider). ODKRYCIE: shared `FilterableTable` (poza strefą) NIE sortuje danych + brak expandable rows → migracja tabel z sortem/expand = REGRESJA. Reguła zero-regresji: `CompetencyRequirementsSection` (czysta, bez sort/expand) → ZMIGROWANA do FilterableTable (kolumny+render, filtr priority, delete via getRowActions, persistKey); 12 bogatych tabel (ResourcesSection ×4 z AI-menu+inline-add, Decisions, Tasks, Gates+expand, 4× Analysis z sort+expand, KPI) → KEPT-CUSTOM + §27 sticky-thead (FilterableTable by zgubił ich sort/expand/AI-menu na żywym core). tsc clean, 10 modułów kompiluje w Vite, zachowane behawiory. (Pełna unifikacja do FilterableTable wymaga dodania sortu do shared component = poza moją strefą.)** ZAKRES ZWERYFIKOWANY (sub-agent 2026-06-17): z 18 surowych `<table>` realnych §27-kandydatów = 13, reszta legalne (5: Timeline 2× baseline-vs-actual, GateReadiness msg, Dependencies 2× AI-proposal review-grid). 13 kandydatów: `InitiativeGatesWorkflowTable:749`, `InitiativeDocumentView:8013`(KPI), `ResourcesSection` 4× (:1905/2221/2536/2899 budget/team/tools/services), `CompetencyRequirementsSection:315`, `DecisionsSection:1341`, `TasksMilestonesSection:1268`, `Analysis/LogicAnalysis:1498`, `Analysis/FeasibilityAnalysis:703`, `Analysis/CompletenessAnalysis:900`, `Analysis/ResourcesAnalysis:638`. Wszystkie FUNKCJONUJĄ (własny sort/filter/expand) → migracja = duży refaktor na żywym core (VTS/Apator/Elkomtech) wymagający auth-live-verify per tabela = dedykowany Faza-4 sweep, NIE na ślepo** |
| L-11c | 13 hex (9=graf) | W-01 | `DependencyGraphCanvas.tsx` i in. | P2 | 4 | **W WIĘKSZOŚCI LEGIT (zweryf. 2026-06-17): 9× `DependencyGraphCanvas.tsx` = paleta severity data-viz (CRITICAL/HIGH/MEDIUM/LOW) + SVG stroke/fill/Background — konwencjonalnie twarde; 3× `InitiativeDocumentView.tsx:10506-10526` = off-screen printable container dla `exportReportToPDF` (tokeny/CSS-vars NIE resolvują w przechwyconym DOM — MUSZĄ być twarde); 1× `InitiativeWizardModal.tsx:2484` `#8b5cf6` = INTENCJONALNY per-wizard accent (komentarz + `eslint-disable no-restricted-syntax`: initiative=violet vs insight=blue vs survey=emerald). Brak realnego hardkodu-do-tokenizacji → faktycznie FALSE-POSITIVE. (Ew. ujednolicenie palety severity do tokenów = osobna decyzja design-system, nie luka)** |
| L-12 | governance router org-spoofable (`/api/initiatives-v4`) | W-01 | `Gateway.ts:906` | P1 | 1 | **FAŁSZYWY ALARM** — `requireUser()` czyta `req.user?.organizationId` z JWT (verifyToken), nie z req-params; nie można podszyć |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | #10 in-context open w MyWork: jak? | drawer / karta w widoku / dynamiczna zakładka | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTE → DP-2: globalny dok IDE-tabs** (inicjatywa in-context; deck/doc→Canvas; ciężkie→pełny moduł) |
| D-02 | #14 zakres systemu statusów v1 | pełny pipeline+egzekucja / minimalny preview | Piotr | 2026-06-17 | **ROZSTRZYGNIĘTA = PEŁNY pipeline+egzekucja.** Stan: feature ~90% już zbudowany (pipeline bar `InitiativeStatusPipeline`, CTA per status×rola via `availableTransitions.canCurrentUserExecute`, properties-strip 6 pól, hard-enforcement na `PATCH /:id/status`). Slice C zamknięty `dd597dce0b` (G3 next-gate accuracy + G5 AI gating per status). **Odroczone (behavior-change na żywych klientach — wymagają cross-role preview + per-org rollout): G2 (gate-table execute-CTA), G4 (readiness SSOT z backendu), Slice A/G1 (unifikacja legacy `submit-review`/`approve`/`reject` → kanoniczny silnik; audyt callerów + telemetria + 410/per-org soft-launch).** |
| D-03 | bulk Tag/Due/Delete | dopiąć BE / ukryć | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTE → DP-5: ukryj stub za flagą + label** (bulk bez BE — nie półbuduj) |

### 05 · Flagi/rollout — V8 Planning (env, degraduje); pilot VTS (rola, gating→serwer); beta core (otwarty); demo Atelier Toys (jawny toggle).
### 06 · Ryzyka — SSOT statusów (~15 dok.) może być rozjechany z `stageGateService.ts` → #14 najpierw pogodzić docs↔kod. Governance IDOR (`b9f2dee9d2`) wymaga testu cross-org. Dev `.env` → Railway PROD.
### 07 · Log
- **2026-06-17 (Harvard 3, runda 3): §27 sweep + L-04 zamknięte.** Fan-out 2 sub-agentów (rozłączne pliki) + lider. **L-11b ZAMKNIĘTA `5ff719a12f`**: odkryto że shared FilterableTable nie sortuje + brak expand → reguła zero-regresji; `CompetencyRequirements`→FilterableTable, 12 bogatych tabel→§27 sticky-thead (migracja by zregresowała sort/expand/AI-menu na żywym core; pełna unifikacja wymaga sortu w shared component = poza strefą). **L-04 ZAMKNIĘTA `2ffc02b101`**: spięcie #16 AI-fill↔formuła zweryfikowane + test 5/5. **L-07** → DP-2, implementacja w MyWork (Harvard 2). **L-11a** → ZABLOKOWANA-i18n (locales). tsc clean, 10 modułów Vite-OK. Pozostają tylko: L-04-breadth (decyzja kosztowa), L-07 (H2), L-11a (i18n locales).
- **2026-06-17 (Harvard 3): L-09 R3 + L-03 SSOT reconciliation.** L-09: dopisany test cross-org IDOR `be0dd36d88` (10/10). L-03: pełna reconciliation SSOT statusów (subagent extract 7 źródeł + weryfikacja kodu) → enum/transitions/gate-perms/gate-transitions zgodne 1:1 FE↔serwer↔docs; 2 rozbieżności tekstowe nie-runtime (serwer `MODULES.initiatives` nieużywany — adnotacja `53daa3e227`; `getLifecycleOrder` BLOCKED/CANCELLED). UI #14 nadal design-blocked (D-02). Agent-flagged „KPI-validation/auto-start cron" = poza ekstraktem, należą do L-04/#14 (design-blocked) — nie potwierdzone jako luki. Pozostają OTWARTE design-blocked: L-03(UI #14)/L-04(#16). L-07 in-context open = strefa MyWork (Harvard 2). Faza-4 sweep: L-11a/b/c (i18n/§27/hex).
- 2026-06-16: L-01+L-05+L-06 zamknięte (EPIK 1 gotowy). 2026-06-13: L-08 (`18ed3e44f7`). Audyt 2026-06-11/12: L-09/L-10 naprawione; ocena 54/100. Re-ocena D po Fazie 2/4.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta+15 dok.+4 uwagi żywe) · R2 zero sierot (wejście→luka→DoD) · R3 statusy z dowodem (L-08/09/10 z commitami) · R4 DoD z liczbami · R5 decyzje z właścicielem (**D-01 ROZSTRZYGNIĘTE → DP-2; D-03 → DP-5**; D-02 modułowa #14 TBD) · A–E docelowy zlinkowany · F epiki↔luki · G DoD+S+sec · R6 sesja żywa = Faza 4 (zaplanowana). **Teczka kompletna do egzekucji.**
