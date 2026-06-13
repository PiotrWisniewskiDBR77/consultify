# TECZKA M14 — Wdrożenie (Execution) · pełna teczka reuse-first

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu §1–§7 + evidence) i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami). **Brak uwag żywych dla M14** — dziedziczy z karty. Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M14 Wdrożenie/Execution (dashboard · portfel · Action Queue/RAID · Rollout · raporty · Manager) · **Pula:** core — najsolidniejszy rdzeń z modułów core
- **Ocena audytu:** 52/100 · **Status:** FAZA 2 → FAZA 4 (sweepy: §27 Rollout + i18n PL) · **Rozmiar:** L (5 tabel Rollout→FilterableTable, ~141 kluczy i18n PL)
- **Żywy bloker:** brak otwartych P0 (P0 cross-org NAPRAWIONE) · **Brak uwag żywych** w `UWAGI_TESTY_2026-06-13.md`
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M14-wdrozenie/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md`
- **Kod:** `src/components/Execution/` (ExecutionHub, ExecutionInitiativesKanbanView, RolloutTab/RegisterTable) · `server/src/routes/pmo/execution.routes.ts` · `server/src/controllers/ExecutionController.ts` · `server/src/routes/rollout.routes.ts` · migracja `20260608_rollout_tables.sql` · `server/src/services/reportContentGenerator.ts`

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 (7 scenariuszy) | job-to-be-done + zakres (niżej) |
| B UX docelowe | 🟢 | karta §5 (§27 Portfel/Raporty/5×Rollout/Manager) | delta degradacja V8 + Rollout |
| C Dane+API+reguły | 🟢 | karta §1e (wiring) + §1f (flagi) | link + maszyna Rollout (niżej) |
| D AI/Teresa | 🟢 | `reportContentGenerator.ts` (live-data) + handoff czatu | — (n.d. CARD_FORMULA — reuse dok. M13) |
| E Integracje | 🟢 | karta §1g | delta feed-forward M14→M15 (niżej) |
| F Epiki | 🟢 | karta §7 (3 fale) | epiki (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
- **Job-to-be-done:** prowadzić wdrożenie portfela inicjatyw — od executive dashboardu (Health Score), przez kanban/timeline egzekucji, Action Queue/RAID/decyzje, rollout (Plan/KPI/Risks/Change/Closure), po raporty z live-data.
- **Persony/role:** PMO/portfolio owner, manager (people_change lanes — wymaga V8), Steering; pilot (gating dziś tylko UI, L-01). Core otwarty.
- **Zakres v1:** dashboard Health Score (z DB, nie fabrykowany) · 3 widoki portfela + kanban DnD · Action Queue/RAID/Decisions org-scoped · Rollout 5 zakładek trwałe (`/api/rollout/*`) · raporty live-data · reuse dokumentu inicjatywy z M13 · handoff czatu Teresy. **POZA v1:** Manager lanes bez V8 (degraduje banerem); feed-forward M14→M15 (dziś martwy, L-05).
- **Metryka:** Rollout trwały po reload; budgetHealth z realnych danych (✅ `84757dc672`); feed-forward budżet→sygnał w M15.

## B · UX DOCELOWE *(link + delty)*
Stany + §27: karta §5. **Największy dług §27:** 5 tabel Rollout (KPI/Risk/Change/Closure/Plan) = surowy `<table>` (`RegisterTable`, `RolloutTab:1130`) — zero preview/filtrów/sortu/resize/kebaba/bulk. Bulk-bar Portfel = tylko „N selected · Clear" (`ExecutionHub.tsx:4855-4870`). Manager lanes = CSS grid zamiast FilterableTable.
**Delty (z karty, nie z testów żywych):**
- **Manager V8 degradation:** baner amber gdy `ENABLE_V8_GLOBAL≠true` (✅ `229cb35565`) zamiast pustych lanes; control tower outer-catch baner (✅ Fala 2e). Pozostaje PMO health/action-queue cicho `catch→[]` bez banera (L-02).
- **Rollout → FilterableTable+preview+filtry+sort+resize+kebab+bulk.**

## C · DANE + API + REGUŁY *(link + maszyna Rollout)*
- **Wiring FE↔BE↔DB:** karta §1e (portfel/CRUD/status `pmo/execution.routes.ts`+`ExecutionController`; Action Queue `:744-900` org-scoped; RAID+Decisions `:1248-1264`; Rollout 5 zakładek `rollout.routes.ts`+`20260608_rollout_tables.sql`; raporty `reportContentGenerator.ts`). **Flagi:** `ENABLE_V8_GLOBAL` (Manager lanes + osiągalność v8; legacy router na te same tabele — NIE fabrykacja).
- **Maszyna Rollout (kanon):** Plan → KPI → Risks → Change → Closure, każda trwała na `/api/rollout/*`.
- **Reguła gatingu (L-01):** Rollout CRUD blokowany `readOnly` w UI, ale serwer `requireOrgRole('user')` przepuszcza CRUD przez API → pilot tamper. Docelowo: gating serwerowy + capability → pilot API → 403.

## D · AI / TERESA *(link)*
- Raporty: `reportContentGenerator.ts` — generacja z live-data, **brak fabrykowanych liczb** (RAG + wizard). Handoff czatu Teresy (kontekst egzekucji, `ExecutionHub.tsx:1665-1730`). CARD_CONTENT_FORMULA **n.d.** (dokument inicjatywy = reuse z M13).

## E · INTEGRACJE
Pełna tabela: karta §1g. Skrót: **←** M13 (reuse dokumentu/panelu inicjatywy `ExecutionHub.tsx:135-139,4749-4758`), M03 (decyzje/taski w Action Queue/RAID `ExecutionController.ts:744-900`). **przekrój:** M01 (handoff czatu Teresy). **Delta (L-05, dziura w kręgosłupie produktu):** feed-forward M14→M15 martwy — `ExecutionHub.tsx:945` ROI fallback puste; M15 czyta własne tabele niezależnie; brak eksportu sygnałów (budget_health, roi_delta) do `v8_roi_realization_entries` + brak deep-linku `?initiativeId=` do Results. Docelowo: realny export sygnałów przy zmianie snapshotu + deep-link.

## F · EPIKI *(z karty §7, forma epików)*
- **EPIK 1 — Integralność (P0):** ~~cross-org budżet~~ `b9f2dee9d2`; ~~task_dependencies~~ `9974596da7`; ~~osierocony execution.routes.ts~~ `2fe1c81be3`; ~~budgetHealth hardcode~~ `84757dc672`. [Fala 1/2, DONE]
- **EPIK 2 — Gating + degradacja (P1/P2):** gating pilota serwerowy (L-01); baner PMO health/action-queue (L-02); org-guard `ON CONFLICT` dismiss (L-03). [Fala 2]
- **EPIK 3 — Feed-forward M14→M15 (P1 INTEGRACJA):** export sygnałów ROI + deep-link Results (L-05). [karta §7 W6]
- **EPIK 4 — Testy (P0-test):** BE `rollout.routes` (S5); kanban-DnD (S2); raporty live-data (S6); fix env-drift (role „iris", `localhost:3005`); rewrite execution-center E2E. [Fala 2/4]
- **EPIK 5 — §27 + i18n (P1, największy dług):** 5 tabel Rollout + Manager lanes → FilterableTable; bulk-bar Portfel z akcjami; ~141 kluczy PL + presety raportów do `t()`; `Londyn` do CI+PR-gate. [Fala 4]
- **EPIK 6 — Cleanup (P2):** wytnij `ImplementationView`/`views/ExecutionView`/`ExecutionDetailPanel` + zweryfikuj 4 kandydatów. [Fala 3]

## G · JAKOŚĆ / DoD *(skwantyfikowane)*
| # | Kryterium | Miara M14 |
|---|-----------|-----------|
| 1 | Front↔back | bulk-bar Portfel z akcjami (nie tylko „Clear"); feed-forward M14→M15 żywy (zmiana budżetu→sygnał w M15); Rollout trwały po reload; budgetHealth real (✅ `84757dc672`) |
| 2 | Bezpieczeństwo | cross-org budżet+task_dependencies ✅ `b9f2dee9d2`/`9974596da7`; gating pilota serwerowy (403, test); org-guard `ON CONFLICT` dismiss (`risk_signal_alerts`/`delay_signals`) |
| 3 | i18n | **5** inline (`i18n.language==='pl'`/`isPolish`) w `src/components/Execution/` — dług i18n M14 to **~141 brakujących kluczy PL** w `translation.json` (inline-fallback) + hardkody presetów (`:3338-3343`), nie wzorzec `isPolish` |
| 4 | Tokeny | **7** hex w `src/components/Execution/` (zweryfikować ile = ikony vs hardkod); Visual Standard |
| 5 | §27 | 5 tabel Rollout + Manager lanes przez FilterableTable; bulk-bar Portfel z akcjami; **2** surowych `<table>` w `src/components/Execution/` (Rollout RegisterTable — potwierdzić pokrycie wszystkich 5 rejestrów) |
| 6 | E2E w PR-gate | S5 (rollout BE) + S2 (kanban-DnD) zielone na `Londyn` (dziś 0 — `test-suite.yml` tylko main/develop) |

Scenariusze S1–S7 + pokrycie: karta §0/§2. Bezpieczeństwo: karta §6.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | 11/13 realne; cross-org+budgetHealth+osierocony route naprawione; dług §27 Rollout | L-01,02,03,04,05,06 |
| W-02 | **Uwagi żywe** | 2026-06-13 | **BRAK uwag M14** w `UWAGI_TESTY_2026-06-13.md` (dziedziczy z karty) | — |
| W-03 | INTEGRACJE.md §C poz.5 / Sprint 4–5 / W6 | — | feed-forward M14→M15 (export ROI + deep-link) | L-05 |
| W-04 | Decyzja Sprint 4 #5 (mock→real fetch) + #7 (Artifacts) | 2026-06-11 | reguły reuse/realności | — |
| W-05 | Feedback prod (`finding_railway_db_topology`) | — | dev `.env` → Railway PROD DB; `ENABLE_V8_GLOBAL` decyduje o Manager lanes | ryzyko (niżej) |

### 02 · Stan obecny (prawda kodu) — karta §1 (REALNE 11 · 2 wymagają V8). Naprawione: `b9f2dee9d2` (budżet org-scope), `9974596da7` (task_dependencies 2-step), `2fe1c81be3` (osierocony route), `84757dc672` (budgetHealth real + W13 i18n Wave8), `229cb35565` (Manager V8 baner), Fala 2e (control tower baner).

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status |
|----|------|---------|--------------------|-------|------|--------|
| L-01 | gating pilota tylko klient (serwer przepuszcza CRUD) | W-01 | Rollout CRUD `requireOrgRole('user')` | P1 | 2 | otwarta |
| L-02 | cicha degradacja `catch→[]` PMO health/action-queue | W-01 | `ExecutionHub.tsx:1301,1317` | P2 | 2 | otwarta (Manager+control tower = naprawione banerem) |
| L-03 | `ON CONFLICT (id) DO UPDATE` bez org-guard (dismiss tamper) | W-01 | `v8/execution-control.routes.ts:128-132,410-418` | P3 | 3 | otwarta |
| L-04 | martwy kod (`ImplementationView`/`views/ExecutionView`/`ExecutionDetailPanel`) | W-01 | importowany nieren./hardcode `projectId="default"` | P2 | 3 | otwarta |
| L-05 | feed-forward M14→M15 martwy (dziura w kręgosłupie) | W-03 | `ExecutionHub.tsx:945`; brak `?initiativeId=` | P1 | 2 | otwarta |
| L-06 | 5 tabel Rollout poza §27 + bulk-bar Portfel bez akcji + Manager lanes grid | W-01 | `RolloutTab:1130`, `ExecutionHub.tsx:4855-4870` | P1 | 4 | otwarta |
| L-07 | ~141 kluczy PL brak + hardkody presetów raportów | W-01 | `translation.json` (inline-fallback), `:3338-3343` | P2 | 4 | otwarta |
| L-08 | testy: `rollout.routes` BE (S5), kanban-DnD (S2), raporty (S6); env-drift | W-01 | brak `rollout.routes.test.ts`; role „iris", `localhost:3005` | P0-test | 2/4 | otwarta |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | feed-forward M14→M15: kiedy? (M15 Rezultaty beta-closed) | po otwarciu bety M15 / za flagą teraz | Piotr | TBD (per MASTER §5) | otwarta |
| D-02 | 4 kandydaci martwego kodu (PeopleChange/RiskSignals/DelayDetection/ReportCompact): wyciąć czy zostawić? | wytnij / zostaw (live) | Piotr | TBD | otwarta |
| D-03 | Manager lanes: wymagać V8 czy dopisać legacy `/manager/lanes/*`? | tylko V8+baner / legacy fallback | Piotr | TBD | otwarta |

### 05 · Flagi/rollout — `ENABLE_V8_GLOBAL` (Manager lanes + osiągalność v8 ścieżek; degraduje banerem); pilot (rola, gating→serwer L-01); beta core otwarty; migracja `20260608_rollout_tables.sql` zastosowana.
### 06 · Ryzyka — feed-forward (L-05) celuje w beta-closed M15 → domknąć po otwarciu bety. `ENABLE_V8_GLOBAL` na staging/prod decyduje o Manager lanes — zweryfikować w Fazie 3. Dev `.env` → Railway PROD — ostrożność z zapisami przy smoke. Brak uwag żywych → re-ocena D wymaga Fazy 4 (nie ma sygnału obniżającego z testów żywych, ale też nie ma dowodu D).
### 07 · Log — 2026-06-13: brak uwag żywych; teczka dziedziczy z karty. Audyt 2026-06-11/12: ocena 52/100; `b9f2dee9d2`, `9974596da7`, `84757dc672`, `229cb35565`, `2fe1c81be3`. Re-ocena D/G po Fazie 3/4.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + jawne „brak uwag żywych M14" + INTEGRACJE + decyzje Sprint 4 + feedback prod) · R2 zero sierot (wejście→luka→DoD) · R3 statusy „naprawione" z commitami; reszta otwarta · R4 DoD z liczbami (5 inline + ~141 kluczy PL · 2 table · 7 hex) · R5 decyzje z właścicielem (terminy TBD) · A–E docelowy zlinkowany · F epiki↔luki · G DoD+S+sec · R6 sesja żywa = Faza 4 (zaplanowana — brak uwag dziś nie zwalnia z żywego dowodu D). **Teczka kompletna do egzekucji.**
