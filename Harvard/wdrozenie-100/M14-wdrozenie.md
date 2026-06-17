# TECZKA M14 — Wdrożenie (Execution) · pełna teczka reuse-first (głębia M13)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu §1–§7 + evidence) i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami · F epiki→stories Gherkin→L-xx). **Brak uwag żywych dla M14** — dziedziczy z karty (jawnie w H/01 i §07). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja głębi: [`M13-inicjatywy.md`](M13-inicjatywy.md) · decyzje przekrojowe: [`_DECYZJE.md`](_DECYZJE.md).

## 00 · Nagłówek
- **Moduł:** M14 Wdrożenie/Execution (dashboard · portfel · Action Queue/RAID · Rollout · raporty · Manager) · **Pula:** core — najsolidniejszy rdzeń z modułów core
- **Ocena audytu:** 52/100 · **Status:** FAZA 2 → FAZA 4 (sweepy: §27 Rollout + i18n PL) · **Rozmiar:** L (5 tabel Rollout→FilterableTable, ~141 kluczy i18n PL)
- **Żywy bloker:** brak otwartych P0 (P0 cross-org NAPRAWIONE) · **Brak uwag żywych** w `Harvard/UWAGI_TESTY_2026-06-13.md`
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M14-wdrozenie/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md`
- **Kod:** `src/components/Execution/` (ExecutionHub, ExecutionInitiativesKanbanView, RolloutTab, RegisterTable, PeopleChangeWorkspace) · `server/src/routes/pmo/execution.routes.ts` (5 verbs) · `server/src/controllers/ExecutionController.ts` · `server/src/routes/rollout.routes.ts` (17 verbs) · migracja `20260608_rollout_tables.sql` · `server/src/services/reportContentGenerator.ts` · `executionBudgetService.ts`

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 (7 scenariuszy) | job-to-be-done + zakres + metryka (niżej) |
| B UX docelowe | 🟢 | karta §5 (§27 Portfel/Raporty/5×Rollout/Manager) | delta degradacja V8 + §27 Rollout (niżej) |
| C Dane+API+reguły | 🟢 | karta §1e (wiring) + §1f (flagi) | maszyna Rollout + API 5 tabel enumerowane (niżej) |
| D AI/Teresa | 🟢 | `reportContentGenerator.ts` (live-data) + handoff czatu | granica AI (n.d. CARD_FORMULA — reuse dok. M13) |
| E Integracje | 🟢 | karta §1g | delta feed-forward M14→M15 (DP-6, niżej) |
| F Epiki | 🟢 | karta §7 (3 fale) | **epiki→stories Gherkin→L-xx (niżej)** |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby grep 2026-06-13** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji + DP-6/8/9** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
- **Job-to-be-done:** prowadzić wdrożenie portfela inicjatyw — od executive dashboardu (Health Score), przez kanban/timeline egzekucji, Action Queue/RAID/decyzje, rollout (Plan/KPI/Risks/Change/Closure), po raporty z live-data. Domknięcie pętli M13→M14→M15: inicjatywa zatwierdzona → realizowana → rozliczona wartością.
- **Persony/role:** PMO/portfolio owner (pełny CRUD), manager (people_change lanes — wymaga `ENABLE_V8_GLOBAL`), Steering (read+approve), pilot VTS (gating dziś tylko UI `readOnly`, L-01 — serwer przepuszcza). Core otwarty (beta-gating NIE).
- **Zakres v1:** dashboard Health Score (z DB, nie fabrykowany ✅ `84757dc672`) · 3 widoki portfela + kanban DnD · Action Queue/RAID/Decisions org-scoped · Rollout 5 zakładek trwałych (`/api/rollout/*`, 17 endpointów) · raporty live-data (`reportContentGenerator.ts`, RAG+wizard, bez fabrykowanych liczb) · reuse dokumentu inicjatywy z M13 · handoff czatu Teresy. **POZA v1:** Manager lanes bez V8 (degraduje banerem `229cb35565`); realny feed-forward M14→M15 (dziś martwy, L-05 — DP-6 = „preview"); integracje Jira/Asana.
- **Metryka wartości:** Rollout trwały po reload; budgetHealth z realnych danych (✅ `84757dc672`); feed-forward budżet→sygnał w M15 widoczny (po DP-6); 0 fałszywie-zielonych kafelków na dashboardzie.

## B · UX DOCELOWE *(link + delty)*
Stany ekranu (pusty/ładowanie/błąd/pełny/brak-uprawnień) + §27 per powierzchnia: karta §5.
- **Layout:** `ExecutionHub` (ModuleHub — Menu 1/2/3, taby, breadcrumbs) ✅ zgodny. Portfel = `TableWithPreviewLayout`+`FilterableTable` komplet A0.
- **Największy dług §27:** 5 tabel Rollout (Plan/KPI/Risk/Change/Closure) = surowy `<table>` (`RegisterTable`, `RolloutTab.tsx`) — zero preview/filtrów/sortu/resize/kebaba/bulk (DP-9 → sweep Faza 4). Bulk-bar Portfel = tylko „N selected · Clear" (`ExecutionHub.tsx:4855-4870`), zero akcji. Manager lanes = CSS grid zamiast FilterableTable (§27.F).
- **Delta degradacji V8 (z karty, nie z testów żywych):** Manager V8 baner amber gdy `ENABLE_V8_GLOBAL≠true` (✅ `229cb35565`) zamiast pustych lanes; control tower outer-catch baner (✅ Fala 2e). **Pozostaje cicho:** PMO health (`ExecutionHub.tsx:1301`) i action-queue (`:1317`) `catch→[]` bez banera (L-02) — sygnały lecą do `[]`, user nie wie o niedostępności control-tower/risk/budget.
- **Treść/język:** ~141 kluczy PL brak w `translation.json` (działa przez inline-fallback) + hardkody presetów raportów (`:3338-3343`) — to dług słownika, nie wzorzec `isPolish` (L-07).

## C · DANE + API + REGUŁY *(link + maszyna Rollout + API enumerowane)*
- **Wiring FE↔BE↔DB:** karta §1e (kompletna tabela). Skrót: portfel/CRUD/status `pmo/execution.routes.ts` (5 verbs) + `ExecutionController`; Action Queue `:744-900` org-scoped; RAID+Decisions `:1248-1264`; Rollout 5 zakładek `rollout.routes.ts` + `20260608_rollout_tables.sql`; raporty `reportContentGenerator.ts`. **Flagi:** karta §1f — `ENABLE_V8_GLOBAL` (OFF default → Manager lanes martwe + osiągalność v8; legacy router na te same tabele — NIE fabrykacja); `v8OrgGate` implicit-fallback (poza prod org bez flag przepuszczana); pilot VTS (`readOnly` UI).
- **Maszyna stanów portfela (kanban):** status inicjatywy egzekwowany przez `PATCH /initiatives/:id/status` (`ExecutionInitiativesKanbanView.tsx:268`) — DnD przesuwa kolumnę → trwałość po reload (S2).
- **Maszyna Rollout (kanon, 5 rejestrów × CRUD):** `Plan → KPI → Risks → Change → Closure`, każda trwała na `/api/rollout/*`. **API enumerowane (`rollout.routes.ts`, 17 endpointów = 5 rejestrów):** każdy rejestr ma blok `GET (list)` / `POST (create)` / `PATCH (update)` / `DELETE` (`:69/87/117/166` · `:181/216/234/263/303` · `:332/350/377/418` · `:447/465/492/531`) pod `requireOrgRole('user')`. Wszystkie org-scoped na poziomie zapytania (migracja `20260608_rollout_tables.sql`).
- **Reguła gatingu (L-01):** Rollout CRUD blokowany `readOnly` w UI, ale serwer `requireOrgRole('user')` przepuszcza CRUD przez API → pilot tamper. Docelowo: gating serwerowy (capability) → pilot API → 403.
- **Reguła org-scope (R3 zweryfikowane):** budżet `recalcInitiativeActualTotal` `AND organization_id` (✅ `b9f2dee9d2`); `task_dependencies` 2-step verify (✅ `9974596da7`). Pozostaje `ON CONFLICT (id) DO UPDATE` bez org-guard na `risk_signal_alerts`/`delay_signals` (L-03, dismiss tamper).

## D · AI / TERESA *(link + granica)*
- **Co generuje:** raporty — `reportContentGenerator.ts` generuje z live-data, **brak fabrykowanych liczb** (RAG + wizard). Handoff czatu Teresy (kontekst egzekucji, `ExecutionHub.tsx:1665-1730`).
- **Granica persony:** Teresa nie „udaje wykonania" — opisuje stan z realnych agregatów, nie wymyśla Health Score ani budżetów. **CARD_CONTENT_FORMULA n.d.** — dokument inicjatywy = reuse z M13 (formuła rozliczana tam).

## E · INTEGRACJE
Pełna tabela: karta §1g. Skrót: **←** M13 (reuse dokumentu/panelu inicjatywy `ExecutionHub.tsx:135-139,4749-4758`), M03 (decyzje/taski w Action Queue/RAID `ExecutionController.ts:744-900`). **przekrój:** M01 (handoff czatu Teresy `:1665-1730`).
- **Delta (L-05, dziura w kręgosłupie produktu) feed-forward M14→M15:** dziś martwy — `ExecutionHub.tsx:945` ROI fallback puste; M15 czyta własne tabele niezależnie (`initiativeId` istnieje w scope `:787-796`, ale nie eksportuje sygnałów); brak eksportu (budget_health, roi_delta) do `v8_roi_realization_entries` + brak deep-linku `?initiativeId=` do Results. **DP-6 (`_DECYZJE.md`):** realny odbiór = osobna fala po Fazie 2; teraz „preview" + komunikat (ukryć przyciski sync, jeśli są). Docelowo: realny export sygnałów przy zmianie snapshotu + deep-link `?initiativeId=` do M15.
- **Zależność blokująca:** M15 Rezultaty = beta-CLOSED → feed-forward celuje w zamkniętą betę; domknąć po otwarciu bety M15 (D-01).

## F · EPIKI → STORIES → ZADANIA *(forma M13, Gherkin)*

**EPIK 1 — Integralność danych (P0) — DONE.**
- Story 1.1: jako admin org A nie mogę nadpisać budżetu inicjatywy org B.
  - Gherkin: dane inicjatywa org B · gdy admin org A POST `/api/execution-control/budget/entries` · wtedy `recalcInitiativeActualTotal` `WHERE id=? AND organization_id=?` → org B nietknięte.
  - Zadania: ~~Z-01 org-scope recalc → L-09~~ ✅ `b9f2dee9d2`; ~~Z-02 task_dependencies 2-step → L-09~~ ✅ `9974596da7`; ~~Z-03 osierocony route → L-04a~~ ✅ `2fe1c81be3`; ~~Z-04 budgetHealth real → L-00~~ ✅ `84757dc672`.

**EPIK 2 — Gating + degradacja (P1/P2/P3).**
- Story 2.1: jako pilot VTS nie mogę zmieniać Rollout przez API (nie tylko UI).
  - Gherkin: dane rola pilot · gdy POST/PATCH/DELETE `/api/rollout/*` · wtedy 403 (capability), nie 200.
  - Zadania: Z-05 gating pilota serwerowy (capability na `rollout.routes.ts`) → L-01.
- Story 2.2: jako PMO widzę baner gdy control-tower/risk/budget niedostępne (nie cichą pustkę).
  - Gherkin: dane V8-OFF / catch w health · gdy ładowanie PMO health/action-queue · wtedy baner degradacji, nie `[]`.
  - Zadania: Z-06 baner PMO health/action-queue (`:1301,1317`) → L-02. (Manager+control tower = już baner ✅ `229cb35565`/Fala 2e.)
- Story 2.3: jako user org A nie dismissuję cudzego sygnału (cross-org).
  - Gherkin: dane sygnał org B · gdy `ON CONFLICT (id) DO UPDATE` dismiss · wtedy org-guard odrzuca.
  - Zadania: Z-07 org-guard na `ON CONFLICT` (`v8/execution-control.routes.ts:128-132,410-418`) → L-03.

**EPIK 3 — Feed-forward M14→M15 (P1 INTEGRACJA, DP-6).**
- Story 3.1: jako PMO po zmianie budżetu w M14 widzę sygnał w M15 Rezultaty (lub jasny „preview").
  - Gherkin: dane snapshot M14 zmieniony · gdy zapis budżetu/roi_delta · wtedy export do `v8_roi_realization_entries` + deep-link `?initiativeId=` (DOCELOWO); teraz: „preview"+komunikat (sync ukryty).
  - Zadania: Z-08 export sygnałów ROI + deep-link Results (`ExecutionHub.tsx:945`) → L-05 [DP-6: preview teraz, realny odbiór po otwarciu bety M15 = D-01].

**EPIK 4 — Testy (P0-test).**
- Story 4.1: jako zespół mam zielone testy BE Rollout + kanban-DnD + raporty na `Londyn`.
  - Gherkin: dane PR do `Londyn` · gdy CI · wtedy S5 (rollout BE) + S2 (kanban-DnD) + S6 (raporty live-data) zielone.
  - Zadania: Z-09 BE `rollout.routes.test.ts` (S5) → L-08; Z-10 kanban-DnD (S2) + raporty (S6) → L-08; Z-11 fix env-drift (rola „iris", `localhost:3005`) + rewrite execution-center E2E → L-08; Z-12 helper mocka i18n (defaultValue, usuwa 3 FAIL PeopleChangeWorkspace) → L-08.

**EPIK 5 — §27 + i18n (P1, największy dług, DP-8/DP-9 → sweep Faza 4).**
- Story 5.1: jako user mam 5 tabel Rollout + Manager lanes przez FilterableTable z preview/filtrami/bulk.
  - Gherkin: dane Rollout register · gdy render · wtedy `FilterableTable`+preview+filtry+sort+resize+kebab+bulk (nie surowy `<table>`).
  - Zadania: Z-13 5 tabel Rollout + Manager lanes → FilterableTable (`RolloutTab.tsx`) → L-06; Z-14 bulk-bar Portfel z akcjami (`:4855-4870`) → L-06; Z-15 ~141 kluczy PL + presety raportów do `t()` (`:3338-3343`) → L-07. **DP-8:** ewentualne palety wykresów = legalne; reszta hex w sweepie.

**EPIK 6 — Cleanup (P2, D-02).**
- Story 6.1: jako zespół nie mam martwego kodu execution.
  - Gherkin: dane `ImplementationView`/`views/ExecutionView`/`ExecutionDetailPanel` · gdy grep referencji · wtedy 0.
  - Zadania: Z-16 wytnij 3 martwe + zweryfikuj 4 kandydatów (PeopleChange/RiskSignals/DelayDetection/ReportCompact) → L-04 [D-02].

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13)*
| # | Kryterium | Miara M14 |
|---|-----------|-----------|
| 1 | Front↔back | bulk-bar Portfel z akcjami (nie tylko „Clear"); feed-forward M14→M15 żywy lub „preview" (DP-6); Rollout trwały po reload (5 rejestrów × 17 verbs); budgetHealth real (✅ `84757dc672`); 0 martwych CTA |
| 2 | Bezpieczeństwo | cross-org budżet+task_dependencies ✅ `b9f2dee9d2`/`9974596da7` (R3: commity w git; read-only proof cross-org = Faza 4); gating pilota serwerowy (403, test); org-guard `ON CONFLICT` dismiss (`risk_signal_alerts`/`delay_signals`) |
| 3 | i18n | **5** inline (`i18n.language==='pl'`/`isPolish`) w `src/components/Execution/` (grep 2026-06-13 = 5) — dług to **~141 brakujących kluczy PL** w `translation.json` (inline-fallback) + hardkody presetów (`:3338-3343`), nie wzorzec `isPolish` |
| 4 | Tokeny | **7** hex w `src/components/Execution/` (grep 2026-06-13 = 7) — zweryfikować ile = ikony/palety (DP-8 legalne) vs hardkod UI-chrome; Visual Standard |
| 5 | §27 | **2** surowych `<table>` w `src/components/Execution/` (grep 2026-06-13 = 2; RegisterTable pokrywa 5 rejestrów Rollout) → FilterableTable; bulk-bar Portfel z akcjami; Manager lanes grid → FilterableTable (DP-9 sweep) |
| 6 | E2E w PR-gate | S5 (rollout BE) + S2 (kanban-DnD) + S6 (raporty) zielone na `Londyn` (dziś 0 — `test-suite.yml` tylko main/develop) |

Scenariusze S1–S7 + pokrycie + pułapka CI: karta §0/§2 (633 PASS/23 FAIL lokalnie, 5 klas root-cause). Bezpieczeństwo: karta §6 (org NIE spoofowalny z nagłówka, `auth.middleware.ts:619-640`).
**Wydajność/limity:** agregaty portfela/health liczone z DB — uwaga na N+1 przy rollupie portfela (zweryfikować w Fazie 3). **Telemetria:** budget_health i roi_delta jako sygnały (po DP-6) = pomiar domknięcia kręgosłupa M14→M15.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | 11/13 realne; cross-org+budgetHealth+osierocony route naprawione; dług §27 Rollout (5 tabel) + ~141 kluczy PL | L-01,02,03,04,05,06,07,08 |
| W-02 | **Uwagi żywe** `UWAGI_TESTY_2026-06-13.md` | 2026-06-13 | **BRAK uwag M14** — dziedziczy z karty (jawnie odnotowane; R6 = żywy dowód D wymaga Fazy 4) | — |
| W-03 | INTEGRACJE.md §C poz.5 / Sprint 4–5 / W6 | — | feed-forward M14→M15 (export ROI + deep-link) | L-05 |
| W-04 | Decyzja Sprint 4 #5 (mock→real fetch) + #7 (Artifacts) | 2026-06-11 | reguły reuse/realności | — |
| W-05 | **DP-6/DP-8/DP-9** (`_DECYZJE.md`) | 2026-06-13 | sync M14→M15 = „preview"; palety hex legalne; §27 w sweepie | L-05 (DP-6), L-06/L-07 (DP-8/9) |
| W-06 | Feedback prod (`finding_railway_db_topology`) | — | dev `.env` → Railway PROD DB; `ENABLE_V8_GLOBAL` decyduje o Manager lanes | ryzyko (§06) |

### 02 · Stan obecny (prawda kodu) — karta §1 (REALNE 11 · 2 wymagają V8 · MARTWE 3+ legacy views). Naprawione: `b9f2dee9d2` (budżet org-scope), `9974596da7` (task_dependencies 2-step), `2fe1c81be3` (osierocony route usunięty), `84757dc672` (budgetHealth real + W13 i18n Wave8), `229cb35565` (Manager V8 baner), Fala 2e (control tower baner).

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status |
|----|------|---------|--------------------|-------|------|--------|
| L-01 | gating pilota tylko klient (serwer przepuszcza CRUD) | W-01 | Rollout CRUD `requireOrgRole('user')` (`rollout.routes.ts`, 17 verbs) | P1 | 2 | **ZAMKNIĘTA** — `requireRolloutWrite = requireOrgRole('admin')` na 17 verbów (`rollout.routes.ts:47,104,135,185,254,284,325,373,401,443,491,519,559`); 13/13 testów PASS |
| L-02 | cicha degradacja `catch→[]` PMO health/action-queue | W-01 | `ExecutionHub.tsx:1301,1317` | P2 | 2 | **NAPRAWIONA — `Callout variant="warning"` renderowany przy `healthSnapshotFailed` (`:2960`) i `actionQueueFailed` (`:3718`); zweryfikowane grep** | 2026-06-16 |
| L-03 | `ON CONFLICT (id) DO UPDATE` bez org-guard (dismiss tamper) | W-01 | `v8/execution-control.routes.ts:128-132,410-418` | P3 | 3 | **NAPRAWIONA — `WHERE risk_signal_alerts.organization_id = ?` w DO UPDATE (`:157`); `WHERE delay_signals.organization_id = ?` (`:424`); komentarz L-03 w kodzie** | 2026-06-16 |
| L-04 | martwy kod (`ImplementationView`/`views/ExecutionView`/`ExecutionDetailPanel`) + 4 kandydaci | W-01 | importowany nieren./hardcode `projectId="default"` | P2 | 3 | **CZĘŚCIOWO** — `views/ExecutionView.tsx` + `views/ImplementationView.tsx` usunięte (commit `2d5bbc17dd`); 4 kandydaci (D-02 DP-7) pozostają |
| L-05 | feed-forward M14→M15 martwy (dziura w kręgosłupie) | W-03,W-05 | `ExecutionHub.tsx:945`; brak `?initiativeId=` export | P1 | 2 | **DP-6: preview teraz; realny odbiór = D-01** |
| L-06 | 5 tabel Rollout poza §27 + bulk-bar Portfel bez akcji + Manager lanes grid | W-01,W-05 | `RolloutTab.tsx` RegisterTable (2 raw `<table>` pokrywa 5 rej.), `ExecutionHub.tsx:4855-4870` | P1 | 4 | otwarta (DP-9 sweep) |
| L-07 | ~141 kluczy PL brak + hardkody presetów raportów | W-01 | `translation.json` (inline-fallback), `:3338-3343` (5 inline `isPolish`) | P2 | 4 | **NAPRAWIONA — `1dbca1d245` (101 kluczy execution.* PL+EN; koniec inline-fallback)** | 2026-06-16 |
| L-08 | testy: `rollout.routes` BE (S5), kanban-DnD (S2), raporty (S6); env-drift | W-01 | brak `rollout.routes.test.ts`; role „iris", `localhost:3005` | P0-test | 2/4 | **CZĘŚCIOWO** — `rollout.routes.test.ts` gotowy, 13/13 PASS (persist, org-scope, L-01 gating); kanban-DnD + raporty nie pokryte (S2/S6) |
| L-09 | cross-org write budżetu + task_dependencies | W-01 | `executionBudgetService.ts:413`; `v8/execution-control.routes.ts:1138-1151` | P0 | — | **NAPRAWIONA `b9f2dee9d2`+`9974596da7` (R3: commity zweryfikowane w git; read-only proof cross-org = Faza 4)** |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | feed-forward M14→M15: kiedy realny odbiór? (M15 beta-closed) | po otwarciu bety M15 / za flagą teraz | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTE → DP-6: „preview" + komunikat teraz** (sync ukryty); realny odbiór osobną falą po otwarciu bety M15 |
| D-02 | 4 kandydaci martwego kodu (PeopleChange/RiskSignals/DelayDetection/ReportCompact): wyciąć czy zostawić? | wytnij / zostaw (live) | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTE → DP-7: wytnij martwy kod** (zweryf. live kandydatów); jeśli stub v1 → DP-5 ukryj za flagą |
| D-03 | Manager lanes: wymagać V8 czy dopisać legacy `/manager/lanes/*`? | tylko V8+baner / legacy fallback | Piotr | TBD | otwarta (modułowa) |

### 05 · Flagi/rollout — `ENABLE_V8_GLOBAL` (OFF default; Manager lanes + osiągalność v8 ścieżek; degraduje banerem); pilot (rola, gating→serwer L-01); beta core otwarty; migracja `20260608_rollout_tables.sql` zastosowana (potwierdzić na środowiskach — Faza 3).
### 06 · Ryzyka — feed-forward (L-05) celuje w beta-closed M15 → DP-6 preview, domknąć realny odbiór po otwarciu bety. `ENABLE_V8_GLOBAL` na staging/prod decyduje o Manager lanes — zweryfikować w Fazie 3. Dev `.env` → Railway PROD — ostrożność z zapisami przy smoke. Brak uwag żywych → re-ocena D wymaga Fazy 4 (nie ma sygnału obniżającego z testów żywych, ale też nie ma dowodu D).
### 07 · Log — 2026-06-16: L-01+L-02+L-03+L-04(częściowo)+L-07+L-08(częściowo) zamknięte; martwy kod views wyciągnięty; bannery degradacji zweryfikowane grepem. 2026-06-13: brak uwag żywych (jawnie); teczka pogłębiona do M13-level (F Gherkin, C API enumerowane, DP-6/8/9 wpięte). Audyt 2026-06-11/12: ocena 52/100; `b9f2dee9d2`, `9974596da7`, `84757dc672`, `229cb35565`, `2fe1c81be3`. Re-ocena D/G po Fazie 3/4.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + jawne „brak uwag żywych M14" + INTEGRACJE + decyzje Sprint 4 + DP-6/8/9 + feedback prod) · R2 zero sierot (wejście→luka→story Gherkin→DoD→dowód) · R3 statusy „naprawione" z commitami zweryfikowanymi w git; read-only proof cross-org = Faza 4 · R4 DoD z liczbami (5 inline + ~141 kluczy PL · 2 table · 7 hex; rollout 17 verbs) · R5 decyzje z właścicielem (**D-01 ROZSTRZYGNIĘTE → DP-6; D-02 → DP-7/DP-5**; D-03 modułowa TBD) · A–E docelowy zlinkowany · F epiki→stories Gherkin→zadania↔luki · G DoD+S+sec+wydajność+telemetria · R6 sesja żywa = Faza 4 (zaplanowana — brak uwag dziś nie zwalnia z żywego dowodu D). **Teczka kompletna do egzekucji.**
